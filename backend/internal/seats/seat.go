package seats

// BookedRange is an existing booking's occupied leg on a seat, in the
// direction it was actually traveled: OriginSeq is where the passenger
// boards, DestinationSeq is where they alight - so OriginSeq > DestinationSeq
// for an inbound (e.g. Badulla -> Colombo Fort) booking.
type BookedRange struct {
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

// Overlaps reports whether two legs conflict: same travel direction and
// sharing at least one station. An outbound and an inbound leg never
// conflict, even over the same stations, since they're different trips.
func (a BookedRange) Overlaps(b BookedRange) bool {
	if a.Outbound() != b.Outbound() {
		return false
	}
	aMin, aMax := a.minMax()
	bMin, bMax := b.minMax()
	return aMin < bMax && bMin < aMax
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
