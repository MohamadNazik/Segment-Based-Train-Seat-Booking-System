package seats

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"
)

type ReservedSeat struct {
	ID         string
	CoachCode  string
	SeatNumber int
}

type Repo struct {
	pool *pgxpool.Pool
}

func NewRepo(pool *pgxpool.Pool) *Repo {
	return &Repo{pool: pool}
}

// ListReserved returns every seat belonging to a reserved coach. Unreserved
// coaches have no rows in seats at all, so nothing to exclude here.
func (r *Repo) ListReserved(ctx context.Context) ([]ReservedSeat, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT s.id, c.code, s.seat_number
		FROM seats s
		JOIN coaches c ON c.id = s.coach_id
		WHERE c.type = 'reserved'
		ORDER BY c.code, s.seat_number
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []ReservedSeat
	for rows.Next() {
		var s ReservedSeat
		if err := rows.Scan(&s.ID, &s.CoachCode, &s.SeatNumber); err != nil {
			return nil, err
		}
		out = append(out, s)
	}
	return out, rows.Err()
}

// BookingsForSeats returns every booking on the given seats, grouped by
// seat ID - including ones that don't overlap the leg being queried, since
// the fragmentation fare calc needs each seat's nearest neighboring
// bookings, not just the ones that conflict.
func (r *Repo) BookingsForSeats(ctx context.Context, seatIDs []string) (map[string][]BookedRange, error) {
	out := make(map[string][]BookedRange, len(seatIDs))
	if len(seatIDs) == 0 {
		return out, nil
	}

	rows, err := r.pool.Query(ctx, `
		SELECT seat_id, origin_seq, destination_seq
		FROM bookings
		WHERE seat_id = ANY($1)
	`, seatIDs)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var seatID string
		var br BookedRange
		if err := rows.Scan(&seatID, &br.OriginSeq, &br.DestinationSeq); err != nil {
			return nil, err
		}
		out[seatID] = append(out[seatID], br)
	}
	return out, rows.Err()
}
