import { useState, useEffect } from 'react'

export function useIdleDetection(timeoutMs = 180000) {
  const [isIdle, setIsIdle] = useState(false)
  const [idleSince, setIdleSince] = useState(null)

  useEffect(() => {
    let timeoutId
    const resetTimer = () => {
      setIsIdle(false)
      setIdleSince(null)
      clearTimeout(timeoutId)
      timeoutId = setTimeout(() => {
        setIsIdle(true)
        setIdleSince(Date.now())
      }, timeoutMs)
    }

    const events = ['mousemove', 'mousedown', 'keypress', 'DOMMouseScroll', 'mousewheel', 'touchmove', 'MSPointerMove']
    
    events.forEach((event) => document.addEventListener(event, resetTimer, { passive: true }))
    resetTimer() // initial start

    return () => {
      clearTimeout(timeoutId)
      events.forEach((event) => document.removeEventListener(event, resetTimer))
    }
  }, [timeoutMs])

  return { isIdle, idleSince }
}
