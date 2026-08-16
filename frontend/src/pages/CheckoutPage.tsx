import { useEffect, useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import type { AvailableSeat, Hold } from '../api/types'
import { ApiError, cancelHold, createBooking } from '../api/client'
import { useCountdown } from '../hooks/useCountdown'
import { BTN_PRIMARY, BTN_SECONDARY, ERROR_BANNER } from '../styles'

// Handed over via navigation state, not the URL - a hold token is a
// one-time proof of "you created this hold" and shouldn't end up in a
// shareable/bookmarkable link the way the search itself does. returnTo is
// the search+coach URL the seat was picked from, so releasing the hold
// (cancel, expiry, or a rejected finalize) can land the passenger back on
// that same seat list rather than a blank landing page.
interface CheckoutState {
  hold: Hold
  seat: AvailableSeat
  returnTo: string
}

// Same two-layer gradient treatment as the landing hero - see
// LandingSearch.tsx for why this stays an inline style instead of a
// Tailwind utility.
const HERO_BACKGROUND = {
  backgroundImage:
    'linear-gradient(to bottom, rgba(10,20,15,0.55) 0%, rgba(10,20,15,0.25) 45%, rgba(10,20,15,0.65) 100%), ' +
    'radial-gradient(circle at 25% 15%, #3d8a5c 0%, #1c5c3a 45%, #0a2e1c 100%)',
}

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export default function CheckoutPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const state = location.state as CheckoutState | null

  const [email, setEmail] = useState('')
  const [mobile, setMobile] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cancelling, setCancelling] = useState(false)

  // A direct/typed visit to /checkout (or any navigation here that didn't
  // come from picking a seat) has no hold to check out - bounce back to
  // search instead of rendering a broken form.
  useEffect(() => {
    if (!state) navigate('/', { replace: true })
  }, [state, navigate])

  function release(returnTo: string, notice: string) {
    navigate(returnTo, { state: { notice } })
  }

  const remaining = useCountdown(state?.hold.expires_at ?? new Date().toISOString(), () => {
    if (state) release(state.returnTo, 'Your seat hold expired before payment was completed. Please select a seat again.')
  })

  if (!state) return null

  const { hold, seat, returnTo } = state

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const booking = await createBooking(hold.hold_token, email, mobile)
      navigate(`/booking/${booking.id}`, { state: { booking } })
    } catch (err) {
      if (err instanceof ApiError && (err.status === 409 || err.status === 410)) {
        release(returnTo, 'This seat is no longer available. Please select a seat again.')
        return
      }
      setError(err instanceof Error ? err.message : 'Payment failed, please try again.')
      setSubmitting(false)
    }
  }

  async function handleCancel() {
    setCancelling(true)
    try {
      await cancelHold(hold.hold_token)
    } catch {
      // best-effort - the hold will simply expire on its own otherwise
    }
    release(returnTo, '')
  }

  const urgent = remaining <= 60

  return (
    <section
      className="flex flex-1 flex-col items-center justify-start px-6 pb-12 pt-10 text-center text-white"
      style={HERO_BACKGROUND}
    >
      <div className="w-full max-w-150">
        <h1 className="mb-3 text-[clamp(1.8rem,4vw,2.6rem)] font-extrabold text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.4)]">
          Complete Your Booking
        </h1>
        <p className="mb-2 text-[1.05rem] text-white/90 drop-shadow-[0_1px_6px_rgba(0,0,0,0.4)]">
          Coach {seat.coach_code}, Seat {seat.seat_number} &middot; {hold.travel_date}
        </p>

        <div className="mt-5 w-full rounded-[18px] bg-[#f2efe8] p-6 text-left shadow-[0_20px_40px_rgba(0,0,0,0.25)]">
          <div
            className={`mb-5 rounded-lg border px-4 py-3 text-sm ${
              urgent ? 'border-danger bg-danger-bg text-danger' : 'border-accent bg-accent/10 text-accent-dark'
            }`}
            aria-live="polite"
          >
            Complete payment within <strong>{formatTime(remaining)}</strong> or this seat will be released
          </div>

          <p className="mb-5 text-lg font-semibold text-ink">Fare: LKR {hold.fare.toFixed(2)}</p>

          <form className="grid gap-4" onSubmit={handleSubmit}>
            <h3 className="text-ink">Passenger details</h3>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="email" className="text-sm font-semibold text-ink-soft">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="rounded-[10px] border border-border bg-surface px-3 py-2.5 text-ink"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="mobile" className="text-sm font-semibold text-ink-soft">
                Mobile
              </label>
              <input
                id="mobile"
                type="tel"
                required
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                className="rounded-[10px] border border-border bg-surface px-3 py-2.5 text-ink"
              />
            </div>

            <h3 className="mt-2 text-ink">Payment</h3>
            <p className="text-sm text-ink-soft">This is a mock payment for demonstration purposes.</p>

            {error && (
              <p className={ERROR_BANNER} role="alert">
                {error}
              </p>
            )}

            <div className="flex justify-end gap-3">
              <button type="button" className={BTN_SECONDARY} onClick={handleCancel} disabled={cancelling || submitting}>
                Cancel
              </button>
              <button type="submit" className={BTN_PRIMARY} disabled={submitting}>
                {submitting ? 'Processing…' : `Pay LKR ${hold.fare.toFixed(2)}`}
              </button>
            </div>
          </form>
        </div>
      </div>
    </section>
  )
}
