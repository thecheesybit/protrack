import { useEffect, useRef } from 'react'
import { useStore } from '@/store/useStore'
import { useYouTubeVolume } from '@/hooks/useYouTubeVolume'
import { DEFAULT_FOCUS_SCENE, youtubeId, buildSceneEmbedUrl } from '@/lib/focusScenes'

/**
 * The ONE persistent Deep Focus scene host. Mounted once at the workspace root
 * so the same `<iframe>` element survives every transition — focus-lock,
 * Picture-in-Picture, and back — without ever reloading (which would restart the
 * video / audio).
 *
 * It repositions itself per state:
 *   - focus-locked, not PiP, video ok → full cover-fill background (z-40, behind
 *     the lock panel) with a cinematic dim.
 *   - otherwise (board visible, or PiP)   → a 1×1 hidden player: audio only.
 */
export function FocusSceneVideo() {
  const status = useStore((s) => s.status)
  const focusLocked = useStore((s) => s.focusLocked)
  const pipActive = useStore((s) => s.pipActive)
  const userFocusAudioUrl = useStore((s) => s.settings?.focusAudioUrl || '')
  const focusVideoEnabled = useStore((s) => s.settings?.focusVideoEnabled !== false)
  const volume = useStore((s) => s.volume)
  const muted = useStore((s) => s.muted)
  const sceneVideoError = useStore((s) => s.sceneVideoError)
  const setSceneVideoError = useStore((s) => s.setSceneVideoError)

  const iframeRef = useRef(null)
  const onIframeLoad = useYouTubeVolume(iframeRef, volume, muted, status === 'running')

  const focusAudioUrl = userFocusAudioUrl || DEFAULT_FOCUS_SCENE.url
  const videoId = youtubeId(focusAudioUrl)

  // Reset the error gate whenever the chosen scene changes.
  useEffect(() => {
    setSceneVideoError(false)
  }, [videoId, setSceneVideoError])

  // YouTube IFrame API onError → fall back to the gradient in the lock screen.
  useEffect(() => {
    const onMessage = (e) => {
      if (e.origin !== 'https://www.youtube.com') return
      try {
        const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data
        if (data?.event === 'onError') setSceneVideoError(true)
      } catch {
        /* not a JSON control message */
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [setSceneVideoError])

  // Nothing to play.
  if (status !== 'running' || !focusAudioUrl || !focusVideoEnabled) return null

  // Direct audio URL (not YouTube) — simple looping <audio>.
  if (!videoId) {
    return (
      <audio
        key={focusAudioUrl}
        src={focusAudioUrl}
        autoPlay
        loop
        muted={muted}
        className="sr-only"
        ref={(el) => {
          if (el) el.volume = volume ?? 0.5
        }}
      />
    )
  }

  const coverMode = focusLocked && !pipActive && !sceneVideoError
  const embedUrl = buildSceneEmbedUrl(videoId)

  return (
    <div
      aria-hidden
      className={
        coverMode
          ? 'pointer-events-none fixed inset-0 z-40 overflow-hidden'
          : 'sr-only'
      }
    >
      <iframe
        key={videoId}
        ref={iframeRef}
        src={embedUrl}
        onLoad={onIframeLoad}
        allow="autoplay; fullscreen"
        title="Focus scene"
        style={{
          border: 0,
          pointerEvents: 'none',
          position: 'absolute',
          width: '177.78vh',
          height: '56.25vw',
          minWidth: '100%',
          minHeight: '100%',
          top: '50%',
          left: '50%',
          // Overfill so YouTube's edge chrome is cropped off-screen.
          transform: 'translate(-50%, -50%) scale(1.35)',
        }}
      />
      {coverMode && (
        <>
          <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/45 to-black/80" />
        </>
      )}
    </div>
  )
}
