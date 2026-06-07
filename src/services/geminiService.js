import { GoogleGenerativeAI } from '@google/generative-ai'
import { TOOL_DECLARATIONS, executeTool } from '@/services/geminiTools'

/**
 * Gemini integration. The user's API key lives ONLY in localStorage — it is
 * never written to Firestore or sent anywhere except Google's API.
 */
const KEY = 'protrack:gemini_key'
// `gemini-flash-latest` is a stable alias that always points at the current
// fast Gemini model — survives the periodic deprecation cycles (e.g. the
// gemini-1.5-flash 404 we hit on 2026-06-07).
const MODEL = 'gemini-flash-latest'

export function getGeminiKey() {
  return localStorage.getItem(KEY) || ''
}
export function hasGeminiKey() {
  return Boolean(getGeminiKey())
}
export function setGeminiKey(value) {
  if (value) localStorage.setItem(KEY, value.trim())
  else localStorage.removeItem(KEY)
}

function client() {
  const key = getGeminiKey()
  if (!key) throw new Error('Add your Gemini API key in Settings first')
  return new GoogleGenerativeAI(key)
}

const SYSTEM = `You are PRO TRACK's in-app study companion. Be concise, warm,
and practical. You have write access to the user's workspace via tools — when
the user expresses intent ("I finished Calculus", "remind me to drink water",
"add Physics", "schedule Biology Tuesday 4pm"), CALL THE MATCHING TOOL instead
of just acknowledging. Use the live workspace context to disambiguate names.
After a successful tool call, give a short natural-language confirmation; do
not echo the JSON.`

/**
 * Context-aware chat with function-calling. The executor loop runs until the
 * model produces a plain-text response (no further calls). Capped at 4 hops
 * so a misbehaving model can never spin.
 *
 * @param {Array<{role:'user'|'assistant', text:string}>} history
 * @param {string} contextText
 * @param {object} ctx executor context: { uid, modeId, subjects, habits, todos }
 */
export async function chatWithGemini(history, contextText, ctx = {}) {
  const model = client().getGenerativeModel({
    model: MODEL,
    systemInstruction: `${SYSTEM}\n\nCURRENT WORKSPACE CONTEXT:\n${contextText}`,
    tools: TOOL_DECLARATIONS,
  })
  const chat = model.startChat({
    history: history.slice(0, -1).map((m) => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.text }],
    })),
  })

  const last = history[history.length - 1]
  let result = await chat.sendMessage(last.text)
  const toolEvents = []

  for (let hop = 0; hop < 4; hop++) {
    const calls = result.response.functionCalls?.() || []
    if (!calls.length) break

    const responseParts = []
    for (const call of calls) {
      const outcome = await executeTool(call.name, call.args || {}, ctx)
      toolEvents.push({ name: call.name, ...outcome })
      responseParts.push({
        functionResponse: {
          name: call.name,
          response: outcome,
        },
      })
    }
    result = await chat.sendMessage(responseParts)
  }

  return { text: result.response.text(), toolEvents }
}

/**
 * Transcribe a recorded audio blob via the Gemini multimodal API.
 * Used as the Electron fallback when webkitSpeechRecognition is unavailable.
 */
export async function transcribeAudio(blob) {
  const model = client().getGenerativeModel({ model: MODEL })
  const arrayBuffer = await blob.arrayBuffer()
  const bytes = new Uint8Array(arrayBuffer)
  let binary = ''
  const CHUNK = 32768
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  }
  const base64 = btoa(binary)
  const mimeType = blob.type || 'audio/webm'
  const result = await model.generateContent([
    { text: 'Transcribe this audio recording verbatim. Return only the transcript text, no other commentary.' },
    { inlineData: { mimeType, data: base64 } },
  ])
  return result.response.text().trim()
}

/** Turn a raw voice transcript into a structured note. */
export async function summarizeTranscript(transcript) {
  const model = client().getGenerativeModel({
    model: MODEL,
    generationConfig: { responseMimeType: 'application/json' },
  })
  const prompt = `From this study note transcript, return JSON with keys:
"title" (<= 6 words), "summary" (2-3 sentences), "actionItems" (array of short
strings), "flashcards" (array of {"front","back"} Q&A pairs, max 6).
Transcript:
"""${transcript}"""`
  const res = await model.generateContent(prompt)
  const text = res.response.text()
  try {
    return JSON.parse(text)
  } catch {
    const match = text.match(/\{[\s\S]*\}/)
    if (match) return JSON.parse(match[0])
    throw new Error('Could not parse AI response')
  }
}

/**
 * Fetch a motivational quote using Gemini.
 * When `context` is provided (subjects + todos), the quote is personalized.
 *
 * @param {Array} recentQuotes - recent quotes to avoid repeating
 * @param {{ subjects?: Array, todos?: Array }} context - optional workspace context
 */
export async function fetchZenQuote(recentQuotes = [], context = {}) {
  if (!hasGeminiKey()) return null

  const model = client().getGenerativeModel({
    model: MODEL,
    generationConfig: { responseMimeType: 'application/json' },
  })

  const avoid = recentQuotes.map(q => `"${q.text}"`).join(', ')

  let contextBlock = ''
  if (context.subjects?.length || context.todos?.length) {
    const lagging = (context.subjects || [])
      .filter(s => (s.progressPct || 0) < 60)
      .slice(0, 3)
      .map(s => `${s.name} (${s.progressPct || 0}%)`)
    const pending = (context.todos || [])
      .filter(t => !t.done)
      .slice(0, 3)
      .map(t => t.text)
    if (lagging.length || pending.length) {
      contextBlock = `\nContext about the student's current work:${lagging.length ? `\nSubjects needing focus: ${lagging.join(', ')}` : ''}${pending.length ? `\nPending tasks: ${pending.join(', ')}` : ''}\nPersonalize the quote to resonate with this student's specific challenges.`
    }
  }

  const prompt = `Generate a highly profound, calming, and motivational quote for deep focus and productivity.${contextBlock}
It must NOT be any of these recent quotes: [${avoid}].
Return a JSON object with strictly two keys: "text" (the quote text) and "author" (the person who said it, or "Unknown").
Do not include any other text.`

  try {
    const res = await model.generateContent(prompt)
    const text = res.response.text()
    const match = text.match(/\{[\s\S]*\}/)
    if (match) return JSON.parse(match[0])
    return JSON.parse(text)
  } catch (err) {
    console.warn('[gemini] fetchZenQuote failed:', err)
    return null
  }
}
