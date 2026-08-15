export interface Station {
  id: string
  code: string
  name: string
  sequence: number
  distance_km: number
}

export interface AvailableSeat {
  seat_id: string
  coach_code: string
  seat_number: number
  status: 'available'
  fare: number
}

export interface Hold {
  hold_token: string
  travel_date: string
  fare: number
  expires_at: string
}

export interface Booking {
  id: string
  seat_id: string
  travel_date: string
  origin_seq: number
  destination_seq: number
  email: string
  mobile: string
  fare: number
  created_at: string
}
