package seats

// BookedRange is an existing booking's occupied leg on a seat, expressed as
// the same half-open [OriginSeq, DestinationSeq) range stored in bookings.
type BookedRange struct {
	OriginSeq      int
	DestinationSeq int
}

// Overlaps reports whether two half-open ranges share any station.
func (a BookedRange) Overlaps(b BookedRange) bool {
	return a.OriginSeq < b.DestinationSeq && b.OriginSeq < a.DestinationSeq
}

// Availability is one reserved seat's status and priced fare for a
// requested leg.
type Availability struct {
	SeatID     string  `json:"seat_id"`
	CoachCode  string  `json:"coach_code"`
	SeatNumber int     `json:"seat_number"`
	Status     string  `json:"status"` // "available" | "booked"
	Fare       float64 `json:"fare"`
}
