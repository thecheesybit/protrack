import { describe, it, expect, vi } from 'vitest'

const mockUpdateDoc = vi.fn(() => Promise.resolve())
const mockDoc = vi.fn((col, id) => `${col}/${id}`)

vi.mock('firebase/firestore', () => ({
  collection: vi.fn((db, ...parts) => parts.join('/')),
  query: vi.fn(),
  orderBy: vi.fn(),
  onSnapshot: vi.fn(),
  addDoc: vi.fn(),
  updateDoc: (...args) => mockUpdateDoc(...args),
  deleteDoc: vi.fn(),
  doc: (...args) => mockDoc(...args),
  writeBatch: vi.fn(),
  serverTimestamp: vi.fn(() => 'TIMESTAMP'),
}))

vi.mock('@/lib/firebase', () => ({
  db: {},
}))

vi.mock('@/services/cryptoService', () => ({
  getContentKey: vi.fn(() => Promise.resolve(null)),
  encryptObject: vi.fn((obj) => Promise.resolve(obj)),
  decryptObject: vi.fn((obj) => Promise.resolve(obj)),
}))

import { addSubtask, toggleSubtask, deleteSubtask } from '../todoService'

describe('todoService subtasks', () => {
  it('adds a subtask to the todo', async () => {
    mockUpdateDoc.mockClear()
    const initial = [{ id: 'sub_1', text: 'Subtask 1', done: false }]
    await addSubtask('uid_123', 'todo_abc', initial, 'Subtask 2')

    expect(mockUpdateDoc).toHaveBeenCalledWith(
      'users/uid_123/todos/todo_abc',
      expect.objectContaining({
        subtasks: expect.arrayContaining([
          initial[0],
          expect.objectContaining({ text: 'Subtask 2', done: false }),
        ]),
      })
    )
  })

  it('toggles a subtask completion', async () => {
    mockUpdateDoc.mockClear()
    const initial = [
      { id: 'sub_1', text: 'Subtask 1', done: false },
      { id: 'sub_2', text: 'Subtask 2', done: false },
    ]
    await toggleSubtask('uid_123', 'todo_abc', initial, 'sub_1')

    expect(mockUpdateDoc).toHaveBeenCalledWith('users/uid_123/todos/todo_abc', {
      subtasks: [
        { id: 'sub_1', text: 'Subtask 1', done: true },
        { id: 'sub_2', text: 'Subtask 2', done: false },
      ],
    })
  })

  it('deletes a subtask from the todo', async () => {
    mockUpdateDoc.mockClear()
    const initial = [
      { id: 'sub_1', text: 'Subtask 1', done: false },
      { id: 'sub_2', text: 'Subtask 2', done: true },
    ]
    await deleteSubtask('uid_123', 'todo_abc', initial, 'sub_1')

    expect(mockUpdateDoc).toHaveBeenCalledWith('users/uid_123/todos/todo_abc', {
      subtasks: [{ id: 'sub_2', text: 'Subtask 2', done: true }],
    })
  })
})
