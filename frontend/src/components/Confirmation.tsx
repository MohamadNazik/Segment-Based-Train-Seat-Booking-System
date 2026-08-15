import type { Booking } from '../api/types'
import { BTN_PRIMARY, PAGE, PAGE_SUBTITLE } from '../styles'

interface Props {
  booking: Booking
  onNewSearch: () => void
}

export default function Confirmation({ booking, onNewSearch }: Props) {
  return (
    <section className={`${PAGE} text-center`}>
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-accent text-3xl text-white">
        ✓
      </div>
      <h2>Booking confirmed</h2>
      <p className={PAGE_SUBTITLE}>A confirmation has been recorded for {booking.email}</p>

      <dl className="mx-auto my-6 grid max-w-[400px] grid-cols-[max-content_1fr] gap-x-4 gap-y-2 rounded-xl border border-border bg-surface p-5 text-left">
        <dt className="text-ink-soft">Booking ID</dt>
        <dd className="m-0 font-semibold">{booking.id}</dd>
        <dt className="text-ink-soft">Travel date</dt>
        <dd className="m-0 font-semibold">{booking.travel_date}</dd>
        <dt className="text-ink-soft">Fare paid</dt>
        <dd className="m-0 font-semibold">LKR {booking.fare.toFixed(2)}</dd>
        <dt className="text-ink-soft">Mobile</dt>
        <dd className="m-0 font-semibold">{booking.mobile}</dd>
      </dl>

      <button type="button" className={BTN_PRIMARY} onClick={onNewSearch}>
        Book another journey
      </button>
    </section>
  )
}
