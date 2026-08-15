import type { AvailableSeat, Station } from '../api/types'

interface Props {
  origin: string
  destination: string
  date: string
  stations: Station[]
  seats: AvailableSeat[]
  onSelectCoach: (coachCode: string) => void
}

function stationName(stations: Station[], code: string): string {
  return stations.find((s) => s.code === code)?.name ?? code
}

export default function CoachList({ origin, destination, date, stations, seats, onSelectCoach }: Props) {
  const counts = new Map<string, number>()
  for (const seat of seats) {
    counts.set(seat.coach_code, (counts.get(seat.coach_code) ?? 0) + 1)
  }
  const coaches = [...counts.entries()].sort(([a], [b]) => a.localeCompare(b))

  return (
    <section className="page">
      <h2>
        {stationName(stations, origin)} &rarr; {stationName(stations, destination)}
      </h2>
      <p className="page-subtitle">{date}</p>

      {coaches.length === 0 ? (
        <p className="empty-state">No seats available for this journey and date. Try a different date.</p>
      ) : (
        <div className="coach-grid">
          {coaches.map(([coachCode, count]) => (
            <button key={coachCode} type="button" className="coach-card" onClick={() => onSelectCoach(coachCode)}>
              <span className="coach-code">Coach {coachCode}</span>
              <span className="coach-count">{count} seats available</span>
            </button>
          ))}
        </div>
      )}
    </section>
  )
}
