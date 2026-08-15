import { useEffect, useState } from 'react'
import './App.css'
import type { AvailableSeat, Booking, Hold, Station } from './api/types'
import { ApiError, getAvailability, getStations, createHold } from './api/client'
import LandingSearch from './components/LandingSearch'
import CoachList from './components/CoachList'
import SeatList from './components/SeatList'
import Checkout from './components/Checkout'
import Confirmation from './components/Confirmation'

type View = 'landing' | 'coaches' | 'seats' | 'checkout' | 'confirmation'

interface SearchContext {
  origin: string
  destination: string
  date: string
}

export default function App() {
  const [stations, setStations] = useState<Station[]>([])
  const [stationsError, setStationsError] = useState<string | null>(null)

  const [view, setView] = useState<View>('landing')
  const [search, setSearch] = useState<SearchContext | null>(null)
  const [seats, setSeats] = useState<AvailableSeat[]>([])
  const [selectedCoach, setSelectedCoach] = useState<string | null>(null)
  const [selectedSeat, setSelectedSeat] = useState<AvailableSeat | null>(null)
  const [hold, setHold] = useState<Hold | null>(null)
  const [booking, setBooking] = useState<Booking | null>(null)

  const [searching, setSearching] = useState(false)
  const [holding, setHolding] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getStations()
      .then(setStations)
      .catch((err) => setStationsError(err instanceof Error ? err.message : 'Failed to load stations'))
  }, [])

  async function refreshAvailability(ctx: SearchContext) {
    const result = await getAvailability(ctx.origin, ctx.destination, ctx.date)
    setSeats(result)
    return result
  }

  async function handleSearch(origin: string, destination: string, date: string) {
    setSearching(true)
    setError(null)
    try {
      const ctx = { origin, destination, date }
      await refreshAvailability(ctx)
      setSearch(ctx)
      setView('coaches')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load availability')
    } finally {
      setSearching(false)
    }
  }

  function handleSelectCoach(coachCode: string) {
    setSelectedCoach(coachCode)
    setNotice(null)
    setView('seats')
  }

  async function handleProceed(seat: AvailableSeat) {
    if (!search) return
    setHolding(true)
    setNotice(null)
    try {
      const h = await createHold(seat.seat_id, search.origin, search.destination, search.date)
      setSelectedSeat(seat)
      setHold(h)
      setView('checkout')
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setNotice('That seat was just taken by another passenger. Availability has been refreshed.')
        await refreshAvailability(search)
      } else {
        setNotice(err instanceof Error ? err.message : 'Failed to reserve seat')
      }
    } finally {
      setHolding(false)
    }
  }

  function handleConfirmed(b: Booking) {
    setBooking(b)
    setHold(null)
    setSelectedSeat(null)
    setView('confirmation')
  }

  async function handleReleased(message: string) {
    setHold(null)
    setSelectedSeat(null)
    if (message) setNotice(message)
    if (search) {
      try {
        await refreshAvailability(search)
      } catch {
        // stale list is better than none; the next Proceed attempt will surface any real error
      }
    }
    setView('seats')
  }

  function handleBackToLanding() {
    setSearch(null)
    setSeats([])
    setSelectedCoach(null)
    setNotice(null)
    setView('landing')
  }

  function handleNewSearch() {
    setBooking(null)
    handleBackToLanding()
  }

  if (stationsError) {
    return (
      <div className="page">
        <p className="error-banner">Unable to load stations: {stationsError}</p>
      </div>
    )
  }

  return (
    <main>
      {view === 'landing' && (
        <LandingSearch stations={stations} searching={searching} error={error} onSearch={handleSearch} />
      )}

      {view === 'coaches' && search && (
        <CoachList
          origin={search.origin}
          destination={search.destination}
          date={search.date}
          stations={stations}
          seats={seats}
          onSelectCoach={handleSelectCoach}
          onBack={handleBackToLanding}
        />
      )}

      {view === 'seats' && selectedCoach && (
        <>
          {notice && (
            <p className="error-banner" role="alert">
              {notice}
            </p>
          )}
          <SeatList
            coachCode={selectedCoach}
            seats={seats}
            busy={holding}
            onProceed={handleProceed}
            onBack={() => setView('coaches')}
          />
        </>
      )}

      {view === 'checkout' && hold && selectedSeat && (
        <Checkout hold={hold} seat={selectedSeat} onConfirmed={handleConfirmed} onReleased={handleReleased} />
      )}

      {view === 'confirmation' && booking && <Confirmation booking={booking} onNewSearch={handleNewSearch} />}
    </main>
  )
}
