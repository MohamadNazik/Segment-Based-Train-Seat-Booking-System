package cache

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"

	"github.com/MohamadNazik/Segment-Based-Train-Seat-Booking-System/backend/internal/apiformat"
)

var ErrHoldNotFound = errors.New("hold not found")

// HoldRange is a raw, storage-level view of an active hold's leg - deliberately
// dependency-free (no import of the seats package) so it can sit below both
// seats (which reads holds for three-state availability and fragmentation
// pricing) and holds (which writes them), without either package importing
// the other.
type HoldRange struct {
	TravelDate     time.Time
	OriginSeq      int
	DestinationSeq int
}

// Hold is a created hold returned to the caller.
type Hold struct {
	Token          string
	SeatID         string
	TravelDate     time.Time
	OriginSeq      int
	DestinationSeq int
	Fare           float64
	ExpiresAt      time.Time
}

type holdPayload struct {
	SeatID         string  `json:"seat_id"`
	TravelDate     string  `json:"travel_date"`
	OriginSeq      int     `json:"origin_seq"`
	DestinationSeq int     `json:"destination_seq"`
	Fare           float64 `json:"fare"`
}

const holdKeyPrefix = "hold:"
const lockKeyPrefix = "lock:seat:"

// HoldStore is the low-level Redis-backed storage for temporary seat holds.
// It knows nothing about fare calculation, overlap rules, or the seats
// domain - callers (seats.Service for reading, holds.Service for writing)
// supply already-decided data and get back plain storage primitives.
type HoldStore struct {
	client *redis.Client
}

func NewHoldStore(client *redis.Client) *HoldStore {
	return &HoldStore{client: client}
}

// Create writes a new hold with the given TTL and returns it, including a
// fresh opaque token that's both the Redis key suffix and the caller's proof
// of ownership for later cancel/finalize requests.
func (s *HoldStore) Create(ctx context.Context, seatID string, originSeq, destinationSeq int, travelDate time.Time, fare float64, ttl time.Duration) (Hold, error) {
	token, err := randomToken()
	if err != nil {
		return Hold{}, fmt.Errorf("generate hold token: %w", err)
	}

	payload := holdPayload{
		SeatID:         seatID,
		TravelDate:     travelDate.Format(apiformat.DateFormat),
		OriginSeq:      originSeq,
		DestinationSeq: destinationSeq,
		Fare:           fare,
	}
	data, err := json.Marshal(payload)
	if err != nil {
		return Hold{}, fmt.Errorf("marshal hold: %w", err)
	}

	if err := s.client.Set(ctx, holdKeyPrefix+token, data, ttl).Err(); err != nil {
		return Hold{}, fmt.Errorf("store hold: %w", err)
	}

	return Hold{
		Token:          token,
		SeatID:         seatID,
		TravelDate:     travelDate,
		OriginSeq:      originSeq,
		DestinationSeq: destinationSeq,
		Fare:           fare,
		ExpiresAt:      time.Now().Add(ttl),
	}, nil
}

// Get looks up a hold by token, e.g. to finalize it into a booking.
// Returns ErrHoldNotFound if the token is unknown or has already expired.
func (s *HoldStore) Get(ctx context.Context, token string) (Hold, error) {
	key := holdKeyPrefix + token

	data, err := s.client.Get(ctx, key).Bytes()
	if errors.Is(err, redis.Nil) {
		return Hold{}, ErrHoldNotFound
	}
	if err != nil {
		return Hold{}, fmt.Errorf("read hold: %w", err)
	}

	var payload holdPayload
	if err := json.Unmarshal(data, &payload); err != nil {
		return Hold{}, fmt.Errorf("unmarshal hold: %w", err)
	}

	travelDate, err := time.Parse(apiformat.DateFormat, payload.TravelDate)
	if err != nil {
		return Hold{}, fmt.Errorf("parse stored travel date: %w", err)
	}

	var expiresAt time.Time
	if ttl, err := s.client.TTL(ctx, key).Result(); err == nil && ttl > 0 {
		expiresAt = time.Now().Add(ttl)
	}

	return Hold{
		Token:          token,
		SeatID:         payload.SeatID,
		TravelDate:     travelDate,
		OriginSeq:      payload.OriginSeq,
		DestinationSeq: payload.DestinationSeq,
		Fare:           payload.Fare,
		ExpiresAt:      expiresAt,
	}, nil
}

