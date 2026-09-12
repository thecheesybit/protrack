import { GoogleGenerativeAI } from '@google/generative-ai'
import { TOOL_DECLARATIONS, executeTool } from '@/services/geminiTools'
import { secureStorage } from '@/services/cryptoService'

/**
 * Gemini integration. The user's API key is stored persistently in localStorage
 * and synced with OS keychain / DPAPI via Electron's secureStore on desktop.
 * It is NEVER cleared automatically unless manually removed by the user.
 */
// Current, non-retired models, fastest → most-capable. Concrete ids only — the
// `-latest` aliases can silently point at a heavily-loaded model, and the 1.5
// series is retired (a 404 that just wastes a fallback slot).
export const GEMINI_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.0-flash-lite',
  'gemini-2.5-pro',
]

let activeHealthyGeminiModel = GEMINI_MODELS[0]
const persistentKeyCache = new Map()

// Safe accessor for desktop bridge
const getDesktopStore = () => {
  if (typeof window !== 'undefined' && window.protrack?.secureStore) {
    return window.protrack.secureStore
  }
  return null
}

// Background sync from desktop DPAPI store
async function syncDesktopKeys() {
  const store = getDesktopStore()
  if (!store?.get) return
  try {
    const raw = await store.get()
    if (!raw) return
    try {
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object') {
        Object.entries(parsed).forEach(([provider, val]) => {
          if (val && typeof val === 'string') {
            persistentKeyCache.set(provider, val)
            try {
              localStorage.setItem(`protrack:persistent_${provider}_key`, val)
            } catch {
              /* ignore */
            }
          }
        })
      }
    } catch {
      if (raw.startsWith('AIza')) {
        persistentKeyCache.set('gemini', raw)
        try {
          localStorage.setItem('protrack:persistent_gemini_key', raw)
        } catch {
          /* ignore */
        }
      }
    }
  } catch (err) {
    console.warn('[geminiService] desktop key sync failed', err)
  }
}

// Fire desktop key sync immediately
if (typeof window !== 'undefined') {
  syncDesktopKeys()
}

async function saveKeyToDesktop(provider, value) {
  const store = getDesktopStore()
  if (!store?.set || !store?.get) return
  try {
    let current = {}
    try {
      const raw = await store.get()
      if (raw) current = JSON.parse(raw)
    } catch {
      /* ignore */
    }
    if (value) {
      current[provider] = value
    } else {
      delete current[provider]
    }
    await store.set(JSON.stringify(current))
  } catch (err) {
    console.warn('[geminiService] desktop key save failed', err)
  }
}

export function getApiKey(provider) {
  // 1. In-memory persistent cache
  if (persistentKeyCache.has(provider)) {
    const cached = persistentKeyCache.get(provider)
    if (cached) return cached
  }
  // 2. Dedicated persistent localStorage (never cleared by PIN/session locks)
  if (typeof localStorage !== 'undefined') {
    const persistent = localStorage.getItem(`protrack:persistent_${provider}_key`)
    if (persistent) {
      persistentKeyCache.set(provider, persistent)
      return persistent
    }
  }
  // 3. Environment variable fallback (for Gemini)
  if (provider === 'gemini' && import.meta.env?.VITE_GEMINI_API_KEY) {
    const envKey = import.meta.env.VITE_GEMINI_API_KEY
    if (envKey) {
      persistentKeyCache.set(provider, envKey)
      return envKey
    }
  }
  // 4. Fallback to legacy secureStorage
  const legacy = secureStorage.getItemSync(`protrack:${provider}_key`)
  if (legacy) {
    persistentKeyCache.set(provider, legacy)
    return legacy
  }
  return ''
}

export function hasApiKey(provider) {
  return Boolean(getApiKey(provider))
}

