package bookings

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/MohamadNazik/Segment-Based-Train-Seat-Booking-System/backend/internal/apiformat"
)

// ErrConflict means the exclusion constraint rejected the insert - the seat
// is no longer available for this leg/direction/date. This is the
// defense-in-depth backstop: it should be rare in practice, since a hold
// already reserved the seat, but it's what guarantees a double-booking can
// never actually be persisted regardless of what happens upstream.
var ErrConflict = errors.New("seat is no longer available for this leg")

const exclusionViolationCode = "23P01"

type Repo struct {
	pool *pgxpool.Pool
}

func NewRepo(pool *pgxpool.Pool) *Repo {
	return &Repo{pool: pool}
}

// Insert creates a confirmed booking. origin/destinationSeq are stored as
// given (the passenger's actual boarding/alighting order), so the database's
// generated is_outbound/segment columns and exclusion constraint apply
// exactly as they do for any other booking.
func (r *Repo) Insert(ctx context.Context, seatID string, originSeq, destinationSeq int, travelDate time.Time, email, mobile string, fare float64) (Booking, error) {
	var b Booking
	var storedTravelDate time.Time
	err := r.pool.QueryRow(ctx, `
		INSERT INTO bookings (seat_id, origin_seq, destination_seq, travel_date, email, mobile, fare)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id, seat_id, origin_seq, destination_seq, travel_date, email, mobile, fare, created_at
	`, seatID, originSeq, destinationSeq, travelDate, email, mobile, fare).Scan(
		&b.ID, &b.SeatID, &b.OriginSeq, &b.DestinationSeq, &storedTravelDate, &b.Email, &b.Mobile, &b.Fare, &b.CreatedAt,
	)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == exclusionViolationCode {
			return Booking{}, ErrConflict
		}
		return Booking{}, fmt.Errorf("insert booking: %w", err)
	}

	b.TravelDate = storedTravelDate.Format(apiformat.DateFormat)
	return b, nil
}

// ErrNotFound means no booking exists with the given ID.
var ErrNotFound = errors.New("booking not found")

// GetByID looks up a confirmed booking by its ID - the only thing standing
// in for auth in this no-login system is the ID itself being an
// unguessable UUID, the same trust model as a real ticket reference number.
func (r *Repo) GetByID(ctx context.Context, id string) (Booking, error) {
	var b Booking
	var storedTravelDate time.Time
	err := r.pool.QueryRow(ctx, `
		SELECT id, seat_id, origin_seq, destination_seq, travel_date, email, mobile, fare, created_at
		FROM bookings
		WHERE id = $1
	`, id).Scan(
		&b.ID, &b.SeatID, &b.OriginSeq, &b.DestinationSeq, &storedTravelDate, &b.Email, &b.Mobile, &b.Fare, &b.CreatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Booking{}, ErrNotFound
		}
		return Booking{}, fmt.Errorf("get booking: %w", err)
	}

	b.TravelDate = storedTravelDate.Format(apiformat.DateFormat)
	return b, nil
}
