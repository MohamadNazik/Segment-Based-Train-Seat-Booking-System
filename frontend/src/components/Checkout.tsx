import { useState, type FormEvent } from 'react'
import type { AvailableSeat, Booking, Hold } from '../api/types'
import { ApiError, cancelHold, createBooking } from '../api/client'
import { useCountdown } from '../hooks/useCountdown'
import { BTN_PRIMARY, BTN_SECONDARY, ERROR_BANNER, PAGE, PAGE_SUBTITLE } from '../styles'

interface Props {
  hold: Hold
  seat: AvailableSeat
  onConfirmed: (booking: Booking) => void
  /** Called whenever the hold stops being usable - TTL expiry, a rejected
   * finalize (409/410), or the passenger cancelling manually. message is
   * empty for a manual cancel, where there's nothing to explain. */
  onReleased: (message: string) => void
}

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export default function Checkout({ hold, seat, onConfirmed, onReleased }: Props) {
  const [email, setEmail] = useState('')
  const [mobile, setMobile] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cancelling, setCancelling] = useState(false)

  const remaining = useCountdown(hold.expires_at, () =>
    onReleased('Your seat hold expired before payment was completed. Please select a seat again.'),
  )

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const booking = await createBooking(hold.hold_token, email, mobile)
      onConfirmed(booking)
    } catch (err) {
      if (err instanceof ApiError && (err.status === 409 || err.status === 410)) {
        onReleased('This seat is no longer available. Please select a seat again.')
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
    onReleased('')
  }

  const urgent = remaining <= 60

  return (
    <section className={PAGE}>
      <div
        className={`mb-6 rounded-lg border px-4 py-3 text-sm ${
          urgent ? 'border-danger bg-danger-bg text-danger' : 'border-accent bg-accent/10 text-accent-dark'
        }`}
        aria-live="polite"
      >
        Complete payment within <strong>{formatTime(remaining)}</strong> or this seat will be released
      </div>

      <h2>
        Coach {seat.coach_code}, Seat {seat.seat_number}
      </h2>
      <p className={PAGE_SUBTITLE}>Fare: LKR {hold.fare.toFixed(2)}</p>

      <form className="grid gap-4" onSubmit={handleSubmit}>
        <h3 className="mt-2">Passenger details</h3>
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
            className="rounded-lg border border-border px-3 py-2.5"
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
            className="rounded-lg border border-border px-3 py-2.5"
          />
        </div>

        <h3 className="mt-2">Payment</h3>
        <p className={PAGE_SUBTITLE}>This is a mock payment for demonstration purposes.</p>

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
    </section>
  )
}
