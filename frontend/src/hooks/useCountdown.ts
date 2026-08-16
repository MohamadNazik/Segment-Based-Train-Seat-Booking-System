import { useEffect, useRef, useState } from 'react'

/** Seconds remaining until expiresAt, ticking down every second. Calls
 * onExpire exactly once, the instant it reaches zero. */
export function useCountdown(expiresAt: string, onExpire: () => void): number {
  const [remaining, setRemaining] = useState(() => secondsUntil(expiresAt))
  const onExpireRef = useRef(onExpire)
  onExpireRef.current = onExpire

  useEffect(() => {
    const tick = () => {
      const secs = secondsUntil(expiresAt)
      setRemaining(secs)
      if (secs <= 0) {
        clearInterval(interval)
        onExpireRef.current()
      }
    }

    const interval = setInterval(tick, 1000)
    tick()
    return () => clearInterval(interval)
  }, [expiresAt])

  return Math.max(0, remaining)
}

function secondsUntil(iso: string): number {
  return Math.round((new Date(iso).getTime() - Date.now()) / 1000)
}
