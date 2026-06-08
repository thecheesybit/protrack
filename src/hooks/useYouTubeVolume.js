import { useEffect, useRef } from 'react'

/**
 * Syncs volume (0-1) and mute state to a YouTube iframe via the IFrame Player
 * API postMessage protocol. The iframe `src` MUST include `enablejsapi=1`.
 *
 * Returns an `onLoad` handler to spread onto the iframe so the API "listening"
 * handshake fires once the frame is ready. After the API reports `onReady`,
 * volume + mute are pushed immediately and on every subsequent change.
 *
 * Muting keeps the video playing visually but silences it (so a Deep Focus
 * background scene stays on screen while the audio drops).
 *
 * @param {{ current: HTMLIFrameElement | null }} iframeRef
 * @param {number} volume 0..1
 * @param {boolean} muted
 * @returns {() => void} onLoad handler
 */
export function useYouTubeVolume(iframeRef, volume, muted) {
  const readyRef = useRef(false)

  const post = (func, args = []) => {
    const iframe = iframeRef.current
    if (!iframe?.contentWindow) return
    try {
      iframe.contentWindow.postMessage(
        JSON.stringify({ event: 'command', func, args }),
        'https://www.youtube.com',
      )
    } catch {
      /* cross-origin until the API initialises */
    }
  }

  const sync = () => {
    post('setVolume', [Math.round((volume ?? 0.5) * 100)])
    if (muted) post('mute')
    else post('unMute')
  }

  // Listen for the YT API ready signal, then push the current state.
  useEffect(() => {
    const onMessage = (e) => {
      if (e.origin !== 'https://www.youtube.com') return
      try {
        const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data
        if (data?.event === 'onReady') {
          readyRef.current = true
          sync()
        }
      } catch {
        /* not a JSON control message */
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Re-sync whenever volume or mute changes (once the API is ready).
  useEffect(() => {
    if (readyRef.current) sync()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [volume, muted])

  // Register this frame with the IFrame API on load.
  return () => {
    const iframe = iframeRef.current
    if (!iframe?.contentWindow) return
    try {
      iframe.contentWindow.postMessage(
        JSON.stringify({ event: 'listening', id: 1, channel: 'widget' }),
        'https://www.youtube.com',
      )
    } catch {
      /* noop */
    }
  }
}
