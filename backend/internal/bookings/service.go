package bookings

import (
	"context"
	"errors"
	"log"

	"github.com/MohamadNazik/Segment-Based-Train-Seat-Booking-System/backend/internal/cache"
)

// ErrHoldNotFound means the hold token is unknown or has already expired -
// the passenger's reservation window closed before they finished checkout.
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

// FinalizeBooking converts a hold into a confirmed booking: looks up the
// hold, runs a mock payment (always succeeds - no real payment integration
// in this core flow), and inserts the booking using the fare that was
// locked in at hold creation, not recalculated here. The hold is released
// either way afterward - on success it's no longer needed, and on a
// rejected insert (ErrConflict) it was built on now-stale information and
// must not keep showing the seat as merely "pending" when it's actually
// booked.
func (s *Service) FinalizeBooking(ctx context.Context, token, email, mobile string) (Booking, error) {
	h, err := s.holds.Get(ctx, token)
	if err != nil {
		if errors.Is(err, cache.ErrHoldNotFound) {
			return Booking{}, ErrHoldNotFound
		}
		return Booking{}, err
	}

	mockPay()

	booking, insertErr := s.repo.Insert(ctx, h.SeatID, h.OriginSeq, h.DestinationSeq, email, mobile, h.Fare)

	if cancelErr := s.holds.Cancel(ctx, token); cancelErr != nil && !errors.Is(cancelErr, cache.ErrHoldNotFound) {
		log.Printf("bookings.FinalizeBooking: release hold %s: %v", token, cancelErr)
	}

	if insertErr != nil {
		return Booking{}, insertErr
	}

	return booking, nil
}

// mockPay always succeeds - there's no real payment integration in the core
// flow. "Cancel" is the real, testable path that exercises releasing a hold
// early; a separate simulated-failure path isn't needed to prove that logic.
func mockPay() {}
