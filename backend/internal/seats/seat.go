package seats

import "time"

// BookedRange is an occupied leg on a seat/date, in the direction actually
// traveled - OriginSeq > DestinationSeq for an inbound booking.
type BookedRange struct {
	TravelDate     time.Time
	OriginSeq      int
	DestinationSeq int
}

// Outbound reports whether this leg travels toward increasing station
// sequence (e.g. Colombo Fort -> Badulla) rather than the reverse.
func (a BookedRange) Outbound() bool {
	return a.OriginSeq < a.DestinationSeq
}

// minMax returns the leg's station range regardless of direction.
func (a BookedRange) minMax() (int, int) {
	if a.OriginSeq < a.DestinationSeq {
		return a.OriginSeq, a.DestinationSeq
	}
	return a.DestinationSeq, a.OriginSeq
}

// Overlaps reports whether two legs conflict: same date, same direction,
// and sharing at least one station.
func (a BookedRange) Overlaps(b BookedRange) bool {
	if !a.TravelDate.Equal(b.TravelDate) {
		return false
	}
	if a.Outbound() != b.Outbound() {
		return false
	}
	aMin, aMax := a.minMax()
	bMin, bMax := b.minMax()
	return aMin < bMax && bMin < aMax
}

// Availability is one reserved seat's priced fare for a requested leg.
// Status is always "available" today (Service.Availability filters out the
// rest), kept as a field for a future seat-map view.
type Availability struct {
	SeatID     string  `json:"seat_id"`
	CoachCode  string  `json:"coach_code"`
	SeatNumber int     `json:"seat_number"`
	Status     string  `json:"status"`
	Fare       float64 `json:"fare"`
}
