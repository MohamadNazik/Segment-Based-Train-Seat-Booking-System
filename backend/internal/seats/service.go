package seats

import (
	"context"

	"github.com/MohamadNazik/Segment-Based-Train-Seat-Booking-System/backend/internal/stations"
)

// ValidationError marks a failure caused by bad input (unknown station code,
// wrong leg order) rather than an internal failure, so callers - HTTP
// handlers today, the holds service later - can tell the two apart and
// respond with 400 vs 500 without inspecting error strings.
type ValidationError struct {
	msg string
}

func (e *ValidationError) Error() string { return e.msg }

func newValidationError(msg string) error { return &ValidationError{msg: msg} }

type Service struct {
	repo              *Repo
	stationsRepo      *stations.Repo
	ratePerKm         float64
	fragmentationRate float64
}

func NewService(repo *Repo, stationsRepo *stations.Repo, ratePerKm, fragmentationRate float64) *Service {
	return &Service{
		repo:              repo,
		stationsRepo:      stationsRepo,
		ratePerKm:         ratePerKm,
		fragmentationRate: fragmentationRate,
	}
}

// Availability resolves a leg by station code and returns every reserved
// seat's status and priced fare for it. This is the shared orchestration
// the holds service (commit 5/6) will reuse to validate and price a
// candidate seat/segment before creating a hold, so it deliberately doesn't
// know anything about HTTP.
func (s *Service) Availability(ctx context.Context, originCode, destCode string) ([]Availability, error) {
	allStations, err := s.stationsRepo.List(ctx)
	if err != nil {
		return nil, err
	}

	distanceBySeq := make(map[int]float64, len(allStations))
	var origin, destination *stations.Station
	firstSeq, lastSeq := 0, 0
	for i := range allStations {
		st := &allStations[i]
		distanceBySeq[st.Sequence] = st.DistanceKm
		if i == 0 || st.Sequence < firstSeq {
			firstSeq = st.Sequence
		}
		if i == 0 || st.Sequence > lastSeq {
			lastSeq = st.Sequence
		}
		if st.Code == originCode {
			origin = st
		}
		if st.Code == destCode {
			destination = st
		}
	}

	if origin == nil || destination == nil {
		return nil, newValidationError("unknown origin or destination station code")
	}
	if origin.Sequence == destination.Sequence {
		return nil, newValidationError("origin and destination must be different stations")
	}

	reservedSeats, err := s.repo.ListReserved(ctx)
	if err != nil {
		return nil, err
	}

	seatIDs := make([]string, len(reservedSeats))
	for i, seat := range reservedSeats {
		seatIDs[i] = seat.ID
	}

	bookingsBySeat, err := s.repo.BookingsForSeats(ctx, seatIDs)
	if err != nil {
		return nil, err
	}

	requested := BookedRange{OriginSeq: origin.Sequence, DestinationSeq: destination.Sequence}

	result := make([]Availability, 0, len(reservedSeats))
	for _, seat := range reservedSeats {
		seatBookings := bookingsBySeat[seat.ID]

		status := "available"
		for _, b := range seatBookings {
			if b.Overlaps(requested) {
				status = "booked"
				break
			}
		}

		fare := CalculateFare(FareParams{
			OriginSeq:         origin.Sequence,
			DestinationSeq:    destination.Sequence,
			FirstSeq:          firstSeq,
			LastSeq:           lastSeq,
			DistanceBySeq:     distanceBySeq,
			RatePerKm:         s.ratePerKm,
			FragmentationRate: s.fragmentationRate,
		}, seatBookings)

		result = append(result, Availability{
			SeatID:     seat.ID,
			CoachCode:  seat.CoachCode,
			SeatNumber: seat.SeatNumber,
			Status:     status,
			Fare:       fare,
		})
	}

	return result, nil
}
