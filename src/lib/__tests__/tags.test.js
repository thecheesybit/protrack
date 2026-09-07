import { describe, it, expect } from 'vitest'
import {
  normalizeTag,
  isValidTag,
  parseHashtags,
  deriveAutoTags,
  mergeTags,
  toHashtag,
  TAG_RE,
} from '../tags.js'

// ---------------------------------------------------------------------------
// normalizeTag
// ---------------------------------------------------------------------------
describe('normalizeTag', () => {
  it('lowercases and keeps a simple word intact', () => {
    expect(normalizeTag('Calculus')).toBe('calculus')
  })

  it('strips one or more leading hashes', () => {
    expect(normalizeTag('#deep-work')).toBe('deep-work')
    expect(normalizeTag('##urgent')).toBe('urgent')
  })

  it('turns whitespace, underscores and punctuation into single hyphens', () => {
    expect(normalizeTag('Deep Work')).toBe('deep-work')
    expect(normalizeTag('deep_work')).toBe('deep-work')
    expect(normalizeTag('deep.work!')).toBe('deep-work')
    expect(normalizeTag('a / b / c')).toBe('a-b-c')
  })

  it('collapses repeated separators and trims edge hyphens', () => {
    expect(normalizeTag('deep--work')).toBe('deep-work')
    expect(normalizeTag('  -deep-  ')).toBe('deep')
    expect(normalizeTag('---')).toBe('')
  })

  it('collapses the documented equivalents to the same slug', () => {
    const forms = ['#Deep Work', 'deep_work', 'deep--work', '  Deep   Work  ']
    for (const f of forms) expect(normalizeTag(f)).toBe('deep-work')
  })

  it('keeps digits and Unicode letters (lowercased)', () => {
    expect(normalizeTag('Week 3')).toBe('week-3')
    expect(normalizeTag('Café Notes')).toBe('café-notes')
    expect(normalizeTag('Ελληνικά')).toBe('ελληνικά')
  })

  it('returns "" for non-strings and empty / symbol-only input', () => {
    expect(normalizeTag(null)).toBe('')
    expect(normalizeTag(undefined)).toBe('')
    expect(normalizeTag(42)).toBe('')
    expect(normalizeTag('')).toBe('')
    expect(normalizeTag('   ')).toBe('')
    expect(normalizeTag('#')).toBe('')
    expect(normalizeTag('!!!')).toBe('')
  })

  it('is idempotent — normalizing a normalized tag is a no-op', () => {
    const once = normalizeTag('#Some Complex_Tag!!')
    expect(normalizeTag(once)).toBe(once)
  })
})

// ---------------------------------------------------------------------------
// isValidTag / TAG_RE
// ---------------------------------------------------------------------------
describe('isValidTag', () => {
  it('accepts clean slugs', () => {
    expect(isValidTag('calculus')).toBe(true)
    expect(isValidTag('deep-work')).toBe(true)
    expect(isValidTag('week-3')).toBe(true)
  })

  it('rejects malformed or non-string values', () => {
    expect(isValidTag('#calculus')).toBe(false)
    expect(isValidTag('deep work')).toBe(false)
    expect(isValidTag('-lead')).toBe(false)
    expect(isValidTag('trail-')).toBe(false)
    expect(isValidTag('double--dash')).toBe(false)
    expect(isValidTag('')).toBe(false)
    expect(isValidTag(null)).toBe(false)
  })

  it('every normalizeTag output that is non-empty matches TAG_RE', () => {
    for (const raw of ['#Deep Work', 'a/b', 'Week   3', 'café_notes']) {
      const t = normalizeTag(raw)
      expect(t).not.toBe('')
      expect(TAG_RE.test(t)).toBe(true)
    }
  })
})

