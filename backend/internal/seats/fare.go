package seats

import (
	"math"
	"time"
)

// FareParams bundles the station-derived inputs the fare calculation needs.
// OriginSeq/DestinationSeq are the candidate leg's actual boarding/alighting
// stations - OriginSeq may be greater than DestinationSeq for an inbound leg.
type FareParams struct {
	TravelDate        time.Time
	OriginSeq         int
	DestinationSeq    int
	FirstSeq          int // sequence of the line's first station
	LastSeq           int // sequence of the line's last station
	DistanceBySeq     map[int]float64
	RatePerKm         float64
	FragmentationRate float64
}

// CalculateFare prices a candidate leg: base distance fare, plus a
// surcharge for any capacity it boxes in against the seat's nearest
// same-direction neighboring booking. A side only counts as boxed in when
// bounded by another booking, not by the line's actual start/end.
func CalculateFare(p FareParams, seatBookings []BookedRange) float64 {
	candidate := BookedRange{TravelDate: p.TravelDate, OriginSeq: p.OriginSeq, DestinationSeq: p.DestinationSeq}
	candidateMin, candidateMax := candidate.minMax()

	fare := p.RatePerKm * math.Abs(p.DistanceBySeq[p.DestinationSeq]-p.DistanceBySeq[p.OriginSeq])

	leftBound := p.FirstSeq
	rightBound := p.LastSeq
	for _, b := range seatBookings {
		if !b.TravelDate.Equal(candidate.TravelDate) || b.Outbound() != candidate.Outbound() {
			continue // different date or trip direction - not a neighbor on this timeline
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
