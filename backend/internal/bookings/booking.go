package bookings

import "time"

// Booking is a confirmed booking, returned to the client after finalization.
type Booking struct {
	ID             string    `json:"id"`
	SeatID         string    `json:"seat_id"`
	OriginSeq      int       `json:"origin_seq"`
	DestinationSeq int       `json:"destination_seq"`
	Email          string    `json:"email"`
	Mobile         string    `json:"mobile"`
	Fare           float64   `json:"fare"`
	CreatedAt      time.Time `json:"created_at"`
}