// ---------------------------------------------------------------------------
// parseHashtags
// ---------------------------------------------------------------------------
describe('parseHashtags', () => {
  it('extracts a single hashtag', () => {
    expect(parseHashtags('revise #calculus tonight')).toEqual(['calculus'])
  })

  it('extracts multiple hashtags in first-seen order', () => {
    expect(parseHashtags('#morning plan then #gym and #reading')).toEqual([
      'morning',
      'gym',
      'reading',
    ])
  })

  it('de-dupes case-insensitively', () => {
    expect(parseHashtags('#Focus deep #focus and #FOCUS')).toEqual(['focus'])
  })

  it('matches a hashtag at the very start of the string', () => {
    expect(parseHashtags('#kickoff meeting')).toEqual(['kickoff'])
  })

  it('matches a hashtag right after an opening paren', () => {
    expect(parseHashtags('note (#idea) here')).toEqual(['idea'])
  })

  it('ignores a "#" embedded mid-word (URL fragments, colours)', () => {
    expect(parseHashtags('see https://example.com/page#section for #details')).toEqual([
      'details',
    ])
    expect(parseHashtags('colour #fff vs plain fff#bar')).toEqual(['fff'])
  })

  it('ignores a bare "#" with no following word char', () => {
    expect(parseHashtags('a # b #')).toEqual([])
  })

  it('normalizes hyphen/underscore inside the tag body', () => {
    expect(parseHashtags('ship #deep_work and #q1-goals')).toEqual(['deep-work', 'q1-goals'])
  })

  it('returns [] for empty / non-string input', () => {
    expect(parseHashtags('')).toEqual([])
    expect(parseHashtags(null)).toEqual([])
    expect(parseHashtags(undefined)).toEqual([])
    expect(parseHashtags(123)).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// deriveAutoTags
// ---------------------------------------------------------------------------
describe('deriveAutoTags', () => {
  it('combines parsed hashtags with subject and mode slugs', () => {
    expect(
      deriveAutoTags({ text: 'revise #calculus', subjectName: 'Maths', modeName: 'Study' }),
    ).toEqual(['calculus', 'maths', 'study'])
  })

  it('slugifies multi-word subject and mode names', () => {
    expect(
      deriveAutoTags({ text: '', subjectName: 'Organic Chemistry', modeName: 'Exam Prep' }),
    ).toEqual(['organic-chemistry', 'exam-prep'])
  })

  it('de-dupes when a hashtag already equals the subject or mode slug', () => {
    expect(
      deriveAutoTags({ text: 'plan #maths #study', subjectName: 'Maths', modeName: 'Study' }),
    ).toEqual(['maths', 'study'])
  })

  it('drops the global scope ("all") mode slug', () => {
    expect(
      deriveAutoTags({ text: 'triage #inbox', subjectName: '', modeName: 'all' }),
    ).toEqual(['inbox'])
    expect(deriveAutoTags({ text: '', modeName: 'All Scopes' })).toEqual([])
  })

  it('tolerates missing fields and an empty call', () => {
    expect(deriveAutoTags()).toEqual([])
    expect(deriveAutoTags({})).toEqual([])
    expect(deriveAutoTags({ subjectName: 'Physics' })).toEqual(['physics'])
    expect(deriveAutoTags({ text: 'no tags here' })).toEqual([])
  })

  it('preserves order: hashtags first, then subject, then mode', () => {
    expect(
      deriveAutoTags({ text: '#b #a', subjectName: 'Zeta', modeName: 'Mode X' }),
    ).toEqual(['b', 'a', 'zeta', 'mode-x'])
  })
})

// ---------------------------------------------------------------------------
// mergeTags
// ---------------------------------------------------------------------------
describe('mergeTags', () => {
  it('appends new tags after existing ones, de-duped', () => {
    expect(mergeTags(['maths', 'study'], ['study', 'calculus'])).toEqual([
      'maths',
      'study',
      'calculus',
    ])
  })

  it('normalizes both sides before comparing', () => {
    expect(mergeTags(['#Maths', 'Deep Work'], ['deep_work', 'NEW'])).toEqual([
      'maths',
      'deep-work',
      'new',
    ])
  })

  it('drops empties produced by normalization', () => {
    expect(mergeTags(['ok', '###', '   '], ['!!!', 'fine'])).toEqual(['ok', 'fine'])
  })

  it('does not mutate either input array', () => {
    const existing = ['maths']
    const derived = ['study']
    const out = mergeTags(existing, derived)
    expect(existing).toEqual(['maths'])
    expect(derived).toEqual(['study'])
    expect(out).not.toBe(existing)
  })

  it('handles missing / non-array arguments', () => {
    expect(mergeTags()).toEqual([])
    expect(mergeTags(['a'])).toEqual(['a'])
    expect(mergeTags(undefined, ['b'])).toEqual(['b'])
    expect(mergeTags(null, null)).toEqual([])
    expect(mergeTags('nope', ['b'])).toEqual(['b'])
  })

  it('round-trips with deriveAutoTags output', () => {
    const derived = deriveAutoTags({ text: 'ship #q1-goals', subjectName: 'Roadmap', modeName: 'Work' })
    expect(mergeTags(['roadmap'], derived)).toEqual(['roadmap', 'q1-goals', 'work'])
  })
})

// ---------------------------------------------------------------------------
// toHashtag
// ---------------------------------------------------------------------------
describe('toHashtag', () => {
  it('prefixes a normalized tag with "#"', () => {
    expect(toHashtag('deep-work')).toBe('#deep-work')
  })

  it('normalizes before prefixing', () => {
    expect(toHashtag('Deep Work')).toBe('#deep-work')
  })

  it('returns "" for an unusable tag', () => {
    expect(toHashtag('')).toBe('')
    expect(toHashtag('###')).toBe('')
    expect(toHashtag(null)).toBe('')
  })
})
