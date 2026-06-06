# PRO TRACK v1.2.0 - Complete Documentation

## Architecture Overview
PRO TRACK is a hyper-focused, auto-adapting productivity workspace designed to minimize friction and prevent context switching. Built primarily with React, Vite, Tailwind CSS, and Framer Motion.

## 1. Focus Engine & Multi-Track Audio
The `FocusWidget` and `focusSlice` have been overhauled to support deep, uninterrupted work sessions:
- **Focus Lock Screen:** Triggers a `backdrop-blur-3xl` full-screen overlay during focus phases, obfuscating the UI and leaving only the hero-variant Focus Widget and the FlipClock accessible.
- **Web Audio API Mixer:** Uses a dynamic audio graph (`AudioContext`) to mix dual-track ambient sounds (e.g., Rain + White Noise), while also synthesizing UI event tones natively (`lock-initiated`, `todo-added`, `task-complete`).
- **YouTube Audio Stream:** Added an input field for custom YouTube background streams via the iframe API, circumventing CORS and storage limits.

## 2. Gemini AI & Resilient Voice Recognition
Integrated the Web Speech API tightly with the Gemini SDK to form the `AIAssistant` interface:
- **Speech Lock Mechanism:** Implemented an aggressive debounce lock in `useSpeechRecognition.js`. The `onend` handler checks the `shouldBeListening` reference and instantly forces a restart, preventing Chromium from prematurely killing the mic stream.
- **Action NLP Matrix:** The AI parses text into actionable intents, manipulating the Zustand store to instantly add tasks, complete items, and set calendar appointments without manual UI interaction.

## 3. Serverless Integration & Calendar Sync
To keep the primary architecture client-side and free-tier compliant, all external integrations are piped through Netlify Edge.
- **`gcal-sync` Function:** Located at `netlify/functions/gcal-sync.js`, this serverless endpoint securely processes Google OAuth token exchanges (`exchange_code`), and handles `sync_up` and `sync_down` actions to merge local Chrome IndexedDB scheduling with the user's remote Google Calendar.

## 4. Edge-Hosted Motivational Quotes
- Migrated away from real-time API text generation for the `ZenOverlay` component.
- The `ZenOverlay` now reads from `public/zen_quotes.json`, served directly from Netlify's Edge CDN. This guarantees zero-latency rendering of motivational text during the 3-minute idle timeout.

## 5. Offline Capabilities (Service Worker)
- PRO TRACK now ships with an active Service Worker (`sw.js`).
- **Caching Strategy:** Implements a `stale-while-revalidate` network pattern, ensuring that the app shell, core CSS/JS chunks, and edge-hosted JSON assets are available instantly offline, allowing seamless focus sessions even on spotty connections.

## 6. Structural Components
- **FlipClock:** Extracted into a universal floating component that can be dragged and scroll-wheel-resized. Persists size and position to `localStorage`.
- **ModeSwitcher:** Re-architected to remove local drag-and-drop structural updates, shifting that responsibility exclusively to the Settings Modal. Now includes a permanently pinned "All Scopes" aggregate view.
- **WidgetFrame Bounds:** Hardcoded `min-h` bounds on widget containers to eliminate layout shifting during component mount cycles.
