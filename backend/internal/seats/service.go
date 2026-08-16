package seats

import (
	"context"
	"time"

	"github.com/MohamadNazik/Segment-Based-Train-Seat-Booking-System/backend/internal/cache"
	"github.com/MohamadNazik/Segment-Based-Train-Seat-Booking-System/backend/internal/stations"
)

// ValidationError marks bad input (vs. an internal failure), so callers can
// respond 400 vs 500 without inspecting error strings.
type ValidationError struct {
	msg string
}

func (e *ValidationError) Error() string { return e.msg }

func newValidationError(msg string) error { return &ValidationError{msg: msg} }

// ErrSeatNotReserved means the seat ID doesn't exist or isn't in a reserved coach.
type ErrSeatNotReserved struct{}

func (ErrSeatNotReserved) Error() string { return "seat not found or not reservable" }

// HoldReader avoids an import cycle: cache.HoldStore satisfies this
// structurally without cache importing seats.
type HoldReader interface {
	AllHolds(ctx context.Context) (map[string][]cache.HoldRange, error)
}

type Service struct {
	repo              *Repo
	stationsRepo      *stations.Repo
	holdReader        HoldReader
	ratePerKm         float64
	fragmentationRate float64
}

func NewService(repo *Repo, stationsRepo *stations.Repo, holdReader HoldReader, ratePerKm, fragmentationRate float64) *Service {
	return &Service{
		repo:              repo,
		stationsRepo:      stationsRepo,
		holdReader:        holdReader,
		ratePerKm:         ratePerKm,
		fragmentationRate: fragmentationRate,
	}
}

// leg is a resolved origin/destination/date, ready for pricing.
type leg struct {
	travelDate     time.Time
	originSeq      int
	destinationSeq int
	firstSeq       int
	lastSeq        int
	distanceBySeq  map[int]float64
}

func (s *Service) resolveLeg(ctx context.Context, originCode, destCode string, travelDate time.Time) (leg, error) {
	today := time.Now().UTC().Truncate(24 * time.Hour)
	if travelDate.Before(today) {
		return leg{}, newValidationError("travel date must not be in the past")
	}

	allStations, err := s.stationsRepo.List(ctx)
	if err != nil {
		return leg{}, err
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
		return leg{}, newValidationError("unknown origin or destination station code")
	}
	if origin.Sequence == destination.Sequence {
		return leg{}, newValidationError("origin and destination must be different stations")
	}

	return leg{
		travelDate:     travelDate,
		originSeq:      origin.Sequence,
		destinationSeq: destination.Sequence,
		firstSeq:       firstSeq,
		lastSeq:        lastSeq,
		distanceBySeq:  distanceBySeq,
	}, nil
}

// priceOne decides one seat's status and fare for lg. A confirmed booking
// always beats a pending hold for status, but both count as fragmentation
// neighbors when pricing - a hold boxes in capacity just as much until
// it's released or expires.
func (s *Service) priceOne(lg leg, bookings, holds []BookedRange) (status string, fare float64) {
	requested := BookedRange{TravelDate: lg.travelDate, OriginSeq: lg.originSeq, DestinationSeq: lg.destinationSeq}

	status = "available"
	for _, b := range bookings {
		if b.Overlaps(requested) {
			status = "booked"
			break
		}
	}
	if status == "available" {
		for _, h := range holds {
			if h.Overlaps(requested) {
				status = "pending"
				break
			}
		}
	}

	neighbors := make([]BookedRange, 0, len(bookings)+len(holds))
	neighbors = append(neighbors, bookings...)
	neighbors = append(neighbors, holds...)

	fare = CalculateFare(FareParams{
		TravelDate:        lg.travelDate,
		OriginSeq:         lg.originSeq,
		DestinationSeq:    lg.destinationSeq,
		FirstSeq:          lg.firstSeq,
		LastSeq:           lg.lastSeq,
		DistanceBySeq:     lg.distanceBySeq,
		RatePerKm:         s.ratePerKm,
		FragmentationRate: s.fragmentationRate,
	}, neighbors)

	return status, fare
}

func toBookedRanges(holds []cache.HoldRange) []BookedRange {
	out := make([]BookedRange, len(holds))
	for i, h := range holds {
		out[i] = BookedRange{TravelDate: h.TravelDate, OriginSeq: h.OriginSeq, DestinationSeq: h.DestinationSeq}
	}
	return out
}

// Availability returns every reserved seat actually available for the leg,
// with its priced fare. Booked/pending seats are filtered out.
func (s *Service) Availability(ctx context.Context, originCode, destCode string, travelDate time.Time) ([]Availability, error) {
	lg, err := s.resolveLeg(ctx, originCode, destCode, travelDate)
	if err != nil {
		return nil, err
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

	holdsBySeat, err := s.holdReader.AllHolds(ctx)
	if err != nil {
		return nil, err
	}

	result := make([]Availability, 0, len(reservedSeats))
	for _, seat := range reservedSeats {
		status, fare := s.priceOne(lg, bookingsBySeat[seat.ID], toBookedRanges(holdsBySeat[seat.ID]))
		if status != "available" {
			continue
		}

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

// LegPrice is one seat's resolved leg, status, and fare, for hold creation.
type LegPrice struct {
	TravelDate     time.Time
	OriginSeq      int
	DestinationSeq int
	Status         string
	Fare           float64
}

// CheckSeat is Availability narrowed to one seat, returning its actual
// status (including booked/pending) so the caller can explain a refusal.
func (s *Service) CheckSeat(ctx context.Context, seatID, originCode, destCode string, travelDate time.Time) (LegPrice, error) {
	lg, err := s.resolveLeg(ctx, originCode, destCode, travelDate)
	if err != nil {
		return LegPrice{}, err
	}

	if _, ok, err := s.repo.GetReserved(ctx, seatID); err != nil {
		return LegPrice{}, err
	} else if !ok {
		return LegPrice{}, ErrSeatNotReserved{}
	}

	bookingsBySeat, err := s.repo.BookingsForSeats(ctx, []string{seatID})
	if err != nil {
		return LegPrice{}, err
	}

	holdsBySeat, err := s.holdReader.AllHolds(ctx)
	if err != nil {
		return LegPrice{}, err
	}

	status, fare := s.priceOne(lg, bookingsBySeat[seatID], toBookedRanges(holdsBySeat[seatID]))

	return LegPrice{
		TravelDate:     lg.travelDate,
		OriginSeq:      lg.originSeq,
		DestinationSeq: lg.destinationSeq,
		Status:         status,
		Fare:           fare,
	}, nil
}
