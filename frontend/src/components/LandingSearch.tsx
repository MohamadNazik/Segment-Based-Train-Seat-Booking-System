import { useEffect, useState } from 'react'
import type { Station } from '../api/types'
import { CalendarIcon, PinIcon, SearchIcon, SwapIcon } from './icons'
import { ERROR_BANNER } from '../styles'

interface ActiveSearch {
  origin: string
  destination: string
  date: string
}

interface Props {
  stations: Station[]
  searching: boolean
  error: string | null
  /** The currently active search (if any) - e.g. restored from the URL on
   * load/refresh, or from browser back/forward. The form fields stay in
   * sync with this, so a refresh doesn't silently blank out what's
   * actually being shown below. Freely editing the fields doesn't affect
   * this until a new search is actually submitted. */
  activeSearch: ActiveSearch | null
  onSearch: (origin: string, destination: string, date: string) => void
}

// The two most commonly searched legs on this line, shown in both
// directions as one-click shortcuts - not a separate feature, just a
// faster path through the same search. Both directions are offered
// deliberately, since reverse-direction bookings are a first-class part
// of this system, not an afterthought.
const QUICK_ROUTES: Array<{ origin: string; destination: string }> = [
  { origin: 'COL', destination: 'KAN' },
  { origin: 'KAN', destination: 'COL' },
  { origin: 'COL', destination: 'ELL' },
  { origin: 'ELL', destination: 'COL' },
]

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function stationName(stations: Station[], code: string): string {
  return stations.find((s) => s.code === code)?.name ?? code
}

// Stand-in for a real photo of the line - see README for swapping in a
// licensed image instead. Kept as an inline style since a two-layer
// gradient with several rgba stops doesn't have a clean Tailwind utility
// equivalent worth fighting the arbitrary-value syntax for.
const HERO_BACKGROUND = {
  backgroundImage:
    'linear-gradient(to bottom, rgba(10,20,15,0.55) 0%, rgba(10,20,15,0.25) 45%, rgba(10,20,15,0.65) 100%), ' +
    'radial-gradient(circle at 25% 15%, #3d8a5c 0%, #1c5c3a 45%, #0a2e1c 100%)',
}

export default function LandingSearch({ stations, searching, error, activeSearch, onSearch }: Props) {
  const [origin, setOrigin] = useState(activeSearch?.origin ?? '')
  const [destination, setDestination] = useState(activeSearch?.destination ?? '')
  const [date, setDate] = useState(activeSearch?.date ?? today())

  // Keep the fields in sync with whatever search is actually active - e.g.
  // once a URL-driven search resolves after mount, or when browser
  // back/forward changes it. Only fires when activeSearch itself changes,
  // never on every keystroke, so freely editing the fields in between two
  // real searches is never overwritten mid-edit.
  useEffect(() => {
    setOrigin(activeSearch?.origin ?? '')
    setDestination(activeSearch?.destination ?? '')
    setDate(activeSearch?.date ?? today())
  }, [activeSearch])

  const canSearch = origin !== '' && destination !== '' && origin !== destination && date !== '' && !searching

  function handleQuickRoute(o: string, d: string) {
    setOrigin(o)
    setDestination(d)
    if (!searching) onSearch(o, d, date)
  }

  function handleSwap() {
    setOrigin(destination)
    setDestination(origin)
  }

  return (
    <>
      <section className="flex flex-col items-center justify-start px-6 pb-8 pt-10 text-center text-white" style={HERO_BACKGROUND}>
        <div className="w-full max-w-250">
          <h1 className="mb-3 text-[clamp(2rem,5vw,3.2rem)] font-extrabold text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.4)]">
            Book Your Seat for next journey
          </h1>
          <p className="mb-2 text-[1.05rem] text-white/90 drop-shadow-[0_1px_6px_rgba(0,0,0,0.4)]">
            Real-time seat availability across the Colombo Fort–Badulla line.
          </p>

          <form
            className="mt-5 flex w-full items-end gap-3 rounded-[18px] bg-[#f2efe8] p-5 text-left shadow-[0_20px_40px_rgba(0,0,0,0.25)]"
            onSubmit={(e) => {
              e.preventDefault()
              if (canSearch) onSearch(origin, destination, date)
            }}
          >
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <label htmlFor="origin" className="text-xs font-bold uppercase tracking-wide text-ink-soft">
                From
              </label>
              <div className="flex items-center gap-2 rounded-[10px] border border-border bg-surface px-3 py-2.5 text-ink-soft">
                <PinIcon />
                <select
                  id="origin"
                  value={origin}
                  onChange={(e) => setOrigin(e.target.value)}
                  required
                  className="min-w-0 flex-1 border-none bg-transparent text-[0.95rem] text-ink outline-none"
                >
                  <option value="" disabled>
                    Select station
                  </option>
                  {stations.map((s) => (
                    <option key={s.id} value={s.code} disabled={s.code === destination}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              type="button"
              className="mb-px flex h-10 w-10 flex-none items-center justify-center rounded-full border border-border bg-surface text-route-accent hover:enabled:bg-bg"
              onClick={handleSwap}
              disabled={!origin && !destination}
              aria-label="Swap origin and destination"
            >
              <SwapIcon />
            </button>

            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <label htmlFor="destination" className="text-xs font-bold uppercase tracking-wide text-ink-soft">
                To
              </label>
              <div className="flex items-center gap-2 rounded-[10px] border border-border bg-surface px-3 py-2.5 text-ink-soft">
                <PinIcon />
                <select
                  id="destination"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  required
                  className="min-w-0 flex-1 border-none bg-transparent text-[0.95rem] text-ink outline-none"
                >
                  <option value="" disabled>
                    Select station
                  </option>
                  {stations.map((s) => (
                    <option key={s.id} value={s.code} disabled={s.code === origin}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <label htmlFor="date" className="text-xs font-bold uppercase tracking-wide text-ink-soft">
                Date
              </label>
              <div className="flex items-center gap-2 rounded-[10px] border border-border bg-surface px-3 py-2.5 text-ink-soft">
                <CalendarIcon />
                <input
                  id="date"
                  type="date"
                  min={today()}
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  className="min-w-0 flex-1 border-none bg-transparent text-[0.95rem] text-ink outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              className="flex h-11 flex-none items-center gap-2 whitespace-nowrap rounded-[10px] bg-route-accent px-5.5 font-bold text-white hover:enabled:bg-route-accent-dark"
              disabled={!canSearch}
            >
              <SearchIcon />
              {searching ? 'Searching…' : 'Search trains'}
            </button>
          </form>
        </div>
      </section>

      <div className="px-6 py-8 text-center">
        {error && (
          <p className={ERROR_BANNER} role="alert">
            {error}
          </p>
        )}

        {stations.length > 0 && (
          <div className="mx-auto flex max-w-225 flex-wrap justify-center gap-2.5">
            {QUICK_ROUTES.map(({ origin: o, destination: d }) => {
              const active = origin === o && destination === d
              return (
                <button
                  key={`${o}-${d}`}
                  type="button"
                  className={`rounded-full border-[1.5px] bg-surface px-4.5 py-2.5 text-sm font-semibold ${
                    active ? 'border-route-accent text-route-accent' : 'border-border text-ink hover:border-route-accent'
                  }`}
                  disabled={searching}
                  onClick={() => handleQuickRoute(o, d)}
                >
                  {stationName(stations, o)} &rarr; {stationName(stations, d)}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}
