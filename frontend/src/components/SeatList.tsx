import { useState } from 'react'
import type { AvailableSeat, Station } from '../api/types'
import { BTN_PRIMARY, PAGE, PAGE_SUBTITLE } from '../styles'

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
    <section className={PAGE}>
      <h2>
        {stationName(stations, origin)} &rarr; {stationName(stations, destination)}
      </h2>
      <p className={PAGE_SUBTITLE}>{date}</p>

      <nav className="mb-5 flex items-center gap-1.5 text-sm" aria-label="Breadcrumb">
        <button type="button" className="font-semibold text-accent-dark underline" onClick={onBack}>
          Coaches
        </button>
        <span className="text-ink-soft">&rsaquo;</span>
        <span className="text-ink-soft">{coachCode}</span>
      </nav>

      <div className="mb-6 grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-3">
        {coachSeats.map((seat) => {
          const selected = seat.seat_id === selectedSeatId
          return (
            <button
              key={seat.seat_id}
              type="button"
              className={`flex flex-col gap-1 rounded-lg border p-3.5 text-left ${
                selected ? 'border-accent bg-accent/10 ring-2 ring-accent' : 'border-border bg-surface hover:border-accent'
              }`}
              aria-pressed={selected}
              onClick={() => setSelectedSeatId(seat.seat_id)}
            >
              <span className="font-semibold">Seat {seat.seat_number}</span>
              <span className="text-sm text-ink-soft">LKR {seat.fare.toFixed(2)}</span>
            </button>
          )
        })}
      </div>

      <div className="flex justify-end gap-3">
        <button
          type="button"
          className={BTN_PRIMARY}
          disabled={!selectedSeat || busy}
          onClick={() => selectedSeat && onProceed(selectedSeat)}
        >
          {busy ? 'Reserving…' : selectedSeat ? `Proceed with Seat ${selectedSeat.seat_number}` : 'Select a seat'}
        </button>
      </div>
    </section>
  )
}
