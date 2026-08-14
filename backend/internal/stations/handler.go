package stations

import (
	"encoding/json"
	"log"
	"net/http"
)

type Handler struct {
	repo *Repo
}

func NewHandler(repo *Repo) *Handler {
	return &Handler{repo: repo}
}

func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	list, err := h.repo.List(r.Context())
	if err != nil {
		log.Printf("stations.List: %v", err)
		http.Error(w, "failed to load stations", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(list); err != nil {
		log.Printf("stations.List: encode response: %v", err)
	}
}