// Cancel releases a hold immediately rather than waiting for its TTL.
// Cancelling an already-expired or unknown token returns ErrHoldNotFound.
func (s *HoldStore) Cancel(ctx context.Context, token string) error {
	n, err := s.client.Del(ctx, holdKeyPrefix+token).Result()
	if err != nil {
		return fmt.Errorf("delete hold: %w", err)
	}
	if n == 0 {
		return ErrHoldNotFound
	}
	return nil
}

// AllHolds returns every currently-active hold, grouped by seat ID. Holds
// are few and short-lived by design (TTL-bounded), so a single SCAN sweep
// is simpler and cheap enough compared to maintaining a secondary per-seat
// index that would need its own expiry bookkeeping.
func (s *HoldStore) AllHolds(ctx context.Context) (map[string][]HoldRange, error) {
	result := make(map[string][]HoldRange)

	iter := s.client.Scan(ctx, 0, holdKeyPrefix+"*", 0).Iterator()
	for iter.Next(ctx) {
		data, err := s.client.Get(ctx, iter.Val()).Bytes()
		if errors.Is(err, redis.Nil) {
			continue // expired between SCAN and GET - fine, just skip it
		}
		if err != nil {
			return nil, fmt.Errorf("read hold: %w", err)
		}

		var payload holdPayload
		if err := json.Unmarshal(data, &payload); err != nil {
			return nil, fmt.Errorf("unmarshal hold: %w", err)
		}

		travelDate, err := time.Parse(apiformat.DateFormat, payload.TravelDate)
		if err != nil {
			return nil, fmt.Errorf("parse stored travel date: %w", err)
		}

		result[payload.SeatID] = append(result[payload.SeatID], HoldRange{
			TravelDate:     travelDate,
			OriginSeq:      payload.OriginSeq,
			DestinationSeq: payload.DestinationSeq,
		})
	}
	if err := iter.Err(); err != nil {
		return nil, fmt.Errorf("scan holds: %w", err)
	}

	return result, nil
}

// Lock serializes hold-creation attempts for a single seat, closing the race
// where two concurrent requests both see "no overlap" and both create a
// hold. It's a short-lived, single-instance Redis lock (SET NX PX + a
// compare-and-delete unlock) - not a full multi-node Redlock, which isn't
// needed here since there's one Redis instance. Returns an unlock function
// that must be called (typically via defer) once the caller is done.
func (s *HoldStore) Lock(ctx context.Context, seatID string) (func(context.Context) error, error) {
	key := lockKeyPrefix + seatID
	value, err := randomToken()
	if err != nil {
		return nil, fmt.Errorf("generate lock token: %w", err)
	}

	const (
		lockTTL     = 5 * time.Second
		maxAttempts = 20
		retryDelay  = 50 * time.Millisecond
	)

	for range maxAttempts {
		ok, err := s.client.SetNX(ctx, key, value, lockTTL).Result()
		if err != nil {
			return nil, fmt.Errorf("acquire seat lock: %w", err)
		}
		if ok {
			unlock := func(unlockCtx context.Context) error {
				return unlockScript.Run(unlockCtx, s.client, []string{key}, value).Err()
			}
			return unlock, nil
		}

		select {
		case <-time.After(retryDelay):
		case <-ctx.Done():
			return nil, ctx.Err()
		}
	}

	return nil, fmt.Errorf("seat %s is busy, try again", seatID)
}

// unlockScript only deletes the lock if it still holds the value we set,
// so we never release a lock some other request acquired after ours expired.
var unlockScript = redis.NewScript(`
if redis.call("get", KEYS[1]) == ARGV[1] then
	return redis.call("del", KEYS[1])
else
	return 0
end
`)

func randomToken() (string, error) {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}
