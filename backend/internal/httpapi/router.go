package httpapi

import "net/http"

// NewRouter wires up all HTTP routes. Business routes are added in later commits;
// for now it just exposes a health check used to verify the service boots.
func NewRouter() *http.ServeMux {
	mux := http.NewServeMux()

	mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status":"ok"}`))
	})

	return mux
}
