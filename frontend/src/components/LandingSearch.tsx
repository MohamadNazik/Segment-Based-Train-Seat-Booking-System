import { useEffect, useState } from 'react'
import type { Station } from '../api/types'
import { CalendarIcon, PinIcon, SearchIcon, SwapIcon } from './icons'

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
      <section className="hero">
        <div className="hero-overlay">
          <h1>Book Your Seat for next journey</h1>
          <p className="hero-subtitle">Real-time seat availability across the Colombo Fort–Badulla line.</p>

          <form
            className="search-bar"
            onSubmit={(e) => {
              e.preventDefault()
              if (canSearch) onSearch(origin, destination, date)
            }}
          >
            <div className="search-bar-field">
              <label htmlFor="origin">From</label>
              <div className="field-input">
                <PinIcon />
                <select id="origin" value={origin} onChange={(e) => setOrigin(e.target.value)} required>
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
              className="swap-button"
              onClick={handleSwap}
              disabled={!origin && !destination}
              aria-label="Swap origin and destination"
            >
              <SwapIcon />
            </button>

            <div className="search-bar-field">
              <label htmlFor="destination">To</label>
              <div className="field-input">
                <PinIcon />
                <select id="destination" value={destination} onChange={(e) => setDestination(e.target.value)} required>
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

            <div className="search-bar-field">
              <label htmlFor="date">Date</label>
              <div className="field-input">
                <CalendarIcon />
                <input id="date" type="date" min={today()} value={date} onChange={(e) => setDate(e.target.value)} required />
              </div>
            </div>

            <button type="submit" className="search-submit" disabled={!canSearch}>
              <SearchIcon />
              {searching ? 'Searching…' : 'Search trains'}
            </button>
          </form>
        </div>
      </section>

      <div className="below-hero">
        {error && (
          <p className="error-banner" role="alert">
            {error}
          </p>
        )}

        {stations.length > 0 && (
          <div className="quick-routes">
            {QUICK_ROUTES.map(({ origin: o, destination: d }) => {
              const active = origin === o && destination === d
              return (
                <button
                  key={`${o}-${d}`}
                  type="button"
                  className={`quick-route-chip${active ? ' quick-route-chip-active' : ''}`}
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
