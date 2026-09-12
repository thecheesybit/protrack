# PRO TRACK Architecture & Technical Documentation

## Architecture Overview
PRO TRACK is a hyper-focused, auto-adapting productivity workspace designed to minimize friction and eliminate context switching. Built with **React 18**, **Vite 5**, **Tailwind CSS**, and **Framer Motion**, backed by **Firebase (Firestore & Auth)** with a dual-target architecture (Web Gateway via Netlify and Desktop App via Electron).

---

## 1. Notification Architecture & Multi-Surface Delivery

PRO TRACK separates notifications into two distinct channels based on urgency and user presence:

### A. In-App Notification Surfaces (Always Contained)
1. **Universal Dynamic Island (`pushIsland` in `uiSlice.js`)**:
   - Morphing status capsule anchored at the top of the workspace.
   - Dispatches non-intrusive status updates for focus session milestones, timer ticks, network transitions, hourly chimes, and auto-update downloads.
2. **Center Prompt System (`pushPrompt` in `promptSlice.js`)**:
   - High-contrast interactive overlay for tasks requiring immediate feedback (Daily Check-ins, Habit Reminders).
   - Features built-in grace periods, automatic coalescing, and single-instance snooze logic (`HABIT_SNOOZE_MS`).
3. **Purely In-App Habits**:
   - Routine habit reminders are strictly restricted to the Dynamic Island and Center Prompts with audio feedback.
   - **Zero** habit reminders are dispatched to the desktop OS notification center, preventing repetitive notification spam.

### B. Desktop OS Native Notifications (`notify.js`)
- **Chromium / Electron Web Notifications API**:
  - Pushes high-priority alerts to Windows Action Center and macOS Notification Center even when PRO TRACK is minimized or running in the tray.
  - On Windows, `app.setName('PRO TRACK')` and `app.setAppUserModelId('com.protrack.app')` are registered on startup to ensure all toasts show the official app branding and icon instead of raw package strings.
- **Granular Category Filtering**:
  - `alarms`: High-priority ringing notifications pinned with `requireInteraction: true` and one-click window restore.
  - `focus`: Pomodoro sprint completion and break expiration notices.
  - `deadlines`: Milestone notices for syllabus and note deadlines entering the 48-hour window.
  - `hydration`: Optional desktop water nudges (disabled by default; in-app Dynamic Island is active).
- **Settings & User Control**:
  - First-class **Notifications** tab in Settings with a master ON/OFF switch, category toggles, permission diagnostic banner, and test alert trigger.
  - Fully synchronized across local storage and Firestore user settings.

---

## 2. Gemini AI & Voice Assistant

### A. Conversational Chat Assistant
- Chat interface in `AIAssistant.jsx` powered by `@google/generative-ai`.
- **Function Calling & Write Access (`geminiTools.js` & `agentActions.js`)**:
  - Dispatches tools for adding tasks, updating subject progress, logging syllabus completions, scheduling timetable slots, managing habits, and controlling focus timers.
  - Natural-language slash command shortcuts (`/done`, `/todo`, `/progress`, `/task`).

### B. Hands-Free Voice Agent (`useVoiceAgent.js`)
- Unified finite state machine managing conversational turns: `idle` → `listening` → `thinking` → `acting` → `speaking` → `idle`.
- Speech recognition via Web Speech API with automatic retry and Gemini transcription fallback.
- Context snapshot builder (`voiceContext.js`) providing real-time workspace context to the model without redundant database subscriptions.
- Opt-in background wake word detection ("Hey Track").

---

## 3. Focus Engine & Multi-Track Audio

- **Pomodoro & Focus Timer (`useFocusEngine.js`)**:
  - Single source of truth in `focusSlice.js` (`phaseTotalSec`).
  - Seamless transitions between Focus, Short Break, and Long Break phases.
  - Mini-overlay, PiP floating widget, and full-screen Focus Lock Screen.
- **Calendar Forest (`CalendarForest.jsx`)**:
  - Automatically plants trees, shrubs, and flowers on the interactive calendar upon session completion.
- **Web Audio API Engine (`sound.js` & `audioFX.js`)**:
  - Procedural sound synthesis for chimes, button clicks, alarm ringtones, and temple bell hourly chimes.
  - Curated YouTube ambient streaming with volume normalization.

---

## 4. Timetable, Agenda & Indian Climate Seasons

- **Class Timetable & Natural Language Capture**:
  - Flexible repeat rules, lecture/lab/tutorial/seminar badge categorization, and multi-view grid (Week, Day, Month).
  - Time-of-day chrono-adaptive styling shifting across morning, afternoon, sunset, and night.
- **Indian Climate & Atmospheric Engine (`indianClimate.js`)**:
  - 6 classical Indian Ritus (Vasant, Grishma, Varsha, Sharad, Hemant, Shishir) modulating lighting and ambient atmospheric effects.
  - Wind and particle physics in `WindWeatherOverlay.jsx` scaling dynamically with simulated wind speed.

---

## 5. Security & Multi-Device Sync

- **Client-Side Cryptographic Vault (`cryptoService.js`)**:
  - PBKDF2 key derivation with AES-GCM 256-bit encryption for sensitive notes and exam records.
  - Passcode / PIN lock screen with auto-lock timeout.
- **QR Handshake Device Linking**:
  - Cross-device authentication without entering Google credentials inside the desktop browser.
- **Google Calendar Two-Way Sync**:
  - Serverless Netlify functions (`gcal-sync.js`) for secure OAuth token exchange and incremental timetable synchronization.

---

## 6. Desktop Architecture (Electron)

- **Main Process (`electron/main.js`)**:
  - Internal localhost HTTP static server to maintain clean origin for YouTube embeds and Firebase auth.
  - Picture-in-Picture window morphing (`pip:enter` / `pip:exit`).
  - System-wide hotkeys (Window visibility, focus toggle, mute).
  - Single instance lock with tray minimization.
  - Windows AUMID registration for clean desktop notifications.
- **Preload Bridge (`electron/preload.js`)**:
  - Secure context-isolated IPC bridge (`window.protrack`).
