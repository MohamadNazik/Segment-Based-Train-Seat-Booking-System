import { useState } from 'react'
import type { Station } from '../api/types'

interface Props {
  stations: Station[]
  searching: boolean
  error: string | null
  onSearch: (origin: string, destination: string, date: string) => void
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

export default function LandingSearch({ stations, searching, error, onSearch }: Props) {
  const [origin, setOrigin] = useState('')
  const [destination, setDestination] = useState('')
  const [date, setDate] = useState(today())

  const canSearch = origin !== '' && destination !== '' && origin !== destination && date !== '' && !searching

  return (
    <section className="hero">
      <div className="hero-overlay">
        <h1>Colombo Fort — Badulla</h1>
        <p className="hero-subtitle">Sri Lanka's most celebrated scenic rail journey</p>

        <form
          className="search-card"
          onSubmit={(e) => {
            e.preventDefault()
            if (canSearch) onSearch(origin, destination, date)
          }}
        >
          <div className="search-field">
            <label htmlFor="origin">From</label>
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

          <div className="search-field">
            <label htmlFor="destination">To</label>
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

          <div className="search-field">
            <label htmlFor="date">Date</label>
            <input id="date" type="date" min={today()} value={date} onChange={(e) => setDate(e.target.value)} required />
          </div>

          {error && (
            <p className="error-banner" role="alert">
              {error}
            </p>
          )}

          <button type="submit" disabled={!canSearch}>
            {searching ? 'Searching…' : 'Search trains'}
          </button>
        </form>
      </div>
    </section>
  )
}
