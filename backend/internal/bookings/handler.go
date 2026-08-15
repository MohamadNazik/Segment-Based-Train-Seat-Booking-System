package bookings

import (
	"encoding/json"
	"errors"
	"log"
	"net/http"
)

type Handler struct {
	service *Service
}

func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

type createRequest struct {
	HoldToken string `json:"hold_token"`
	Email     string `json:"email"`
	Mobile    string `json:"mobile"`
}

// Create handles POST /api/v1/bookings.
func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	var req createRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if req.HoldToken == "" || req.Email == "" || req.Mobile == "" {
		http.Error(w, "hold_token, email, and mobile are required", http.StatusBadRequest)
		return
	}

	booking, err := h.service.FinalizeBooking(r.Context(), req.HoldToken, req.Email, req.Mobile)
	if err != nil {
		switch {
		case errors.Is(err, ErrHoldNotFound):
			http.Error(w, err.Error(), http.StatusGone)
		case errors.Is(err, ErrConflict):
			http.Error(w, err.Error(), http.StatusConflict)
		default:
			log.Printf("bookings.Create: %v", err)
			http.Error(w, "failed to create booking", http.StatusInternalServerError)
		}
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	if err := json.NewEncoder(w).Encode(booking); err != nil {
		log.Printf("bookings.Create: encode response: %v", err)
	}
}
