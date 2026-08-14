package stations

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Repo struct {
	pool *pgxpool.Pool
}

func NewRepo(pool *pgxpool.Pool) *Repo {
	return &Repo{pool: pool}
}

// List returns every station on the line, ordered by its position along it.
func (r *Repo) List(ctx context.Context) ([]Station, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id, code, name, sequence, distance_km
		FROM stations
		ORDER BY sequence
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []Station
	for rows.Next() {
		var s Station
		if err := rows.Scan(&s.ID, &s.Code, &s.Name, &s.Sequence, &s.DistanceKm); err != nil {
			return nil, err
		}
		out = append(out, s)
	}
	return out, rows.Err()
}
