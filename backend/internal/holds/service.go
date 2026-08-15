package holds

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/MohamadNazik/Segment-Based-Train-Seat-Booking-System/backend/internal/apiformat"
	"github.com/MohamadNazik/Segment-Based-Train-Seat-Booking-System/backend/internal/cache"
	"github.com/MohamadNazik/Segment-Based-Train-Seat-Booking-System/backend/internal/seats"
)

// ErrConflict marks a seat that isn't available for the requested leg right
// now (already booked, or another hold is pending on an overlapping range).
type ErrConflict struct {
	msg string
}

func (e *ErrConflict) Error() string { return e.msg }

var (
	ErrSeatNotFound = errors.New("seat not found or not reservable")
	ErrHoldNotFound = errors.New("hold not found")
)

// Store is the subset of cache.HoldStore this service needs, declared here
// so the service depends on a narrow interface rather than the concrete
// Redis-backed type.
type Store interface {
	Create(ctx context.Context, seatID string, originSeq, destinationSeq int, travelDate time.Time, fare float64, ttl time.Duration) (cache.Hold, error)
	Cancel(ctx context.Context, token string) error
	Lock(ctx context.Context, seatID string) (func(context.Context) error, error)
}

type Service struct {
	seats *seats.Service
	store Store
	ttl   time.Duration
}

func NewService(seatsService *seats.Service, store Store, ttl time.Duration) *Service {
	return &Service{seats: seatsService, store: store, ttl: ttl}
}

// CreateHold prices seatID for the requested leg and date using the exact
// same rules as availability and, if it's genuinely available right now,
// reserves it.
//
// The per-seat lock is what makes two concurrent requests for the same or
// overlapping segment safe: both might see "available" if they checked at
// the same instant, but only one can hold the lock at a time. Whichever
// acquires it first prices and creates the hold inside the lock; the second
// blocks until the first releases it, then re-prices from scratch and finds
// the seat no longer available.
func (s *Service) CreateHold(ctx context.Context, seatID, originCode, destCode string, travelDate time.Time) (Hold, error) {
	unlock, err := s.store.Lock(ctx, seatID)
	if err != nil {
		return Hold{}, fmt.Errorf("lock seat: %w", err)
	}
	defer unlock(ctx)

	price, err := s.seats.CheckSeat(ctx, seatID, originCode, destCode, travelDate)
	if err != nil {
		var notReserved seats.ErrSeatNotReserved
		if errors.As(err, &notReserved) {
			return Hold{}, ErrSeatNotFound
		}
		return Hold{}, err
	}

	if price.Status != "available" {
		return Hold{}, &ErrConflict{msg: fmt.Sprintf("seat is %s for this leg", price.Status)}
	}

	h, err := s.store.Create(ctx, seatID, price.OriginSeq, price.DestinationSeq, price.TravelDate, price.Fare, s.ttl)
	if err != nil {
		return Hold{}, err
	}

	return Hold{
		Token:      h.Token,
		TravelDate: h.TravelDate.Format(apiformat.DateFormat),
		Fare:       h.Fare,
		ExpiresAt:  h.ExpiresAt,
	}, nil
}

// CancelHold releases a hold immediately. No seat lock is needed here -
// deleting a specific, already-known token is a single atomic operation,
// with no check-then-act race to close.
func (s *Service) CancelHold(ctx context.Context, token string) error {
	if err := s.store.Cancel(ctx, token); err != nil {
		if errors.Is(err, cache.ErrHoldNotFound) {
			return ErrHoldNotFound
		}
		return err
	}
	return nil
}
