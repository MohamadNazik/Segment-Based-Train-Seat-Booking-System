package bookings

import (
	"context"
	"errors"
	"log"

	"github.com/MohamadNazik/Segment-Based-Train-Seat-Booking-System/backend/internal/cache"
)

// ErrHoldNotFound means the hold token is unknown or has already expired.
var ErrHoldNotFound = errors.New("hold not found or expired")

// HoldStore is the subset of cache.HoldStore this service needs.
type HoldStore interface {
	Get(ctx context.Context, token string) (cache.Hold, error)
	Cancel(ctx context.Context, token string) error
}

type Service struct {
	holds HoldStore
	repo  *Repo
}

func NewService(holds HoldStore, repo *Repo) *Service {
	return &Service{holds: holds, repo: repo}
}

// FinalizeBooking converts a hold into a confirmed booking, using the fare
// locked in at hold creation rather than recalculating. The hold is
// released either way afterward, even on a rejected insert, so a
// now-stale hold never keeps showing an actually-booked seat as pending.
func (s *Service) FinalizeBooking(ctx context.Context, token, email, mobile string) (Booking, error) {
	h, err := s.holds.Get(ctx, token)
	if err != nil {
		if errors.Is(err, cache.ErrHoldNotFound) {
			return Booking{}, ErrHoldNotFound
		}
		return Booking{}, err
	}

	mockPay()

	booking, insertErr := s.repo.Insert(ctx, h.SeatID, h.OriginSeq, h.DestinationSeq, h.TravelDate, email, mobile, h.Fare)

	if cancelErr := s.holds.Cancel(ctx, token); cancelErr != nil && !errors.Is(cancelErr, cache.ErrHoldNotFound) {
		log.Printf("bookings.FinalizeBooking: release hold %s: %v", token, cancelErr)
	}

	if insertErr != nil {
		return Booking{}, insertErr
	}

	return booking, nil
}

// mockPay always succeeds - no real payment integration in the core flow.
func mockPay() {}

// GetBooking looks up a confirmed booking by ID, for the standalone
// confirmation page (refreshable/shareable via a link, unlike checkout).
func (s *Service) GetBooking(ctx context.Context, id string) (Booking, error) {
	return s.repo.GetByID(ctx, id)
}
