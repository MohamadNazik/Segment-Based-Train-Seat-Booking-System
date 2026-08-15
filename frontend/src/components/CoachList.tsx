import type { AvailableSeat, Station } from '../api/types'
import { EMPTY_STATE, PAGE, PAGE_SUBTITLE } from '../styles'

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
    <section className={PAGE}>
      <h2>
        {stationName(stations, origin)} &rarr; {stationName(stations, destination)}
      </h2>
      <p className={PAGE_SUBTITLE}>{date}</p>

      {coaches.length === 0 ? (
        <p className={EMPTY_STATE}>No seats available for this journey and date. Try a different date.</p>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-4">
          {coaches.map(([coachCode, count]) => (
            <button
              key={coachCode}
              type="button"
              className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-5 text-left transition hover:-translate-y-0.5 hover:border-accent"
              onClick={() => onSelectCoach(coachCode)}
            >
              <span className="text-lg font-bold">Coach {coachCode}</span>
              <span className="text-sm text-ink-soft">{count} seats available</span>
            </button>
          ))}
        </div>
      )}
    </section>
  )
}
