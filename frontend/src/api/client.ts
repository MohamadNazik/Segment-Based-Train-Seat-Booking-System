import type { AvailableSeat, Booking, Hold, Station } from './types'

// ApiError carries the HTTP status alongside the backend's plain-text error
// message, so callers can branch on status (e.g. 409 conflict vs 410 gone)
// without re-parsing strings.
export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/v1${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })

  if (!res.ok) {
    const message = (await res.text()).trim() || res.statusText
    throw new ApiError(res.status, message)
  }

  if (res.status === 204) {
    return undefined as T
  }
  return (await res.json()) as T
}

export function getStations(): Promise<Station[]> {
  return request('/stations')
}

export function getAvailability(origin: string, destination: string, date: string): Promise<AvailableSeat[]> {
  const params = new URLSearchParams({ origin, destination, date })
  return request(`/availability?${params.toString()}`)
}

export function createHold(seatId: string, origin: string, destination: string, date: string): Promise<Hold> {
  return request('/holds', {
    method: 'POST',
    body: JSON.stringify({ seat_id: seatId, origin, destination, date }),
  })
}

export function cancelHold(token: string): Promise<void> {
  return request(`/holds/${token}/cancel`, { method: 'POST' })
}

export function createBooking(holdToken: string, email: string, mobile: string): Promise<Booking> {
  return request('/bookings', {
    method: 'POST',
    body: JSON.stringify({ hold_token: holdToken, email, mobile }),
  })
}
