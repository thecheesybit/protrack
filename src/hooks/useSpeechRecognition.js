import { useEffect, useRef, useState, useCallback } from 'react'
import { isDesktop } from '@/desktop/isDesktop'
import { hasGeminiKey, transcribeAudio } from '@/services/geminiService'

/**
 * Voice-to-text hook with two backends:
 *  1. WebSpeechAPI (browser/DEV): low-latency streaming, preferred when available.
 *  2. MediaRecorder → Gemini (Electron): push-to-talk; records while listening=true,
 *     transcribes on stop(). Activated automatically when the Web Speech API errors
 *     with a non-recoverable code (network / service-not-allowed / not-allowed).
 *
 * Consumers see the same interface regardless of which backend is active.
 */
export function useSpeechRecognition() {
  const Recognition =
    typeof window !== 'undefined' &&
    (window.SpeechRecognition || window.webkitSpeechRecognition)
  const supported = Boolean(Recognition) || isDesktop

  const [listening, setListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [interim, setInterim] = useState('')
  const [error, setError] = useState(null)          // null | string
  const [transcribing, setTranscribing] = useState(false) // Gemini in-flight

  const recRef = useRef(null)
  const shouldBeListening = useRef(false)
  const useFallback = useRef(false)   // once native fails, stay on fallback
  const mrRef = useRef(null)          // MediaRecorder instance
  const chunksRef = useRef([])        // recorded audio chunks

  /* ── Web Speech API backend ──────────────────────────── */

  useEffect(() => {
    if (!Recognition) return undefined
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
      setError(null) // clear any prior error on successful result
    }

    rec.onend = () => {
      if (shouldBeListening.current && !useFallback.current) {
        try { rec.start() } catch { setListening(false) }
      } else {
        setListening(false)
      }
    }

    rec.onerror = (e) => {
      const fatal = ['not-allowed', 'service-not-allowed', 'network']
      if (fatal.includes(e.error)) {
        shouldBeListening.current = false
        setListening(false)
        if (isDesktop && hasGeminiKey()) {
          // Switch transparently to the Gemini fallback
          useFallback.current = true
          setError(null) // no error shown — fallback is available
        } else {
          const msg = e.error === 'not-allowed'
            ? 'Microphone access denied — check your system permissions'
            : isDesktop
              ? 'Voice input requires a Gemini API key — add it in Settings'
              : 'Voice input is unavailable in this environment'
          setError(msg)
        }
      }
      // non-fatal (no-speech, aborted): onend will handle restart
    }

    recRef.current = rec
    return () => {
      shouldBeListening.current = false
      try { rec.stop() } catch { /* noop */ }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!Recognition])

  /* ── MediaRecorder → Gemini fallback ────────────────── */

  const startFallback = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Microphone not available')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream)
      chunksRef.current = []
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        if (chunksRef.current.length === 0) return
        setTranscribing(true)
        try {
          const blob = new Blob(chunksRef.current, { type: mr.mimeType || 'audio/webm' })
          const text = await transcribeAudio(blob)
          if (text) setTranscript((t) => (t ? `${t} ${text}` : text).trim())
        } catch (err) {
          console.error('[speech] Gemini transcription failed', err)
          setError('Transcription failed — check your Gemini key in Settings')
        } finally {
          setTranscribing(false)
          setListening(false)
        }
      }
      mr.start()
      mrRef.current = mr
      setListening(true)
      setError(null)
    } catch (err) {
      setError('Microphone access denied — check your system permissions')
    }
  }, [])

  const stopFallback = useCallback(() => {
    if (mrRef.current && mrRef.current.state !== 'inactive') {
      mrRef.current.stop()
    }
  }, [])

  /* ── Public API ─────────────────────────────────────── */

  const start = useCallback(() => {
    setError(null)
    if (useFallback.current || (!Recognition && isDesktop)) {
      useFallback.current = true
      startFallback()
      return
    }
    if (!recRef.current) return
    shouldBeListening.current = true
    try {
      recRef.current.start()
      setListening(true)
      setInterim('')
    } catch {
      setListening(true) // already started
    }
  }, [startFallback, Recognition])

  const stop = useCallback(() => {
    if (useFallback.current) {
      stopFallback()
    } else {
      shouldBeListening.current = false
      recRef.current?.stop()
      setListening(false)
    }
    setInterim('')
  }, [stopFallback])

  const reset = useCallback(() => {
    setTranscript('')
    setInterim('')
    setError(null)
  }, [])

  const setText = useCallback((t) => setTranscript(t), [])

  return {
    supported,
    listening,
    transcript,
    interim,
    error,
    transcribing,
    start,
    stop,
    reset,
    setText,
    isFallback: useFallback.current,
  }
}
