package seats

import (
	"context"

	"github.com/MohamadNazik/Segment-Based-Train-Seat-Booking-System/backend/internal/cache"
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

// ErrSeatNotReserved marks a seat ID that doesn't exist, or exists but
// belongs to an unreserved coach - either way, not something that can be
// held or booked at the seat level.
type ErrSeatNotReserved struct{}

func (ErrSeatNotReserved) Error() string { return "seat not found or not reservable" }

// HoldReader is the seats package's view of active holds - just enough to
// compute three-state availability and fragmentation pricing. Defined here
// (not in cache) because Go convention is to declare interfaces where
// they're consumed; cache.HoldStore satisfies this structurally without
// cache importing seats, which is what keeps seats -> cache -> (nothing)
// and holds -> seats, holds -> cache from ever forming a cycle.
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

// leg is a resolved origin/destination pair plus everything needed to price
// any seat against it.
type leg struct {
	originSeq      int
	destinationSeq int
	firstSeq       int
	lastSeq        int
	distanceBySeq  map[int]float64
}

func (s *Service) resolveLeg(ctx context.Context, originCode, destCode string) (leg, error) {
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
		originSeq:      origin.Sequence,
		destinationSeq: destination.Sequence,
		firstSeq:       firstSeq,
		lastSeq:        lastSeq,
		distanceBySeq:  distanceBySeq,
	}, nil
}

// priceOne decides one seat's status and fare for lg, given its existing
// confirmed bookings and active holds. Booked beats pending: a confirmed
// booking always wins status-wise even if a (now-meaningless) hold also
// happens to be present. Fare accounts for both as potential fragmentation
// neighbors, per the plan - a pending hold boxes in capacity just as much
// as a confirmed booking does, until it's released or expires.
func (s *Service) priceOne(lg leg, bookings, holds []BookedRange) (status string, fare float64) {
	requested := BookedRange{OriginSeq: lg.originSeq, DestinationSeq: lg.destinationSeq}

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
		out[i] = BookedRange{OriginSeq: h.OriginSeq, DestinationSeq: h.DestinationSeq}
	}
	return out
}

// Availability resolves a leg by station code and returns every reserved
// seat's status (available/pending/booked) and priced fare for it.
func (s *Service) Availability(ctx context.Context, originCode, destCode string) ([]Availability, error) {
	lg, err := s.resolveLeg(ctx, originCode, destCode)
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

// LegPrice is one specific seat's resolved leg, status, and fare - what the
// holds service needs to decide whether a hold can be created and, if so,
// what to lock in.
type LegPrice struct {
	OriginSeq      int
	DestinationSeq int
	Status         string
	Fare           float64
}

// CheckSeat is Availability narrowed to a single seat, reused by the holds
// service so hold creation is checked and priced with the exact same rules
// a passenger already saw in the availability list.
func (s *Service) CheckSeat(ctx context.Context, seatID, originCode, destCode string) (LegPrice, error) {
	lg, err := s.resolveLeg(ctx, originCode, destCode)
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
		OriginSeq:      lg.originSeq,
		DestinationSeq: lg.destinationSeq,
		Status:         status,
		Fare:           fare,
	}, nil
}
