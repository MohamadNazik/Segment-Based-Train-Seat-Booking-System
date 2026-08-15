package bookings

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

// ErrConflict means the exclusion constraint rejected the insert - the seat
// is no longer available for this leg/direction. This is the defense-in-depth
// backstop: it should be rare in practice, since a hold already reserved the
// seat, but it's what guarantees a double-booking can never actually be
// persisted regardless of what happens upstream.
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
func (r *Repo) Insert(ctx context.Context, seatID string, originSeq, destinationSeq int, email, mobile string, fare float64) (Booking, error) {
	var b Booking
	err := r.pool.QueryRow(ctx, `
		INSERT INTO bookings (seat_id, origin_seq, destination_seq, email, mobile, fare)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id, seat_id, origin_seq, destination_seq, email, mobile, fare, created_at
	`, seatID, originSeq, destinationSeq, email, mobile, fare).Scan(
		&b.ID, &b.SeatID, &b.OriginSeq, &b.DestinationSeq, &b.Email, &b.Mobile, &b.Fare, &b.CreatedAt,
	)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == exclusionViolationCode {
			return Booking{}, ErrConflict
		}
		return Booking{}, fmt.Errorf("insert booking: %w", err)
	}

	return b, nil
}
