package seats

import "math"

// FareParams bundles the station-derived inputs the fare calculation needs.
type FareParams struct {
	OriginSeq         int
	DestinationSeq    int
	FirstSeq          int // sequence of the line's first station
	LastSeq           int // sequence of the line's last station
	DistanceBySeq     map[int]float64
	RatePerKm         float64
	FragmentationRate float64
}

// CalculateFare prices [OriginSeq, DestinationSeq) on a seat: the base
// distance fare, plus a surcharge for any capacity this choice boxes in
// between the new leg and the seat's nearest neighboring bookings.
//
// A side only counts as boxed in - and therefore wasted - when it's bounded
// by another booking on that seat rather than by the line's actual start or
// end: capacity still open toward the line's terminus is just ordinary
// remaining capacity, not lost revenue, however large it is. A seat with no
// bookings at all never carries a surcharge, regardless of which sub-leg is
// requested.
func CalculateFare(p FareParams, seatBookings []BookedRange) float64 {
	fare := p.RatePerKm * (p.DistanceBySeq[p.DestinationSeq] - p.DistanceBySeq[p.OriginSeq])

	leftBound := p.FirstSeq
	rightBound := p.LastSeq
	for _, b := range seatBookings {
		if b.DestinationSeq <= p.OriginSeq && b.DestinationSeq > leftBound {
			leftBound = b.DestinationSeq
		}
		if b.OriginSeq >= p.DestinationSeq && b.OriginSeq < rightBound {
			rightBound = b.OriginSeq
		}
	}

	if leftBound != p.FirstSeq && leftBound < p.OriginSeq {
		gapKm := p.DistanceBySeq[p.OriginSeq] - p.DistanceBySeq[leftBound]
		fare += p.FragmentationRate * p.RatePerKm * gapKm
	}
	if rightBound != p.LastSeq && rightBound > p.DestinationSeq {
		gapKm := p.DistanceBySeq[rightBound] - p.DistanceBySeq[p.DestinationSeq]
		fare += p.FragmentationRate * p.RatePerKm * gapKm
	}

	return math.Round(fare*100) / 100
}
