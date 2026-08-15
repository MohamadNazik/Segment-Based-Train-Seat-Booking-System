package holds

import "time"

// Hold is what a successful hold creation returns to the client.
type Hold struct {
	Token     string    `json:"hold_token"`
	Fare      float64   `json:"fare"`
	ExpiresAt time.Time `json:"expires_at"`
}
