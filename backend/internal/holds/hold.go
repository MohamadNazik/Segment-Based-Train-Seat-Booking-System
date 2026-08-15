package holds

import "time"

// Hold is what a successful hold creation returns to the client.
type Hold struct {
	Token      string    `json:"hold_token"`
	TravelDate string    `json:"travel_date"`
	Fare       float64   `json:"fare"`
	ExpiresAt  time.Time `json:"expires_at"`
}
