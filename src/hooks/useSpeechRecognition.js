import { useEffect, useRef, useState } from 'react'

/**
 * Voice-to-text via the Web Speech API (Chromium/Electron). Accumulates
 * finalized transcript and exposes live interim text for feedback.
 */
export function useSpeechRecognition() {
  const Recognition =
    typeof window !== 'undefined' &&
    (window.SpeechRecognition || window.webkitSpeechRecognition)
  const supported = Boolean(Recognition)

  const [listening, setListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [interim, setInterim] = useState('')
  const recRef = useRef(null)

  useEffect(() => {
    if (!supported) return undefined
    const rec = new Recognition()
    rec.continuous = true
    rec.interimResults = true
    rec.lang = 'en-US'

    rec.onresult = (e) => {
      let finalChunk = ''
      let interimChunk = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const text = e.results[i][0].transcript
        if (e.results[i].isFinal) finalChunk += text
        else interimChunk += text
      }
      if (finalChunk) setTranscript((t) => (t ? `${t} ${finalChunk}` : finalChunk).trim())
      setInterim(interimChunk)
    }
    rec.onend = () => setListening(false)
    rec.onerror = () => setListening(false)

    recRef.current = rec
    return () => {
      try {
        rec.stop()
      } catch {
        /* noop */
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supported])

  const start = () => {
    if (!recRef.current || listening) return
    try {
      recRef.current.start()
      setListening(true)
      setInterim('')
    } catch {
      /* already started */
    }
  }
  const stop = () => {
    recRef.current?.stop()
    setListening(false)
  }
  const reset = () => {
    setTranscript('')
    setInterim('')
  }
  const setText = (t) => setTranscript(t)

  return { supported, listening, transcript, interim, start, stop, reset, setText }
}
