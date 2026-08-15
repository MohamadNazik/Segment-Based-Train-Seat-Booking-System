import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { AvailableSeat, Booking, Hold, Station } from '../api/types'
import { ApiError, getAvailability, getStations, createHold } from '../api/client'
import LandingSearch from '../components/LandingSearch'
import CoachList from '../components/CoachList'
import SeatList from '../components/SeatList'
import Checkout from '../components/Checkout'
import Confirmation from '../components/Confirmation'

// The search (from/to/date) and the selected coach both live in the URL's
// query string via react-router's useSearchParams - not component state -
// so they're shareable/bookmarkable and browser back/forward work for
// free, without any hand-written history/popstate logic. Checkout and
// confirmation deliberately stay as plain component state instead: a hold
// carries a token that shouldn't end up in a shareable URL, and neither
// step needs to be revisitable via back/forward the way search results do.
export default function BookingPage() {
  const [searchParams, setSearchParams] = useSearchParams()

  const origin = searchParams.get('from') ?? ''
  const destination = searchParams.get('to') ?? ''
  const date = searchParams.get('date') ?? ''
  const coachCode = searchParams.get('coach')
  const hasSearch = origin !== '' && destination !== '' && date !== ''

  const [stations, setStations] = useState<Station[]>([])
  const [stationsError, setStationsError] = useState<string | null>(null)

  const [seats, setSeats] = useState<AvailableSeat[]>([])
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

  async function fetchAvailability(o: string, d: string, dt: string) {
    setSearching(true)
    setError(null)
    try {
      const result = await getAvailability(o, d, dt)
      setSeats(result)
      return result
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load availability')
      throw err
    } finally {
      setSearching(false)
    }
  }

  // Refetches whenever the search params change - a form submission, the
  // initial URL already carrying a search (shared link / refresh), a
  // browser back/forward navigation, or the selected coach changing
  // (including going back to the coach list) - useSearchParams re-renders
  // in all of these cases, so this one effect covers all of them. coachCode
  // is included deliberately even though it isn't used inside the effect
  // body: navigating between the coach list and a seat list must always
  // re-fetch, since a seat someone else booked/held moments ago should
  // never be shown as available just because we already had a response
  // cached from the last fetch.
  useEffect(() => {
    if (hasSearch) {
      fetchAvailability(origin, destination, date).catch(() => {
        // error state is already set by fetchAvailability
      })
    } else {
      setSeats([])
    }
  }, [origin, destination, date, hasSearch, coachCode])

  function handleSearch(newOrigin: string, newDestination: string, newDate: string) {
    setSearchParams({ from: newOrigin, to: newDestination, date: newDate })
  }

  function handleSelectCoach(code: string) {
    setNotice(null)
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.set('coach', code)
      return next
    })
  }

  function handleBackToCoaches() {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.delete('coach')
      return next
    })
  }

  async function handleProceed(seat: AvailableSeat) {
    if (!hasSearch) return
    setHolding(true)
    setNotice(null)
    try {
      const h = await createHold(seat.seat_id, origin, destination, date)
      setSelectedSeat(seat)
      setHold(h)
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setNotice('That seat was just taken by another passenger. Availability has been refreshed.')
        await fetchAvailability(origin, destination, date).catch(() => {})
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
  }

  async function handleReleased(message: string) {
    setHold(null)
    setSelectedSeat(null)
    if (message) setNotice(message)
    if (hasSearch) {
      await fetchAvailability(origin, destination, date).catch(() => {
        // stale list is better than none; the next Proceed attempt will surface any real error
      })
    }
  }

  function handleNewSearch() {
    setBooking(null)
    setSearchParams({})
  }

  if (stationsError) {
    return (
      <div className="page">
        <p className="error-banner">Unable to load stations: {stationsError}</p>
      </div>
    )
  }

  if (booking) {
    return <Confirmation booking={booking} onNewSearch={handleNewSearch} />
  }

  if (hold && selectedSeat) {
    return <Checkout hold={hold} seat={selectedSeat} onConfirmed={handleConfirmed} onReleased={handleReleased} />
  }

  return (
    <>
      <LandingSearch
        stations={stations}
        searching={searching}
        error={error}
        activeSearch={hasSearch ? { origin, destination, date } : null}
        onSearch={handleSearch}
      />

      {hasSearch && searching && <p className="page">Loading…</p>}

      {hasSearch && !searching && !coachCode && (
        <CoachList
          origin={origin}
          destination={destination}
          date={date}
          stations={stations}
          seats={seats}
          onSelectCoach={handleSelectCoach}
        />
      )}

      {hasSearch && !searching && coachCode && (
        <>
          {notice && (
            <p className="error-banner" role="alert">
              {notice}
            </p>
          )}
          <SeatList
            origin={origin}
            destination={destination}
            date={date}
            stations={stations}
            coachCode={coachCode}
            seats={seats}
            busy={holding}
            onProceed={handleProceed}
            onBack={handleBackToCoaches}
          />
        </>
      )}
    </>
  )
}
