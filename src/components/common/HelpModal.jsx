import { useEffect, useState } from 'react'
import { Command, Keyboard, MonitorSmartphone } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { isDesktop, desktopBridge } from '@/desktop/isDesktop'

const fmt = (acc) =>
  (acc || '')
    .replace('CommandOrControl', 'Ctrl')
    .replace('Command', 'Cmd')
    .replace(/\+/g, ' + ')

/** In-app keys handled by the Dashboard keydown listener + window controls. */
const IN_APP = [
  ['Ctrl / Cmd + K', 'Open the AI companion'],
  ['Ctrl / Cmd + T', 'Center the clock (Zen)'],
  ['F', 'Toggle fullscreen (when idle or already fullscreen)'],
  ['Esc', 'Close the top overlay — panel, modal, maximized widget, then fullscreen'],
  ['Double-click a widget', 'Maximize it'],
  ['Double-click empty space', 'Quick-add (subject, to-do, timetable cell)'],
  ['?', 'Open this shortcuts sheet'],
]

const WINDOW = [
  ['Title bar buttons', 'Minimize · Maximize · Close'],
  ['Hover the top edge in fullscreen', 'Slide the TopBar down to exit'],
]

function Row({ k, v }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border border-line/50 bg-surface-2/30 px-3 py-2">
      <span className="text-xs text-muted">{v}</span>
      <kbd className="shrink-0 rounded-md border border-line/70 bg-surface px-2 py-0.5 font-mono text-[11px] font-semibold text-ink">
        {k}
      </kbd>
    </div>
  )
}

/**
 * Keyboard & command reference. Opens from the ⌗ button top-right or the `?`
 * key. Global (OS-wide) shortcuts come from the Electron main process via
 * `app:info`; the rest are the in-app handlers.
 */
export function HelpModal({ open, onClose }) {
  const [globals, setGlobals] = useState(null)

  useEffect(() => {
    if (!open || !isDesktop || !desktopBridge?.appInfo) return
    desktopBridge
      .appInfo()
      .then((i) => setGlobals(i?.shortcuts || null))
      .catch(() => setGlobals(null))
  }, [open])

  return (
    <Modal open={open} onClose={onClose} title="Shortcuts & commands" className="max-w-lg">
      <div className="max-h-[70vh] space-y-5 overflow-y-auto px-5 py-4">
        {globals && (
          <section>
            <h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted">
              <Command className="h-3.5 w-3.5" /> Global (works anywhere)
            </h3>
            <div className="space-y-1.5">
              <Row k={fmt(globals.toggleWindow)} v="Show / hide the PRO TRACK window" />
              <Row k={fmt(globals.toggleFocus)} v="Pause / resume the focus timer" />
              <Row k={fmt(globals.toggleFullScreen)} v="Toggle fullscreen" />
              <Row k={fmt(globals.hideToTray)} v="Hide to the tray" />
              <Row k={fmt(globals.toggleMute)} v="Mute / unmute sounds" />
            </div>
          </section>
        )}

        <section>
          <h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted">
            <Keyboard className="h-3.5 w-3.5" /> In the app
          </h3>
          <div className="space-y-1.5">
            {IN_APP.map(([k, v]) => (
              <Row key={k} k={k} v={v} />
            ))}
          </div>
        </section>

        {isDesktop && (
          <section>
            <h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted">
              <MonitorSmartphone className="h-3.5 w-3.5" /> Window
            </h3>
            <div className="space-y-1.5">
              {WINDOW.map(([k, v]) => (
                <Row key={k} k={k} v={v} />
              ))}
            </div>
          </section>
        )}

        <p className="pt-1 text-center text-[11px] text-muted/70">
          More in Settings → Shortcuts.
        </p>
      </div>
    </Modal>
  )
}
