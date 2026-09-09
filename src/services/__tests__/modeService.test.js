import { describe, it, expect, vi } from 'vitest'

const mockUpdateDoc = vi.fn(() => Promise.resolve())
const mockDoc = vi.fn((_db, ...parts) => parts.join('/'))
const mockServerTimestamp = vi.fn(() => 'MOCK_TIMESTAMP')

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  query: vi.fn(),
  orderBy: vi.fn(),
  onSnapshot: vi.fn(),
  addDoc: vi.fn(),
  updateDoc: (...args) => mockUpdateDoc(...args),
  deleteDoc: vi.fn(),
  getDocs: vi.fn(),
  doc: (...args) => mockDoc(...args),
  writeBatch: vi.fn(),
  serverTimestamp: () => mockServerTimestamp(),
}))

vi.mock('@/lib/firebase', () => ({
  db: {},
}))

import { archiveMode, unarchiveMode } from '../modeService'

describe('modeService mode archiving', () => {
  it('archives mode with archived: true and timestamp', async () => {
    mockUpdateDoc.mockClear()
    await archiveMode('uid_123', 'mode_abc')

    expect(mockDoc).toHaveBeenCalledWith(expect.anything(), 'users', 'uid_123', 'modes', 'mode_abc')
    expect(mockUpdateDoc).toHaveBeenCalledWith('users/uid_123/modes/mode_abc', {
      archived: true,
      archivedAt: 'MOCK_TIMESTAMP',
    })
  })

  it('unarchives mode with archived: false and timestamp', async () => {
    mockUpdateDoc.mockClear()
    await unarchiveMode('uid_123', 'mode_abc')

    expect(mockDoc).toHaveBeenCalledWith(expect.anything(), 'users', 'uid_123', 'modes', 'mode_abc')
    expect(mockUpdateDoc).toHaveBeenCalledWith('users/uid_123/modes/mode_abc', {
      archived: false,
      unarchivedAt: 'MOCK_TIMESTAMP',
    })
  })
})
