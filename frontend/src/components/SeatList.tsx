import { useState } from 'react'
import type { AvailableSeat } from '../api/types'

interface Props {
  coachCode: string
  seats: AvailableSeat[]
  busy: boolean
  onProceed: (seat: AvailableSeat) => void
  onBack: () => void
}

export default function SeatList({ coachCode, seats, busy, onProceed, onBack }: Props) {
  const [selectedSeatId, setSelectedSeatId] = useState<string | null>(null)

  const coachSeats = seats.filter((s) => s.coach_code === coachCode).sort((a, b) => a.seat_number - b.seat_number)
  const selectedSeat = coachSeats.find((s) => s.seat_id === selectedSeatId) ?? null

  return (
    <section className="page">
      <button type="button" className="link-button" onClick={onBack}>
        &larr; Back to coaches
      </button>

      <h2>Coach {coachCode}</h2>

      <div className="seat-grid">
        {coachSeats.map((seat) => (
          <button
            key={seat.seat_id}
            type="button"
            className={`seat-card${seat.seat_id === selectedSeatId ? ' seat-card-selected' : ''}`}
            aria-pressed={seat.seat_id === selectedSeatId}
            onClick={() => setSelectedSeatId(seat.seat_id)}
          >
            <span className="seat-number">Seat {seat.seat_number}</span>
            <span className="seat-fare">LKR {seat.fare.toFixed(2)}</span>
          </button>
        ))}
      </div>

      <div className="proceed-bar">
        <button type="button" disabled={!selectedSeat || busy} onClick={() => selectedSeat && onProceed(selectedSeat)}>
          {busy ? 'Reserving…' : selectedSeat ? `Proceed with Seat ${selectedSeat.seat_number}` : 'Select a seat'}
        </button>
      </div>
    </section>
  )
}
