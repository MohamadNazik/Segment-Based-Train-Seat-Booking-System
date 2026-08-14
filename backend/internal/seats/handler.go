package seats

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

// Availability handles GET /api/availability?origin=CODE&destination=CODE.
func (h *Handler) Availability(w http.ResponseWriter, r *http.Request) {
	originCode := r.URL.Query().Get("origin")
	destCode := r.URL.Query().Get("destination")
	if originCode == "" || destCode == "" {
		http.Error(w, "origin and destination query params are required", http.StatusBadRequest)
		return
	}

	result, err := h.service.Availability(r.Context(), originCode, destCode)
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
