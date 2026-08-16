import { useEffect, useState } from 'react'
import type { Station } from '../api/types'
import { CalendarIcon, PinIcon, SearchIcon, SwapIcon } from './icons'
import { ERROR_BANNER, HERO_BACKGROUND } from '../styles'

interface ActiveSearch {
  origin: string
  destination: string
  date: string
}

interface Props {
  stations: Station[]
  searching: boolean
  error: string | null
  /** The currently active search, if any (e.g. restored from the URL). Form
   * fields stay in sync with this but aren't overwritten by free editing. */
  activeSearch: ActiveSearch | null
  onSearch: (origin: string, destination: string, date: string) => void
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

export default function LandingSearch({ stations, searching, error, activeSearch, onSearch }: Props) {
  const [origin, setOrigin] = useState(activeSearch?.origin ?? '')
  const [destination, setDestination] = useState(activeSearch?.destination ?? '')
  const [date, setDate] = useState(activeSearch?.date ?? today())

  // Only fires when activeSearch itself changes, not on every keystroke.
  useEffect(() => {
    setOrigin(activeSearch?.origin ?? '')
    setDestination(activeSearch?.destination ?? '')
    setDate(activeSearch?.date ?? today())
  }, [activeSearch])

  const canSearch = origin !== '' && destination !== '' && origin !== destination && date !== '' && !searching

  function handleSwap() {
    setOrigin(destination)
    setDestination(origin)
  }

  return (
    <>
      <section className="flex flex-col items-center justify-start px-6 pb-6 pt-20 text-center text-white" style={HERO_BACKGROUND}>
        <div className="w-full max-w-250">
          <h1 className="mb-3 text-[clamp(2rem,5vw,3.2rem)] font-extrabold text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.4)]">
            Book Your Seat for next journey
          </h1>
          <p className="mb-2 text-[1.05rem] text-white/90 drop-shadow-[0_1px_6px_rgba(0,0,0,0.4)]">
            Real-time seat availability across the Colombo Fort–Badulla line.
          </p>

          <form
            className="relative z-10 -mb-16 mt-5 flex w-full flex-col items-stretch gap-3 rounded-[18px] bg-[#f2efe8] p-5 text-left shadow-[0_20px_40px_rgba(0,0,0,0.25)] sm:flex-row sm:items-end"
            onSubmit={(e) => {
              e.preventDefault()
              if (canSearch) onSearch(origin, destination, date)
            }}
          >
            <div className="relative flex flex-col gap-3 sm:contents">
              <div className="flex min-w-0 flex-col gap-1.5 sm:flex-1">
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
                className="absolute right-3 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-surface text-route-accent shadow-[0_2px_8px_rgba(0,0,0,0.15)] hover:enabled:bg-bg sm:static sm:mb-px sm:h-10 sm:w-10 sm:flex-none sm:translate-y-0 sm:shadow-none"
                onClick={handleSwap}
                disabled={!origin && !destination}
                aria-label="Swap origin and destination"
              >
                <SwapIcon />
              </button>

              <div className="flex min-w-0 flex-col gap-1.5 sm:flex-1">
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
            </div>

            <div className="flex min-w-0 flex-col gap-1.5 sm:flex-1">
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
              className="flex h-11 w-full items-center justify-center gap-2 whitespace-nowrap rounded-full bg-accent px-5.5 font-bold text-white hover:enabled:bg-accent-dark sm:w-auto sm:flex-none sm:rounded-[10px]"
              disabled={!canSearch}
            >
              <SearchIcon />
              {searching ? 'Searching…' : 'Search trains'}
            </button>
          </form>
        </div>
      </section>

      <div className="px-6 pb-8 pt-20 text-center">
        {error && (
          <p className={ERROR_BANNER} role="alert">
            {error}
          </p>
        )}
      </div>
    </>
  )
}
