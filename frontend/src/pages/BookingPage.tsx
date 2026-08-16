import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import type { AvailableSeat, Station } from '../api/types'
import { ApiError, getAvailability, getStations, createHold } from '../api/client'
import LandingSearch from '../components/LandingSearch'
import CoachList from '../components/CoachList'
import SeatList from '../components/SeatList'
import { ERROR_BANNER, PAGE } from '../styles'

// Handed back from /checkout via navigation state when a hold is released -
// never via the URL. A successful checkout goes straight to /booking/:id
// instead of landing back here.
interface IncomingState {
  notice?: string
}

// Search (from/to/date) and coach live in the URL query string, so they're
// shareable and back/forward work for free. Checkout lives on its own
// route instead, since a hold token shouldn't end up in a shareable URL.
export default function BookingPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()

  const origin = searchParams.get('from') ?? ''
  const destination = searchParams.get('to') ?? ''
  const date = searchParams.get('date') ?? ''
  const coachCode = searchParams.get('coach')
  const hasSearch = origin !== '' && destination !== '' && date !== ''

  const [stations, setStations] = useState<Station[]>([])
  const [stationsError, setStationsError] = useState<string | null>(null)

  const [seats, setSeats] = useState<AvailableSeat[]>([])

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

  // Consumes a released-hold notice from /checkout, then clears it
  // (replace + state: null) so a refresh doesn't replay it. Always
  // refetches - the released seat (or one someone else grabbed) may
  // have changed.
  useEffect(() => {
    const state = location.state as IncomingState | null
    if (!state || state.notice === undefined) return
    if (state.notice) setNotice(state.notice)
    if (hasSearch) {
      fetchAvailability(origin, destination, date).catch(() => {
        // stale list is better than none; the next Proceed attempt will surface any real error
      })
    }
    navigate(location.pathname + location.search, { replace: true, state: null })
  }, [location, origin, destination, date, hasSearch, navigate])

  // Refetches on any search/coach change. coachCode is an unused dep on
  // purpose: switching coaches must always refetch, not reuse a stale list.
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
      const hold = await createHold(seat.seat_id, origin, destination, date)
      navigate('/checkout', { state: { hold, seat, returnTo: location.pathname + location.search } })
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

  if (stationsError) {
    return (
      <div className={PAGE}>
        <p className={ERROR_BANNER}>Unable to load stations: {stationsError}</p>
      </div>
    )
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

      {hasSearch && searching && <p className={PAGE}>Loading…</p>}

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
            <p className={ERROR_BANNER} role="alert">
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
