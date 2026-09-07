import { GoogleGenerativeAI } from '@google/generative-ai'
import { TOOL_DECLARATIONS, executeTool } from '@/services/geminiTools'
import { secureStorage } from '@/services/cryptoService'

/**
 * Gemini integration. The user's API key lives ONLY in localStorage — encrypted
 * at rest with the account's inherent encryption key.
 */
// `gemini-flash-latest` is a stable alias that always points at the current
// fast Gemini model — survives the periodic deprecation cycles (e.g. the
// gemini-1.5-flash 404 we hit on 2026-06-07).
const MODEL = 'gemini-flash-latest'

export function getApiKey(provider) {
  return secureStorage.getItemSync(`protrack:${provider}_key`) || ''
}
export function hasApiKey(provider) {
  return Boolean(getApiKey(provider))
}
export function setApiKey(provider, value) {
  if (value) secureStorage.setItem(`protrack:${provider}_key`, value.trim())
  else secureStorage.removeItem(`protrack:${provider}_key`)
}

export function getGeminiKey() {
  return getApiKey('gemini')
}
export function hasGeminiKey() {
  return hasApiKey('gemini')
}
export function setGeminiKey(value) {
  setApiKey('gemini', value)
}

export function getElevenLabsKey() {
  return getApiKey('elevenlabs')
}
export function hasElevenLabsKey() {
  return hasApiKey('elevenlabs')
}
export function setElevenLabsKey(value) {
  setApiKey('elevenlabs', value)
}

export function getOpenAIKey() {
  return getApiKey('openai')
}
export function hasOpenAIKey() {
  return hasApiKey('openai')
}
export function setOpenAIKey(value) {
  setApiKey('openai', value)
}

export function getAnthropicKey() {
  return getApiKey('anthropic')
}
export function hasAnthropicKey() {
  return hasApiKey('anthropic')
}
export function setAnthropicKey(value) {
  setApiKey('anthropic', value)
}

export function getDeepSeekKey() {
  return getApiKey('deepseek')
}
export function hasDeepSeekKey() {
  return hasApiKey('deepseek')
}
export function setDeepSeekKey(value) {
  setApiKey('deepseek', value)
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
  const preferred = localStorage.getItem('protrack:ai_preferred_provider') || 'auto'
  
  // Determine primary provider to try
  let order = []
  if (preferred && preferred !== 'auto') {
    order.push(preferred)
  }
  const allProviders = ['gemini', 'openai', 'anthropic', 'deepseek']
  allProviders.forEach((p) => {
    if (!order.includes(p) && hasApiKey(p)) {
      order.push(p)
    }
  })
  if (order.length === 0) {
    order.push('gemini')
  }

  let lastError = null
  for (const p of order) {
    try {
      if (p === 'gemini') {
        if (!hasGeminiKey()) throw new Error('Gemini key missing')
        
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
      } else {
        // Fallback for OpenAI, Anthropic, DeepSeek (text-only response)
        const last = history[history.length - 1]
        const systemInst = `${SYSTEM}\n\nCURRENT WORKSPACE CONTEXT:\n${contextText}`
        let textResponse = ''
        
        if (p === 'openai') {
          textResponse = await callOpenAI(last.text, systemInst)
        } else if (p === 'anthropic') {
          textResponse = await callAnthropic(last.text, systemInst)
        } else if (p === 'deepseek') {
          textResponse = await callDeepSeek(last.text, systemInst)
        }
        
        return { text: textResponse, toolEvents: [] }
      }
    } catch (err) {
      console.warn(`[chat-fallback] Chat provider ${p} failed, trying next...`, err)
      lastError = err
    }
  }

  throw lastError || new Error('No working AI provider configured')
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
  let mimeType = blob.type || 'audio/webm'
  if (mimeType.includes(';')) {
    mimeType = mimeType.split(';')[0]
  }
  const result = await model.generateContent([
    { text: 'Transcribe this audio recording verbatim. Return only the transcript text, no other commentary.' },
    { inlineData: { mimeType, data: base64 } },
  ])
  return result.response.text().trim()
}

/** Turn a raw voice transcript into a structured note. */
export async function summarizeTranscript(transcript) {
  const preferred = localStorage.getItem('protrack:ai_preferred_provider') || 'auto'
  const systemInstruction = `From this study note transcript, return JSON with keys:
"title" (<= 6 words), "summary" (2-3 sentences), "actionItems" (array of short
strings), "flashcards" (array of {"front","back"} Q&A pairs, max 6).`
  const prompt = `Transcript:\n"""${transcript}"""`
  
  try {
    const res = await callAIProvider(prompt, systemInstruction, preferred)
    const text = res.text
    const match = text.match(/\{[\s\S]*\}/)
    if (match) return JSON.parse(match[0])
    return JSON.parse(text)
  } catch (err) {
    console.error('[summarize-fallback] failed:', err)
    throw err
  }
}

/**
 * Fetch a motivational quote using the active AI Provider.
 * When `context` is provided (subjects + todos), the quote is personalized.
 */
