/**
 * Pure range and list parser for bulk task creation.
 *
 * Deterministically parses inputs like:
 *  - "lesson 18 to 36", "lessons 18-36", "lesson 18..36"
 *  - "chapter 1 to 5", "chapters 3, 5, 7", "ch 1-5"
 *  - "lectures 10–12", "task 1..5", "1-5", "1 to 5"
 *  - Comma-separated or newline-separated task lists ("Read notes, review quiz, submit assignment")
 *
 * Returns `{ titles: string[], template: string|null, count: number, warning?: string }`
 * or `null` if the input cannot be deterministically parsed as a range or multi-item list
 * (triggering the Gemini AI fallback).
 */

const MAX_BULK_ITEMS = 500

function capitalize(str) {
  if (!str) return ''
  return str.charAt(0).toUpperCase() + str.slice(1)
}

/**
 * Strips leading conversational prefixes like "add ", "please create ", "generate ", etc.
 */
function stripPrefix(raw) {
  let s = (raw || '').trim()
  // Remove markdown bullet or numbering if at start
  s = s.replace(/^[-*•]\s+/, '')
  // Remove common action verbs
  const prefixRegex = /^(?:please\s+)?(?:add|create|make|generate|insert|schedule|new)\s+(?:task[s]?\s+for\s+|tasks\s+|to-dos\s+|todos\s+)?/i
  return s.replace(prefixRegex, '').trim()
}

export function bulkParse(input) {
  if (!input || typeof input !== 'string') return null
  const cleaned = stripPrefix(input)
  if (!cleaned) return null

  // 1. Multi-line list (at least 2 non-empty lines)
  const lines = cleaned
    .split(/\r?\n/)
    .map((l) => l.replace(/^[-*•\d+.)]\s*/, '').trim())
    .filter(Boolean)
  if (lines.length >= 2) {
    const titles = lines.slice(0, MAX_BULK_ITEMS).map((t) => capitalize(t))
    return {
      titles,
      template: null,
      count: titles.length,
      warning: lines.length > MAX_BULK_ITEMS ? `Capped at ${MAX_BULK_ITEMS} tasks.` : undefined,
    }
  }

  // 2. Numeric range with optional prefix label:
  // e.g. "lesson 18 to 36", "lessons 18-36", "chapters 1..10", "ch 5 to 12", "1-5", "1 to 5"
  const rangeRegex = /^(?:([a-z\s]+?)\s+)?(\d+)\s*(?:-|–|—|\.\.|to)\s*(\d+)$/i
  const rangeMatch = cleaned.match(rangeRegex)
  if (rangeMatch) {
    const rawLabel = (rangeMatch[1] || '').trim()
    const startNum = parseInt(rangeMatch[2], 10)
    const endNum = parseInt(rangeMatch[3], 10)

    // Normalize label (e.g., "lessons" -> "Lesson", "ch" -> "Chapter")
    let label
    if (rawLabel) {
      const singular = rawLabel.replace(/s$/i, '')
      label = capitalize(singular.toLowerCase() === 'ch' ? 'Chapter' : singular)
    } else {
      label = 'Task'
    }

    if (startNum <= endNum) {
      const total = endNum - startNum + 1
      const count = Math.min(total, MAX_BULK_ITEMS)
      const titles = []
      for (let i = 0; i < count; i++) {
        const num = startNum + i
        titles.push(`${label} ${num}`)
      }
      return {
        titles,
        template: `${label} {n}`,
        count: titles.length,
        warning: total > MAX_BULK_ITEMS ? `Capped at ${MAX_BULK_ITEMS} tasks.` : undefined,
      }
    }
  }

  // 3. Discrete list of numbers with label:
  // e.g. "chapters 3, 5, 7", "lesson 1, 2, 4, 8"
  const discreteNumbersRegex = /^([a-z\s]+?)\s+(\d+(?:\s*,\s*\d+)+)$/i
  const discreteMatch = cleaned.match(discreteNumbersRegex)
  if (discreteMatch) {
    const rawLabel = discreteMatch[1].trim()
    let singular = rawLabel.replace(/s$/i, '')
    if (singular.toLowerCase() === 'ch') singular = 'Chapter'
    const label = capitalize(singular)

    const numbers = discreteMatch[2]
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, MAX_BULK_ITEMS)

    if (numbers.length >= 2) {
      const titles = numbers.map((n) => `${label} ${n}`)
      return {
        titles,
        template: `${label} {n}`,
        count: titles.length,
      }
    }
  }

  // 4. Comma-separated list of items (at least 2 items, e.g. "read notes, review quiz, submit assignment")
  if (cleaned.includes(',')) {
    const parts = cleaned
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean)
    if (parts.length >= 2) {
      const titles = parts.slice(0, MAX_BULK_ITEMS).map((p) => capitalize(p))
      return {
        titles,
        template: null,
        count: titles.length,
        warning: parts.length > MAX_BULK_ITEMS ? `Capped at ${MAX_BULK_ITEMS} tasks.` : undefined,
      }
    }
  }

  // Could not deterministically match a range or multi-item list
  return null
}