export function setApiKey(provider, value) {
  const clean = value ? String(value).trim() : ''
  if (clean) {
    persistentKeyCache.set(provider, clean)
    try {
      localStorage.setItem(`protrack:persistent_${provider}_key`, clean)
    } catch {
      /* ignore */
    }
    saveKeyToDesktop(provider, clean)
    secureStorage.setItem(`protrack:${provider}_key`, clean)
  } else {
    persistentKeyCache.delete(provider)
    try {
      localStorage.removeItem(`protrack:persistent_${provider}_key`)
    } catch {
      /* ignore */
    }
    saveKeyToDesktop(provider, '')
    secureStorage.removeItem(`protrack:${provider}_key`)
  }
}

export function isRetryableGeminiError(err) {
  if (!err) return false
  const msg = String(err?.message || err).toLowerCase()
  const status = err?.status || err?.statusCode
  if (status === 503 || status === 429 || status === 404 || status === 500 || status === 502) return true
  return (
    msg.includes('503') ||
    msg.includes('high demand') ||
    msg.includes('overloaded') ||
    msg.includes('resource has been exhausted') ||
    msg.includes('rate limit') ||
    msg.includes('quota') ||
    msg.includes('429') ||
    msg.includes('404') ||
    msg.includes('not found') ||
    msg.includes('unavailable') ||
    msg.includes('service unavailable')
  )
}

const _sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/**
 * Run a Gemini call with resilience against "model is overloaded / high demand":
 *  1. try the last-known-good model, retrying it up to 2× with backoff
 *     (a 503 on flash usually clears within a second or two);
 *  2. if it's still failing, walk the model cascade (fast → capable), each with
 *     one backoff retry;
 *  3. remember whichever model succeeded so the next call starts there.
 * Only genuinely fatal errors (bad key, safety block, malformed request) throw
 * immediately without burning the whole cascade.
 */
