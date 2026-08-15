package holds

import (
	"encoding/json"
	"errors"
	"log"
	"net/http"

	"github.com/MohamadNazik/Segment-Based-Train-Seat-Booking-System/backend/internal/seats"
)

type Handler struct {
	service *Service
}

func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

type createRequest struct {
	SeatID      string `json:"seat_id"`
	Origin      string `json:"origin"`
	Destination string `json:"destination"`
}

// Create handles POST /api/v1/holds.
func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	var req createRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if req.SeatID == "" || req.Origin == "" || req.Destination == "" {
		http.Error(w, "seat_id, origin, and destination are required", http.StatusBadRequest)
		return
	}

	hold, err := h.service.CreateHold(r.Context(), req.SeatID, req.Origin, req.Destination)
	if err != nil {
		var valErr *seats.ValidationError
		var conflictErr *ErrConflict
		switch {
		case errors.As(err, &valErr):
			http.Error(w, valErr.Error(), http.StatusBadRequest)
		case errors.Is(err, ErrSeatNotFound):
			http.Error(w, err.Error(), http.StatusNotFound)
		case errors.As(err, &conflictErr):
			http.Error(w, conflictErr.Error(), http.StatusConflict)
		default:
			log.Printf("holds.Create: %v", err)
			http.Error(w, "failed to create hold", http.StatusInternalServerError)
		}
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	if err := json.NewEncoder(w).Encode(hold); err != nil {
		log.Printf("holds.Create: encode response: %v", err)
	}
}

// Cancel handles POST /api/v1/holds/{token}/cancel.
func (h *Handler) Cancel(w http.ResponseWriter, r *http.Request) {
	token := r.PathValue("token")
	if token == "" {
		http.Error(w, "token is required", http.StatusBadRequest)
		return
	}

	if err := h.service.CancelHold(r.Context(), token); err != nil {
		if errors.Is(err, ErrHoldNotFound) {
			http.Error(w, err.Error(), http.StatusNotFound)
			return
		}
		log.Printf("holds.Cancel: %v", err)
		http.Error(w, "failed to cancel hold", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
