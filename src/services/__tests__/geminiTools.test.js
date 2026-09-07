import { describe, it, expect } from 'vitest'
import { TOOL_DECLARATIONS } from '../geminiTools'

describe('geminiTools', () => {
  it('declares add_tasks_bulk tool with required parameters', () => {
    const funcs = TOOL_DECLARATIONS[0].functionDeclarations
    const bulkTool = funcs.find((f) => f.name === 'add_tasks_bulk')
    expect(bulkTool).toBeDefined()
    expect(bulkTool.parameters.required).toContain('subjectName')
    expect(bulkTool.parameters.required).toContain('titles')
    expect(bulkTool.parameters.properties.titles.type).toBeDefined()
  })

  it('declares all expected tools', () => {
    const funcs = TOOL_DECLARATIONS[0].functionDeclarations
    const names = funcs.map((f) => f.name)
    expect(names).toContain('complete_task')
    expect(names).toContain('set_subject_progress')
    expect(names).toContain('add_subject')
    expect(names).toContain('add_task')
    expect(names).toContain('add_tasks_bulk')
    expect(names).toContain('add_todo')
    expect(names).toContain('mark_todo_done')
    expect(names).toContain('add_timetable_slot')
    expect(names).toContain('toggle_habit_today')
    expect(names).toContain('add_habit')
    expect(names).toContain('set_todo_due')
  })
})
