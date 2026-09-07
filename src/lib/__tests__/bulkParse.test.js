import { describe, it, expect } from 'vitest'
import { bulkParse } from '../bulkParse'

describe('bulkParse', () => {
  it('parses "lesson 18 to 36" into 19 lesson titles', () => {
    const res = bulkParse('lesson 18 to 36')
    expect(res).not.toBeNull()
    expect(res.count).toBe(19)
    expect(res.titles).toHaveLength(19)
    expect(res.titles[0]).toBe('Lesson 18')
    expect(res.titles[18]).toBe('Lesson 36')
    expect(res.template).toBe('Lesson {n}')
  })

  it('parses "add lesson 18 to 36" stripping action prefixes', () => {
    const res = bulkParse('add lesson 18 to 36')
    expect(res).not.toBeNull()
    expect(res.count).toBe(19)
    expect(res.titles[0]).toBe('Lesson 18')
  })

  it('handles plural labels "lessons 18-22"', () => {
    const res = bulkParse('lessons 18-22')
    expect(res).not.toBeNull()
    expect(res.count).toBe(5)
    expect(res.titles).toEqual([
      'Lesson 18',
      'Lesson 19',
      'Lesson 20',
      'Lesson 21',
      'Lesson 22',
    ])
  })

  it('handles ranges with en-dash, em-dash, and dots', () => {
    const dashRes = bulkParse('lectures 10–12')
    expect(dashRes).not.toBeNull()
    expect(dashRes.titles).toEqual(['Lecture 10', 'Lecture 11', 'Lecture 12'])

    const dotRes = bulkParse('task 1..5')
    expect(dotRes).not.toBeNull()
    expect(dotRes.titles).toEqual(['Task 1', 'Task 2', 'Task 3', 'Task 4', 'Task 5'])
  })

  it('handles "ch" alias as "Chapter"', () => {
    const res = bulkParse('ch 1-3')
    expect(res).not.toBeNull()
    expect(res.titles).toEqual(['Chapter 1', 'Chapter 2', 'Chapter 3'])
  })

  it('handles pure numeric ranges "1-5" defaulting label to "Task"', () => {
    const res = bulkParse('1-5')
    expect(res).not.toBeNull()
    expect(res.count).toBe(5)
    expect(res.titles).toEqual(['Task 1', 'Task 2', 'Task 3', 'Task 4', 'Task 5'])
  })

  it('handles discrete lists of numbers like "chapters 3, 5, 7"', () => {
    const res = bulkParse('chapters 3, 5, 7')
    expect(res).not.toBeNull()
    expect(res.count).toBe(3)
    expect(res.titles).toEqual(['Chapter 3', 'Chapter 5', 'Chapter 7'])
  })

  it('handles comma-separated task lists', () => {
    const res = bulkParse('read notes, review quiz, submit assignment')
    expect(res).not.toBeNull()
    expect(res.count).toBe(3)
    expect(res.titles).toEqual(['Read notes', 'Review quiz', 'Submit assignment'])
    expect(res.template).toBeNull()
  })

  it('handles multi-line task lists', () => {
    const multiline = `
- Read Chapter 4
- Complete exercise 4.2
- Review flashcards
`
    const res = bulkParse(multiline)
    expect(res).not.toBeNull()
    expect(res.count).toBe(3)
    expect(res.titles).toEqual([
      'Read Chapter 4',
      'Complete exercise 4.2',
      'Review flashcards',
    ])
  })

  it('returns null for non-range, non-list natural language prompts', () => {
    expect(bulkParse('prepare for the upcoming biology midterm')).toBeNull()
    expect(bulkParse('study for 2 hours today')).toBeNull()
    expect(bulkParse('')).toBeNull()
    expect(bulkParse(null)).toBeNull()
  })

  it('caps very large ranges to MAX_BULK_ITEMS with a warning', () => {
    const res = bulkParse('1 to 1000')
    expect(res).not.toBeNull()
    expect(res.count).toBe(500)
    expect(res.warning).toContain('Capped at 500')
  })
})
