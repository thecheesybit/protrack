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
  const [speechActive, setSpeechActive] = useState(false)

  const recRef = useRef(null)
  const shouldBeListening = useRef(false)
  const useFallback = useRef(false)   // once native fails, stay on fallback
  const mrRef = useRef(null)          // MediaRecorder instance
  const chunksRef = useRef([])        // recorded audio chunks
  const vadIntervalRef = useRef(null) // VAD check interval
  const audioCtxRef = useRef(null)    // AudioContext ref

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
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })
      const mr = new MediaRecorder(stream)
      chunksRef.current = []
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      mr.onstop = async () => {
        if (vadIntervalRef.current) {
          clearInterval(vadIntervalRef.current)
          vadIntervalRef.current = null
        }
        if (audioCtxRef.current) {
          try { audioCtxRef.current.close() } catch { /* already closed */ }
          audioCtxRef.current = null
        }
        stream.getTracks().forEach((t) => t.stop())
        if (chunksRef.current.length === 0) {
          setListening(false)
          return
        }
        setTranscribing(true)
        try {
          const blob = new Blob(chunksRef.current, { type: mr.mimeType || 'audio/webm' })
          const text = await transcribeAudio(blob)
          if (text) setTranscript((t) => (t ? `${t} ${text}` : text).trim())
        } catch (err) {
          console.error('[speech] Gemini transcription failed', err)
          setError(`Transcription failed: ${err.message || 'Check your API key in Settings'}`)
        } finally {
          setTranscribing(false)
          setListening(false)
        }
      }
      mr.start(200)
      mrRef.current = mr
      setListening(true)
      setError(null)

      // Smart VAD: differentiates initial pause from post-speech silence.
      // Never burns tokens transcribing quiet rooms.
      let hasSpoken = false
      let speechEndStart = null
      const recordingStart = Date.now()
      const INITIAL_SILENCE_TIMEOUT = 7000
      const POST_SPEECH_SILENCE_TIMEOUT = 1400
      const MAX_RECORDING_DURATION = 15000
      const VOICE_THRESHOLD = 8

      try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)()
        audioCtxRef.current = audioCtx
        const source = audioCtx.createMediaStreamSource(stream)
        const analyser = audioCtx.createAnalyser()
        analyser.fftSize = 256
        const bufferLength = analyser.frequencyBinCount
        const dataArray = new Uint8Array(bufferLength)
        source.connect(analyser)

        vadIntervalRef.current = setInterval(() => {
          analyser.getByteFrequencyData(dataArray)
          let sum = 0
          for (let i = 0; i < bufferLength; i++) {
            sum += dataArray[i]
          }
          const averageVolume = sum / bufferLength

          if (averageVolume >= VOICE_THRESHOLD) {
            hasSpoken = true
            speechEndStart = null
            setSpeechActive(true)
          } else {
            setSpeechActive(false)
            if (!hasSpoken) {
              // Still waiting for speech to start
              if (Date.now() - recordingStart > INITIAL_SILENCE_TIMEOUT) {
                // Room is silent: discard chunks and stop without transcribing empty audio
                if (mr.state !== 'inactive') {
                  chunksRef.current = []
                  mr.stop()
                }
              }
            } else {
              // Speech occurred, user has now paused
              if (!speechEndStart) {
                speechEndStart = Date.now()
              } else if (Date.now() - speechEndStart > POST_SPEECH_SILENCE_TIMEOUT) {
                // Finished sentence: stop and transcribe real speech
                if (mr.state !== 'inactive') {
                  mr.stop()
                }
              }
            }
          }

          if (Date.now() - recordingStart > MAX_RECORDING_DURATION && mr.state !== 'inactive') {
            mr.stop()
          }
        }, 100)
      } catch (vadErr) {
        console.warn('[speech-vad] Failed to initialize AudioContext VAD:', vadErr)
      }
    } catch {
      setError('Microphone access denied — check your system permissions')
    }
  }, [])

  const stopFallback = useCallback(() => {
    setSpeechActive(false)
    if (vadIntervalRef.current) {
      clearInterval(vadIntervalRef.current)
      vadIntervalRef.current = null
    }
    if (audioCtxRef.current) {
      try { audioCtxRef.current.close() } catch { /* already closed */ }
      audioCtxRef.current = null
    }
    if (mrRef.current && mrRef.current.state !== 'inactive') {
      mrRef.current.stop()
    }
  }, [])

  /* ── Public API ─────────────────────────────────────── */

  const start = useCallback(() => {
    setError(null)
    // On desktop (Electron) the Web Speech API is available but always errors with
    // `service-not-allowed` because Electron's renderer restricts the Google speech
    // service. Route directly to the reliable MediaRecorder → Gemini path instead.
    if (useFallback.current || !Recognition || isDesktop) {
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
    speechActive,
  }
}
