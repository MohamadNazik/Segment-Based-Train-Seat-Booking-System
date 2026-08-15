import type { Booking } from '../api/types'

interface Props {
  booking: Booking
  onNewSearch: () => void
}

export default function Confirmation({ booking, onNewSearch }: Props) {
  return (
    <section className="page confirmation">
      <div className="confirmation-badge">✓</div>
      <h2>Booking confirmed</h2>
      <p className="page-subtitle">A confirmation has been recorded for {booking.email}</p>

      <dl className="confirmation-details">
        <dt>Booking ID</dt>
        <dd>{booking.id}</dd>
        <dt>Travel date</dt>
        <dd>{booking.travel_date}</dd>
        <dt>Fare paid</dt>
        <dd>LKR {booking.fare.toFixed(2)}</dd>
        <dt>Mobile</dt>
        <dd>{booking.mobile}</dd>
      </dl>

      <button type="button" onClick={onNewSearch}>
        Book another journey
      </button>
    </section>
  )
}
