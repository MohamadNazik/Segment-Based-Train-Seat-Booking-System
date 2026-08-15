package seats

import "time"

// BookedRange is an existing booking's occupied leg on a seat and date, in
// the direction it was actually traveled: OriginSeq is where the passenger
// boards, DestinationSeq is where they alight - so OriginSeq > DestinationSeq
// for an inbound (e.g. Badulla -> Colombo Fort) booking.
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

// minMax returns the leg's station range regardless of travel direction -
// what's physically occupied on the line.
func (a BookedRange) minMax() (int, int) {
	if a.OriginSeq < a.DestinationSeq {
		return a.OriginSeq, a.DestinationSeq
	}
	return a.DestinationSeq, a.OriginSeq
}

// Overlaps reports whether two legs conflict: same travel date, same
// direction, and sharing at least one station. Different dates never
// conflict (different trips entirely), and neither do opposite directions
// on the same date, even over the same stations.
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
// Only available seats are ever returned to the client - see
// Service.Availability - so Status is always "available" today, but kept
// as an explicit field rather than removed, since a future seat-map view
// showing taken seats would need it back.
type Availability struct {
	SeatID     string  `json:"seat_id"`
	CoachCode  string  `json:"coach_code"`
	SeatNumber int     `json:"seat_number"`
	Status     string  `json:"status"`
	Fare       float64 `json:"fare"`
}
