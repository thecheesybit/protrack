import { GoogleGenerativeAI } from '@google/generative-ai'

/**
 * Gemini integration. The user's API key lives ONLY in localStorage — it is
 * never written to Firestore or sent anywhere except Google's API.
 */
const KEY = 'protrack:gemini_key'
const MODEL = 'gemini-1.5-flash'

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

const SYSTEM = `You are PRO TRACK's in-app study companion. Be concise, warm, and
practical. Give actionable, well-structured answers. Use the user's live
workspace context when relevant.`

/** Context-aware chat. `history` is [{role:'user'|'assistant', text}]. */
export async function chatWithGemini(history, contextText) {
  const model = client().getGenerativeModel({
    model: MODEL,
    systemInstruction: `${SYSTEM}\n\nCURRENT WORKSPACE CONTEXT:\n${contextText}`,
  })
  const chat = model.startChat({
    history: history.slice(0, -1).map((m) => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.text }],
    })),
  })
  const last = history[history.length - 1]
  const res = await chat.sendMessage(last.text)
  return res.response.text()
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
    // Fallback if the model wrapped JSON in prose/code fences.
    const match = text.match(/\{[\s\S]*\}/)
    if (match) return JSON.parse(match[0])
    throw new Error('Could not parse AI response')
  }
}
