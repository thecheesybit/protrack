/**
 * tags.js — unified tag layer  (Phase P7)
 * =======================================
 * One taxonomy for todos, tasks, notes, timetable slots and subjects. Pure and
 * dependency-free; the tag index is derived client-side, so nothing here reads
 * or writes Firestore. Persisted tags mirror the dormant `notes.tags[]` shape:
 * a plain `string[]` of normalized slugs. Tags are *additive* — a consumer only
 * ever *adds* a `tags[]` where one is missing, never rewrites an existing doc.
 *
 * ── tag convention ─────────────────────────────────────────────────────────
 *   • A tag is a lowercase slug of Unicode letters/digits joined by single "-".
 *   • Leading "#" is stripped; whitespace, "_" and punctuation collapse to "-".
 *   • Repeated / leading / trailing "-" are trimmed. Empty result → dropped.
 *   • Comparison is exact string equality on the normalized form, so
 *     "#Deep Work", "deep_work" and "deep--work" all collapse to "deep-work".
 *
 * ── API ────────────────────────────────────────────────────────────────────
 *   normalizeTag(s)                          -> string        ('' when nothing usable)
 *   parseHashtags(text)                      -> string[]      (#tags in text, de-duped, in order)
 *   deriveAutoTags({ text, subjectName, modeName }) -> string[]
 *        auto-tags for a new item: parsed #hashtags + subject-name slug +
 *        mode-name slug (the global 'all' scope contributes nothing).
 *   mergeTags(existing, derived)             -> string[]      (normalized, de-duped, existing first)
 *   toHashtag(tag)                           -> string        display helper: 'deep-work' -> '#deep-work'
 *
 * All functions return fresh arrays/strings and never mutate their arguments.
 */

// A normalized tag: 1+ groups of letters/digits separated by single hyphens.
export const TAG_RE = /^[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*$/u

// Mode scope that means "everything" — never a useful auto-tag.
const GLOBAL_SCOPE_TAGS = new Set(['all', 'all-scopes', 'global'])

/**
 * Collapse an arbitrary string into the canonical tag slug.
 * @param {unknown} s
 * @returns {string} normalized slug, or '' when nothing usable remains
 */
export function normalizeTag(s) {
  if (typeof s !== 'string') return ''
  return s
    .trim()
    .replace(/^#+/, '') // drop leading hash(es)
    .toLocaleLowerCase()
    .normalize('NFKC')
    // anything that isn't a Unicode letter or digit becomes a separator
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/-{2,}/g, '-') // collapse runs
    .replace(/^-+|-+$/g, '') // trim edges
}

/** True when `s` is already a well-formed normalized tag. */
export function isValidTag(s) {
  return typeof s === 'string' && TAG_RE.test(s)
}

/**
 * Extract `#hashtags` from free text. Only matches a "#" at the start of the
 * string or after whitespace / "(" so URL fragments (`example.com#frag`) and
 * markdown headings mid-word are ignored. Returns normalized, de-duped slugs in
 * first-seen order.
 * @param {unknown} text
 * @returns {string[]}
 */
export function parseHashtags(text) {
  if (typeof text !== 'string' || !text) return []
  const re = /(?:^|[\s(])#([\p{L}\p{N}][\p{L}\p{N}_-]*)/gu
  const out = []
  const seen = new Set()
  let m
  while ((m = re.exec(text)) !== null) {
    const tag = normalizeTag(m[1])
    if (tag && !seen.has(tag)) {
      seen.add(tag)
      out.push(tag)
    }
  }
  return out
}

/**
 * De-dupe a list of already-normalized tags, preserving order and dropping
 * empties. Internal helper — `mergeTags` is the public entry point.
 * @param {Iterable<string>} tags
 * @returns {string[]}
 */
function dedupe(tags) {
  const out = []
  const seen = new Set()
  for (const t of tags) {
    if (t && !seen.has(t)) {
      seen.add(t)
      out.push(t)
    }
  }
  return out
}

/**
 * Auto-tags for a freshly-created item. Combines any `#hashtags` typed into the
 * item text with slugs for its subject and mode, so a todo like
 * "revise #calculus @Maths" created in the "Study" mode yields
 * ['calculus', 'maths', 'study'].
 * @param {{text?:string, subjectName?:string, modeName?:string}} [input]
 * @returns {string[]}
 */
export function deriveAutoTags({ text, subjectName, modeName } = {}) {
  const parsed = parseHashtags(text)
  const subjectTag = normalizeTag(subjectName)
  const modeTag = normalizeTag(modeName)
  const extra = []
  if (subjectTag) extra.push(subjectTag)
  if (modeTag && !GLOBAL_SCOPE_TAGS.has(modeTag)) extra.push(modeTag)
  return dedupe([...parsed, ...extra])
}

/**
 * Merge existing tags with newly derived ones. Both sides are normalized first,
 * so callers may pass raw user input on either side. Existing tags keep their
 * position; new tags are appended. Returns a fresh array; inputs are untouched.
 * @param {string[]} [existing]
 * @param {string[]} [derived]
 * @returns {string[]}
 */
export function mergeTags(existing = [], derived = []) {
  const a = Array.isArray(existing) ? existing.map(normalizeTag) : []
  const b = Array.isArray(derived) ? derived.map(normalizeTag) : []
  return dedupe([...a, ...b])
}

/** Display helper: 'deep-work' -> '#deep-work'. Returns '' for an unusable tag. */
export function toHashtag(tag) {
  const t = normalizeTag(tag)
  return t ? `#${t}` : ''
}