export async function executeGeminiWithModelFallback(apiKey, taskFn) {
  const key = apiKey || getGeminiKey()
  if (!key) throw new Error('Add your Gemini API key in Settings first')
  const ai = new GoogleGenerativeAI(key)

  const modelsToTry = [
    activeHealthyGeminiModel,
    ...GEMINI_MODELS.filter((m) => m !== activeHealthyGeminiModel),
  ]

  let lastError = null
  for (let i = 0; i < modelsToTry.length; i++) {
    const modelName = modelsToTry[i]
    const attempts = i === 0 ? 2 : 1 // one extra try on the preferred model
    for (let a = 0; a < attempts; a++) {
      try {
        const res = await taskFn(ai, modelName)
        activeHealthyGeminiModel = modelName
        return res
      } catch (err) {
        lastError = err
        if (!isRetryableGeminiError(err)) throw err // fatal — don't churn the cascade
        const moreForThisModel = a < attempts - 1
        const moreModels = i < modelsToTry.length - 1
        if (!moreForThisModel && !moreModels) throw err
        const delay = moreForThisModel ? 600 : 250
        console.warn(
          `[geminiService] '${modelName}' busy (${String(err?.message || err).slice(0, 80)}). ` +
            (moreForThisModel ? `retrying in ${delay}ms` : `falling back to '${modelsToTry[i + 1]}'`),
        )
        await _sleep(delay)
        if (!moreForThisModel) break // move to the next model
      }
    }
  }
  throw lastError
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

const SYSTEM = `You are Track, PRO TRACK's conversational hands-free companion and intelligent study coach.
You work like Alexa or Jarvis: operating the entire app for the user by voice, conversing naturally, and proactively helping them stay focused and on top of their day.

VOICE-FIRST SPOKEN OUTPUT RULES:
• You are heard aloud through text-to-speech. Speak in natural, warm, lively spoken English.
• STRICTLY NO MARKDOWN: Never use asterisks (**bold**), bullet points (* or -), headers (#), backticks, brackets, emojis, or raw JSON in your replies. Everything you write is spoken directly by a voice synthesizer.
• Pronounce times, durations, and numbers conversationally: say "seven thirty AM", "two in the afternoon", "half an hour", "forty-five minutes", "three tasks".
• Keep replies concise and punchy: usually 1 to 3 spoken sentences per turn. Never drone on. When reading lists, mention the top two or three highlights and summarize the rest.

BE CONVERSATIONAL & INTERACTIVE (TALK & ACT LIKE ALEXA):
• ACT, DON'T JUST TALK: Whenever the user expresses intent to do something, immediately call the matching tool to execute it, then confirm out loud.
• PROACTIVE NEXT STEPS: After answering a question or taking an action, suggest a context-relevant next step or ask a friendly follow-up question to keep momentum:
  - After reading today's schedule or overdue items: offer to start a focus timer on their next class or most urgent task.
  - After adding a task: ask if they want to set a deadline or schedule study time.
  - After completing or starting a focus session: give encouraging, mindful motivation.
• MULTI-TURN MEMORY: You remember previous turns. Understand pronouns and context ("start it now", "make it tomorrow", "change that to 30 minutes").
• AMBIGUITY: If a request is unclear (e.g. multiple matching subjects or missing times), ask ONE short, direct clarifying question instead of guessing.

VERBAL CONFIRMATION FOR DELETIONS:
• The delete tools (delete_todo, delete_task, delete_subject, delete_habit) are permanent.
• NEVER call delete tools on the initial request. First explain plainly what will be deleted and ask for verbal confirmation (e.g. "Deleting Physics will remove the subject and its four tasks. Are you sure you want me to delete it?").
• When the user replies "yes", "sure", "go ahead", "do it" in a follow-up turn, call the delete tool and confirm warmly.
• If the user says "no", "cancel", or "nevermind", acknowledge that it was kept intact.

HANDS-FREE EXIT / SLEEP:
• When the user says "goodbye", "that's all", "thank you", "thanks Track", "stop listening", "go to sleep", or indicates they are done:
  CALL dismiss_assistant with a warm, brief closing (e.g. "You're welcome! Say Hey Track whenever you need me.").

FULL TOOL SURFACE (CALL THESE FREELY):
• Todos: add_todo, mark_todo_done, set_todo_due, delete_todo
• Subjects: add_subject, set_subject_progress, delete_subject
• Tasks: add_task, add_tasks_bulk, complete_task, delete_task
• Timetable: add_timetable_slot
• Habits: add_habit, toggle_habit_today, delete_habit
• Notes: add_note
• Focus Timer: start_focus ("start a 25 minute focus on Physics"), control_focus (pause / resume / stop)
• Alarms: set_alarm ("set an alarm for 7:30 am"), cancel_alarm (cancels scheduled alarms or silences an active ringing alarm)
• Navigation & Modes: open_view ("open my timetable", "show analytics"), switch_mode ("switch to Exam Prep"), create_mode
• Queries: get_status (topics: agenda_today, agenda_tomorrow, todos_open, todos_overdue, subjects, habits, focus, alarms, stats)
• Sleep: dismiss_assistant`

/**
 * Context-aware chat with function-calling and optional real-time streaming response.
 * The executor loop runs until the model produces a plain-text response (no further calls).
 * Capped at 4 hops so a misbehaving model can never spin.
 *
 * @param {Array<{role:'user'|'assistant', text:string}>} history
 * @param {string} contextText
 * @param {object} ctx executor context: { uid, modeId, subjects, habits, todos }
 * @param {((accumulatedText: string, chunkText: string) => void)|null} onChunk optional streaming callback
 * @param {((toolEvent: object) => void)|null} onToolEvent optional callback when a tool finishes executing
 */
export async function chatWithGemini(history, contextText, ctx = {}, onChunk = null, onToolEvent = null) {
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
        const apiKey = getGeminiKey()
        if (!apiKey) throw new Error('Gemini key missing')

        return await executeGeminiWithModelFallback(apiKey, async (ai, modelName) => {
          const model = ai.getGenerativeModel({
            model: modelName,
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
          const toolEvents = []

          if (typeof onChunk === 'function') {
            // Streaming mode
            onChunk('', '')
            let accumulatedText = ''
            const streamResult = await chat.sendMessageStream(last.text)

            for await (const chunk of streamResult.stream) {
              try {
                const chunkText = chunk.text()
                if (chunkText) {
                  accumulatedText += chunkText
                  onChunk(accumulatedText, chunkText)
                }
              } catch {
                // If chunk only contains functionCall parts, chunk.text() throws; ignore safely
              }
            }

            const response = await streamResult.response
            const calls = response.functionCalls?.() || []

            if (calls.length > 0) {
              // Reset text buffer since function calls will produce intermediate tool state
              accumulatedText = ''
              onChunk('', '')

              let currentResponse = response
              for (let hop = 0; hop < 4; hop++) {
                const hopCalls = currentResponse.functionCalls?.() || []
                if (!hopCalls.length) break

                const responseParts = []
                for (const call of hopCalls) {
                  const outcome = await executeTool(call.name, call.args || {}, ctx)
                  const ev = { name: call.name, ...outcome }
                  toolEvents.push(ev)
                  onToolEvent?.(ev)
                  responseParts.push({
                    functionResponse: {
                      name: call.name,
                      response: outcome,
                    },
                  })
                }

                const streamHop = await chat.sendMessageStream(responseParts)
                for await (const chunk of streamHop.stream) {
                  try {
                    const chunkText = chunk.text()
                    if (chunkText) {
                      accumulatedText += chunkText
                      onChunk(accumulatedText, chunkText)
                    }
                  } catch {
                    // ignore
                  }
                }
                currentResponse = await streamHop.response
              }

              return {
                text: accumulatedText || (typeof currentResponse.text === 'function' ? currentResponse.text() : ''),
                toolEvents,
              }
            }

            return {
              text: accumulatedText || (typeof response.text === 'function' ? response.text() : ''),
              toolEvents,
            }
          } else {
            // Non-streaming fallback mode
            let result = await chat.sendMessage(last.text)

            for (let hop = 0; hop < 4; hop++) {
              const calls = result.response.functionCalls?.() || []
              if (!calls.length) break

              const responseParts = []
              for (const call of calls) {
                const outcome = await executeTool(call.name, call.args || {}, ctx)
                const ev = { name: call.name, ...outcome }
                toolEvents.push(ev)
                onToolEvent?.(ev)
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
        })
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

        if (typeof onChunk === 'function') {
          onChunk(textResponse, textResponse)
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
 * Convenience wrapper for real-time streaming chat.
 */
export async function chatWithGeminiStream(history, contextText, ctx = {}, onChunk = null, onToolEvent = null) {
  return chatWithGemini(history, contextText, ctx, onChunk, onToolEvent)
}

/**
 * Transcribe a recorded audio blob via the Gemini multimodal API.
 * Used as the Electron fallback when webkitSpeechRecognition is unavailable.
 */
export async function transcribeAudio(blob) {
  const apiKey = getGeminiKey()
  if (!apiKey) throw new Error('Add your Gemini API key in Settings first')
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

  return await executeGeminiWithModelFallback(apiKey, async (ai, modelName) => {
    const model = ai.getGenerativeModel({ model: modelName })
    const result = await model.generateContent([
      { text: 'Transcribe this audio recording verbatim. Return only the transcript text, no other commentary.' },
      { inlineData: { mimeType, data: base64 } },
    ])
    return result.response.text().trim()
  })
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
        const apiKey = getGeminiKey()
        if (!apiKey) throw new Error('Gemini key missing')
        const text = await executeGeminiWithModelFallback(apiKey, async (ai, modelName) => {
          const model = ai.getGenerativeModel({ model: modelName, systemInstruction })
          const res = await model.generateContent(prompt)
          return res.response.text()
        })
        return { text, provider: 'gemini' }
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
