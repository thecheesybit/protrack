import { useEffect, useRef, useState, useCallback } from 'react'
import { Modal } from '@/components/ui/Modal'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Spinner } from '@/components/ui/Spinner'
import { extractSessionId } from '@/services/companionLinkService'

export function QrScannerModal({ open, onClose, onScanSuccess }) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const [cameraError, setCameraError] = useState(null)
  const [scanning, setScanning] = useState(false)
  const isScanningRef = useRef(false)

  const stopCamera = useCallback(() => {
    isScanningRef.current = false
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
  }, [])

  const startCamera = useCallback(async () => {
    setCameraError(null)
    setScanning(true)
    isScanningRef.current = true

    try {
      if (!navigator?.mediaDevices?.getUserMedia) {
        throw new Error('Camera access is not supported on this device/browser.')
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      })

      if (!isScanningRef.current) {
        stream.getTracks().forEach((t) => t.stop())
        return
      }

      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play().catch(() => {})
      }

      // Check if BarcodeDetector API is available (natively in Chromium / Android WebView)
      if ('BarcodeDetector' in window) {
        const barcodeDetector = new window.BarcodeDetector({ formats: ['qr_code'] })

        const scanFrame = async () => {
          if (!isScanningRef.current || !videoRef.current) return

          try {
            if (videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
              const barcodes = await barcodeDetector.detect(videoRef.current)
              if (barcodes.length > 0) {
                const rawValue = barcodes[0].rawValue
                const sessionId = extractSessionId(rawValue)
                if (sessionId) {
                  stopCamera()
                  onScanSuccess?.(sessionId)
                  return
                }
              }
            }
          } catch {
            /* ignore individual frame detection glitch */
          }

          if (isScanningRef.current) {
            requestAnimationFrame(scanFrame)
          }
        }

        requestAnimationFrame(scanFrame)
      } else {
        // Fallback info if BarcodeDetector not supported
        console.info('[scanner] BarcodeDetector not in window, camera stream active.')
      }
    } catch (err) {
      console.warn('[scanner] camera init failed:', err)
      setCameraError(err.message || 'Could not access camera.')
    } finally {
      setScanning(false)
    }
  }, [onScanSuccess, stopCamera])

  useEffect(() => {
    if (open) {
      startCamera()
    } else {
      stopCamera()
    }

    return () => {
      stopCamera()
    }
  }, [open, startCamera, stopCamera])

  return (
    <Modal
      open={open}
      onClose={() => {
        stopCamera()
        onClose?.()
      }}
      title="Scan Desktop QR"
      className="max-w-sm p-0 overflow-hidden"
    >
      <div className="relative flex flex-col items-center p-4">
        {cameraError ? (
          <div className="flex flex-col items-center gap-3 p-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500/15 text-rose-400">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <h4 className="font-semibold text-sm">Camera Unavailable</h4>
            <p className="text-xs text-muted leading-relaxed max-w-xs">{cameraError}</p>
            <div className="flex gap-2 mt-2">
              <button
                type="button"
                onClick={startCamera}
                className="flex items-center gap-1.5 rounded-xl border border-line bg-surface-2 px-3 py-1.5 text-xs font-semibold text-ink"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Retry Camera
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl bg-accent px-4 py-1.5 text-xs font-semibold text-white"
              >
                Enter Code Manually
              </button>
            </div>
          </div>
        ) : (
          <div className="relative w-full aspect-square rounded-2xl overflow-hidden bg-black flex items-center justify-center">
            <video
              ref={videoRef}
              playsInline
              muted
              className="absolute inset-0 w-full h-full object-cover"
            />

            {/* Viewfinder reticle overlay */}
            <div className="pointer-events-none absolute inset-8 rounded-2xl border-2 border-accent/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]">
              <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-accent" />
              <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-accent" />
              <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-accent" />
              <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-accent" />
            </div>

            {scanning && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                <Spinner className="h-8 w-8 text-accent" />
              </div>
            )}
          </div>
        )}

        <div className="mt-4 flex flex-col items-center text-center gap-1">
          <p className="text-xs text-muted">
            Point camera at the &ldquo;Link Tablet Companion&rdquo; QR code on your desktop.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="mt-2 text-xs font-semibold text-accent hover:underline"
          >
            Cancel and enter pairing code instead
          </button>
        </div>
      </div>
    </Modal>
  )
}