export async function fetchZenQuote(recentQuotes = [], context = {}) {
  const preferred = localStorage.getItem('protrack:ai_preferred_provider') || 'auto'
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

  const systemInstruction = `Generate a highly profound, calming, and motivational quote for deep focus and productivity.${contextBlock}
Return a JSON object with strictly two keys: "text" (the quote text) and "author" (the person who said it, or "Unknown").
Do not include any other text.`

  const prompt = `Generate a quote. It must NOT be any of these recent quotes: [${avoid}].`

  try {
    const res = await callAIProvider(prompt, systemInstruction, preferred)
    const text = res.text
    const match = text.match(/\{[\s\S]*\}/)
    if (match) return JSON.parse(match[0])
    return JSON.parse(text)
  } catch (err) {
    console.warn('[zen-quote-fallback] failed:', err)
    return null
  }
}

/**
 * One personalized morning check-in question. Called at most once per day
 * (the hook caches the result in localStorage) and only when an AI key is
 * configured — on any failure the caller falls back to the rule-based bank,
 * so the feature never depends on the network or a key.
 *
 * @param {{ streak?: number, yesterday?: ?number, pendingTodos?: number }} context
 * @returns {Promise<?string>} Question text, or null to use the local bank.
 */
export async function fetchCheckinQuestion(context = {}) {
  const preferred = localStorage.getItem('protrack:ai_preferred_provider') || 'auto'
  const systemInstruction = `You write ONE short morning check-in question for a productivity app.
It asks the user what they intend to do today, in a warm, specific, non-generic voice.
Max 90 characters. No emojis. No preamble.
Return a JSON object with strictly one key: "text". Do not include any other text.`
  const parts = [
    `Current streak: ${context.streak ?? 0} days.`,
    context.yesterday != null
      ? `Yesterday the user rated their day ${context.yesterday}/5.`
      : 'No rating from yesterday.',
    context.pendingTodos != null ? `${context.pendingTodos} to-dos pending.` : '',
  ]
  try {
    const res = await callAIProvider(parts.filter(Boolean).join(' '), systemInstruction, preferred)
    const match = res.text.match(/\{[\s\S]*\}/)
    const parsed = match ? JSON.parse(match[0]) : JSON.parse(res.text)
    const text = typeof parsed?.text === 'string' ? parsed.text.trim() : ''
    return text && text.length <= 120 ? text : null
  } catch (err) {
    console.warn('[checkin-question] AI personalization failed:', err)
    return null
  }
}

async function callOpenAI(prompt, systemInstruction) {
  const apiKey = getOpenAIKey()
  if (!apiKey) throw new Error('OpenAI key missing')
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemInstruction },
        { role: 'user', content: prompt }
      ]
    })
  })
  if (!response.ok) throw new Error(`OpenAI API error: ${response.status}`)
  const data = await response.json()
  return data.choices[0].message.content
}

async function callAnthropic(prompt, systemInstruction) {
  const apiKey = getAnthropicKey()
  if (!apiKey) throw new Error('Anthropic key missing')
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'dangerouslyAllowBrowser': 'true'
    },
    body: JSON.stringify({
      model: 'claude-3-haiku-20240307',
      max_tokens: 1024,
      system: systemInstruction,
      messages: [
        { role: 'user', content: prompt }
      ]
    })
  })
  if (!response.ok) throw new Error(`Anthropic API error: ${response.status}`)
  const data = await response.json()
  return data.content[0].text
}

async function callDeepSeek(prompt, systemInstruction) {
  const apiKey = getDeepSeekKey()
  if (!apiKey) throw new Error('DeepSeek key missing')
  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: systemInstruction },
        { role: 'user', content: prompt }
      ]
    })
  })
  if (!response.ok) throw new Error(`DeepSeek API error: ${response.status}`)
  const data = await response.json()
  return data.choices[0].message.content
}

export async function callAIProvider(prompt, systemInstruction, provider = 'auto') {
  const allProviders = ['gemini', 'openai', 'anthropic', 'deepseek']
  
  let order = []
  if (provider && provider !== 'auto' && provider !== 'automatic') {
    order.push(provider)
  }
  
  // Append other configured providers
  allProviders.forEach((p) => {
    if (!order.includes(p) && hasApiKey(p)) {
      order.push(p)
    }
  })
  
  if (order.length === 0) {
    order.push('gemini')
  }

  let lastError = null
  for (const p of order) {
    try {
      if (p === 'gemini') {
        if (!hasGeminiKey()) throw new Error('Gemini key missing')
        const model = client().getGenerativeModel({ model: MODEL, systemInstruction })
        const res = await model.generateContent(prompt)
        return { text: res.response.text(), provider: 'gemini' }
      } else if (p === 'openai') {
        if (!hasOpenAIKey()) throw new Error('OpenAI key missing')
        const text = await callOpenAI(prompt, systemInstruction)
        return { text, provider: 'openai' }
      } else if (p === 'anthropic') {
        if (!hasAnthropicKey()) throw new Error('Anthropic key missing')
        const text = await callAnthropic(prompt, systemInstruction)
        return { text, provider: 'anthropic' }
      } else if (p === 'deepseek') {
        if (!hasDeepSeekKey()) throw new Error('DeepSeek key missing')
        const text = await callDeepSeek(prompt, systemInstruction)
        return { text, provider: 'deepseek' }
      }
    } catch (err) {
      console.warn(`[ai-fallback] Provider ${p} failed, trying next...`, err)
      lastError = err
    }
  }
  
  throw lastError || new Error('No working AI provider configured')
}
