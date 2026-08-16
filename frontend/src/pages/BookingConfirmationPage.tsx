import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import type { Booking } from '../api/types'
import { getBooking } from '../api/client'
import Confirmation from '../components/Confirmation'
import { ERROR_BANNER, PAGE } from '../styles'

// A confirmed booking is a persisted resource (unlike a checkout hold), so
// this route is always backed by a real fetch - refreshing or sharing the
// link works, not just the moment right after paying. The just-completed
// booking is still handed over via navigation state so the first paint
// isn't a loading flash, but the fetch is the source of truth and
// overwrites it once it resolves.
interface IncomingState {
  booking?: Booking
}

export default function BookingConfirmationPage() {
  const { id } = useParams<{ id: string }>()
  const location = useLocation()
  const navigate = useNavigate()

  const [booking, setBooking] = useState<Booking | null>((location.state as IncomingState | null)?.booking ?? null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    getBooking(id)
      .then(setBooking)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load booking'))
  }, [id])

  function handleNewSearch() {
    navigate('/')
  }

  if (error) {
    return (
      <div className={PAGE}>
        <p className={ERROR_BANNER}>Unable to load booking: {error}</p>
      </div>
    )
  }

  if (!booking) {
    return <p className={PAGE}>Loading…</p>
  }

  return <Confirmation booking={booking} onNewSearch={handleNewSearch} />
}
