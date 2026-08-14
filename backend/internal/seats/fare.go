package seats

import "math"

// FareParams bundles the station-derived inputs the fare calculation needs.
// OriginSeq/DestinationSeq are the candidate leg's actual boarding/alighting
// stations - OriginSeq may be greater than DestinationSeq for an inbound leg.
type FareParams struct {
	OriginSeq         int
	DestinationSeq    int
	FirstSeq          int // sequence of the line's first station
	LastSeq           int // sequence of the line's last station
	DistanceBySeq     map[int]float64
	RatePerKm         float64
	FragmentationRate float64
}

// CalculateFare prices a candidate leg on a seat: the base distance fare,
// plus a surcharge for any capacity this choice boxes in between the new
// leg and the seat's nearest neighboring bookings *in the same travel
// direction* - an opposite-direction booking on the same seat is a
// different trip and never counts as a neighbor here.
//
// A side only counts as boxed in - and therefore wasted - when it's bounded
// by another same-direction booking on that seat rather than by the line's
// actual start or end: capacity still open toward the line's terminus is
// just ordinary remaining capacity, not lost revenue, however large it is.
// A seat with no bookings in this direction never carries a surcharge,
// regardless of which sub-leg is requested.
func CalculateFare(p FareParams, seatBookings []BookedRange) float64 {
	candidate := BookedRange{OriginSeq: p.OriginSeq, DestinationSeq: p.DestinationSeq}
	candidateMin, candidateMax := candidate.minMax()

	fare := p.RatePerKm * math.Abs(p.DistanceBySeq[p.DestinationSeq]-p.DistanceBySeq[p.OriginSeq])

	leftBound := p.FirstSeq
	rightBound := p.LastSeq
	for _, b := range seatBookings {
		if b.Outbound() != candidate.Outbound() {
			continue // different trip direction - not a neighbor on this timeline
		}
		bMin, bMax := b.minMax()
		if bMax <= candidateMin && bMax > leftBound {
			leftBound = bMax
		}
		if bMin >= candidateMax && bMin < rightBound {
			rightBound = bMin
		}
	}

	if leftBound != p.FirstSeq && leftBound < candidateMin {
		gapKm := p.DistanceBySeq[candidateMin] - p.DistanceBySeq[leftBound]
		fare += p.FragmentationRate * p.RatePerKm * gapKm
	}
	if rightBound != p.LastSeq && rightBound > candidateMax {
		gapKm := p.DistanceBySeq[rightBound] - p.DistanceBySeq[candidateMax]
		fare += p.FragmentationRate * p.RatePerKm * gapKm
	}

	return math.Round(fare*100) / 100
}
