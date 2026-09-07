import { useEffect, useRef, useCallback } from 'react'

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

  const post = useCallback((func, args = []) => {
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
  }, [iframeRef])

  // Turn captions off hard. cc_load_policy in the URL is not enough — YouTube can
  // restore the viewer's global "captions on" preference — so we also unload the
  // captions modules (both the modern `captions` and legacy `cc` names) and clear
  // the active track once the API is live.
  const disableCaptions = useCallback(() => {
    post('unloadModule', ['captions'])
    post('unloadModule', ['cc'])
    post('setOption', ['captions', 'track', {}])
    post('setOption', ['cc', 'track', {}])
  }, [post])

  const sync = useCallback(() => {
    post('setVolume', [Math.round((volume ?? 0.5) * 100)])
    if (muted) post('mute')
    else post('unMute')
  }, [post, volume, muted])

  // Listen for the YT API ready signal, then push the current state.
  useEffect(() => {
    const timers = []
    // The caption track ("[Music]", auto-captions) loads asynchronously a beat
    // AFTER playback begins, so a single onReady call misses it. Fire a short
    // burst of retries to catch it whenever it appears.
    const killCaptionsBurst = () => {
      disableCaptions()
      ;[400, 1200, 2500, 5000].forEach((ms) =>
        timers.push(setTimeout(disableCaptions, ms)),
      )
    }
    const onMessage = (e) => {
      if (e.origin !== 'https://www.youtube.com') return
      try {
        const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data
        if (data?.event === 'onReady') {
          readyRef.current = true
          sync()
          killCaptionsBurst()
        }
        // onApiChange fires when a module (e.g. captions) loads its API; the
        // player starting to play (onStateChange info=1) is another moment the
        // caption track can appear. Clear captions on both.
        if (data?.event === 'onApiChange') disableCaptions()
        if (data?.event === 'onStateChange' && data?.info === 1) killCaptionsBurst()
      } catch {
        /* not a JSON control message */
      }
    }
    window.addEventListener('message', onMessage)
    return () => {
      window.removeEventListener('message', onMessage)
      timers.forEach(clearTimeout)
    }
  }, [sync, disableCaptions])

  // Re-sync whenever volume or mute changes (once the API is ready).
  useEffect(() => {
    if (readyRef.current) sync()
  }, [sync])

  // Register this frame with the IFrame API on load.
  return () => {
    readyRef.current = false
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
