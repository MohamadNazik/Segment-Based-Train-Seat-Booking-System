import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import type { AvailableSeat, Station } from '../api/types'
import { ApiError, getAvailability, getStations, createHold } from '../api/client'
import LandingSearch from '../components/LandingSearch'
import CoachList from '../components/CoachList'
import SeatList from '../components/SeatList'
import { ERROR_BANNER, PAGE } from '../styles'

// Handed back from /checkout via navigation state whenever a hold is
// released (cancelled, expired, or rejected at finalize) - never via the
// URL, since it isn't part of this page's own shareable search state. A
// successful checkout never lands back here at all; it goes straight to
// its own /booking/:id confirmation route instead.
interface IncomingState {
  notice?: string
}

// The search (from/to/date) and the selected coach both live in the URL's
// query string via react-router's useSearchParams - not component state -
// so they're shareable/bookmarkable and browser back/forward work for
// free, without any hand-written history/popstate logic. Checkout lives on
// its own route (/checkout) instead: a hold carries a token that shouldn't
// end up in a shareable URL, so it travels as navigation state rather than
// a query param.
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

  // Consumes a released-hold notice handed back from /checkout, then
  // clears it (replace + state: null) so refreshing this same history
  // entry doesn't replay it. Its presence (even an empty string, for a
  // manual cancel) always means the seat list needs a fresh fetch, since
  // the just-released seat (or one someone else grabbed meanwhile) may
  // have changed. The extra deps beyond `location` just mean this also
  // (harmlessly) re-checks on a plain search change, since the `!state`
  // guard makes that a no-op.
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
