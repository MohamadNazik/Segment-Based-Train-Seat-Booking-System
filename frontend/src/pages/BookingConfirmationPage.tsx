import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import type { Booking } from '../api/types'
import { getBooking } from '../api/client'
import Confirmation from '../components/Confirmation'
import { ERROR_BANNER, PAGE } from '../styles'

// Booking (unlike a hold) is persisted, so this route always backs itself
// with a real fetch - refresh/share works. navigation state just avoids a
// loading flash right after paying; the fetch overwrites it once it resolves.
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
