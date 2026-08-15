package httpapi

import (
	"net/http"

	"github.com/MohamadNazik/Segment-Based-Train-Seat-Booking-System/backend/internal/bookings"
	"github.com/MohamadNazik/Segment-Based-Train-Seat-Booking-System/backend/internal/holds"
	"github.com/MohamadNazik/Segment-Based-Train-Seat-Booking-System/backend/internal/seats"
	"github.com/MohamadNazik/Segment-Based-Train-Seat-Booking-System/backend/internal/stations"
)

// Deps holds the handlers NewRouter wires up. Kept as a struct rather than
// a long parameter list so adding a new resource's handler later is a
// one-line change here, not a signature change everywhere it's called.
type Deps struct {
	Stations *stations.Handler
	Seats    *seats.Handler
	Holds    *holds.Handler
	Bookings *bookings.Handler
}

func NewRouter(deps Deps) *http.ServeMux {
	mux := http.NewServeMux()

	mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status":"ok"}`))
	})

	mux.HandleFunc("GET /api/v1/stations", deps.Stations.List)
	mux.HandleFunc("GET /api/v1/availability", deps.Seats.Availability)
	mux.HandleFunc("POST /api/v1/holds", deps.Holds.Create)
	mux.HandleFunc("POST /api/v1/holds/{token}/cancel", deps.Holds.Cancel)
	mux.HandleFunc("POST /api/v1/bookings", deps.Bookings.Create)

	return mux
}
