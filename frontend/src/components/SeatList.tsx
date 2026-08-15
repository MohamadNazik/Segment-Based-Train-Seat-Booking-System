import { useState } from 'react'
import type { AvailableSeat, Station } from '../api/types'

interface Props {
  origin: string
  destination: string
  date: string
  stations: Station[]
  coachCode: string
  seats: AvailableSeat[]
  busy: boolean
  onProceed: (seat: AvailableSeat) => void
  onBack: () => void
}

function stationName(stations: Station[], code: string): string {
  return stations.find((s) => s.code === code)?.name ?? code
}

export default function SeatList({ origin, destination, date, stations, coachCode, seats, busy, onProceed, onBack }: Props) {
  const [selectedSeatId, setSelectedSeatId] = useState<string | null>(null)

  const coachSeats = seats.filter((s) => s.coach_code === coachCode).sort((a, b) => a.seat_number - b.seat_number)
  const selectedSeat = coachSeats.find((s) => s.seat_id === selectedSeatId) ?? null

  return (
    <section className="page">
      <h2>
        {stationName(stations, origin)} &rarr; {stationName(stations, destination)}
      </h2>
      <p className="page-subtitle">{date}</p>

      <nav className="breadcrumb" aria-label="Breadcrumb">
        <button type="button" className="breadcrumb-link" onClick={onBack}>
          Coaches
        </button>
        <span className="breadcrumb-separator">&rsaquo;</span>
        <span className="breadcrumb-current">{coachCode}</span>
      </nav>

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
