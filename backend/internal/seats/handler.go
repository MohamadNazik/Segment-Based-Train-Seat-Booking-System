package seats

import (
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"time"

	"github.com/MohamadNazik/Segment-Based-Train-Seat-Booking-System/backend/internal/apiformat"
)

type Handler struct {
	service *Service
}

func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

// Availability handles GET /api/v1/availability?origin=CODE&destination=CODE&date=YYYY-MM-DD.
func (h *Handler) Availability(w http.ResponseWriter, r *http.Request) {
	originCode := r.URL.Query().Get("origin")
	destCode := r.URL.Query().Get("destination")
	dateStr := r.URL.Query().Get("date")
	if originCode == "" || destCode == "" || dateStr == "" {
		http.Error(w, "origin, destination, and date query params are required", http.StatusBadRequest)
		return
	}

	travelDate, err := time.Parse(apiformat.DateFormat, dateStr)
	if err != nil {
		http.Error(w, "date must be in YYYY-MM-DD format", http.StatusBadRequest)
		return
	}

	result, err := h.service.Availability(r.Context(), originCode, destCode, travelDate)
	if err != nil {
		var valErr *ValidationError
		if errors.As(err, &valErr) {
			http.Error(w, valErr.Error(), http.StatusBadRequest)
			return
		}
		log.Printf("seats.Availability: %v", err)
		http.Error(w, "failed to compute availability", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(result); err != nil {
		log.Printf("seats.Availability: encode response: %v", err)
	}
}
