import { Modal } from '@/components/ui/Modal'
import { CompanionPairingPanel } from './CompanionPairingPanel'

/**
 * Modal wrapper around {@link CompanionPairingPanel}. The panel is only mounted
 * while the modal is open, so its own unmount-cleanup tears down any live
 * handshake session when the modal closes.
 */
export function LinkTabletModal({ open, onClose }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Link Tablet Companion"
      className="max-w-md p-0 overflow-hidden"
    >
      {open && <CompanionPairingPanel />}
    </Modal>
  )
}
