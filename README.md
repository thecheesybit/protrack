<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&color=0:09090e,50:1a1a2e,100:0f3460&height=200&section=header&text=PRO%20TRACK&fontSize=72&fontColor=ffffff&fontAlignY=38&desc=Hyper-minimalist%20%E2%80%A2%20Gamified%20%E2%80%A2%20All-in-one%20Productivity%20Ecosystem&descAlignY=62&descSize=16&animation=fadeIn" width="100%"/>

<br/>

[![Live App](https://img.shields.io/badge/🌐_Live_App-pro--track--app.netlify.app-09090e?style=for-the-badge&logoColor=white)](https://pro-track-app.netlify.app)
[![Releases](https://img.shields.io/github/v/release/thecheesybit/protrack?style=for-the-badge&color=0f3460&label=Latest%20Release)](https://github.com/thecheesybit/protrack/releases)
[![License](https://img.shields.io/badge/License-Personal%20Non--Commercial-e94560?style=for-the-badge)](./LICENSE)
[![Made with React](https://img.shields.io/badge/React-18-61dafb?style=for-the-badge&logo=react&logoColor=black)](https://react.dev)
[![Powered by Firebase](https://img.shields.io/badge/Firebase-Spark-ffca28?style=for-the-badge&logo=firebase&logoColor=black)](https://firebase.google.com)

<br/>

> **A secure React web gateway + native Electron desktop app, backed by a single Firebase Spark free-tier project.**
> Sign in from phone to desktop via a JioHotstar-style QR handshake — Google OAuth never runs inside the desktop's embedded browser.

<br/>

**Crafted by [AYUSH KUMAR](https://github.com/thecheesybit)**

</div>

---

## ✨ Feature Highlights

<table>
<tr>
<td width="50%" valign="top">

### 🌲 Calendar Forest & Focus Tree
Turn focus sessions into a lush digital forest. Every completed Pomodoro session plants a vibrant tree on your calendar. Inspect session streaks, celebrate milestones with the Session Complete modal, and track your visual productivity density across days and months.

### 🪟 Picture-in-Picture (PiP) Floating Focus
Multitask without losing track of deep work. Launch a compact, always-on-top floating timer window (native Electron window or draggable web overlay) with live countdowns, play/pause toggles, and instant return to your workspace.

### 🔐 App Lock & Cryptographic Vault
Safeguard your study plans, private notes, and workspace data. Lock with a custom PIN or password backed by client-side PBKDF2 key derivation and AES-GCM 256-bit encryption. Configurable inactivity auto-lock (1m to 1h).

### 📝 Notes & Voice Quick Capture
The dedicated 8th core workspace widget: capture rich categorized notes with color coding, pinning, tag filtering, markdown formatting, and hands-free voice transcription powered by Web Speech recognition.

### 🗂️ Workspace Modes & Safe Reallocation
Partition everything — subjects, timetable, tasks, analytics — by execution scope: **UPSC, M.Tech, GATE**, and more. Right-click context menus for instant editing, and a safe deletion flow that reallocates subjects and tasks before removal.

### 🏝️ Universal Dynamic Island
One floating, morphing notifier for Pomodoro alerts, hydration nudges, sync state, and live progress — inspired by Apple's Dynamic Island.

### 🌗 Chrono-Adaptive Aesthetics
Surfaces and ambient light shift by time of day (crisp midday → deep obsidian at night). Added an **"Auto" theme** that natively cross-fades light/dark modes based on local time.

</td>
<td width="50%" valign="top">

### 🎯 Deep Focus
Pomodoro with ambient soundscapes, curated video presets (Forest River, Lo-fi Jazz, mantras), YouTube embeds, exit prevention warnings, and an always-on miniature timer that follows you across every module.

### 🔔 Interactive Habit Reminders
Habits with `every-1h`, `every-2h`, `every-4h`, `morning`, or `evening` intervals trigger interactive in-app toasts with 10-minute snooze and one-tap completion, synchronized with persistent native OS notifications.

### 📅 Timetable, Class Schedule & Agenda
Build your week from a **subject**: lecture / lab / tutorial times with a repeat, room, start date and an end ("after N sessions" or a date) — they fill the grid coloured by subject. **Week / Day / Month** views (Month is a real calendar grid), a merged day-at-a-glance timeline, and **zoom 0.75×–4×** for a minute-level breakdown. Natural-language capture — *"Revise Polity tomorrow 5pm for 2h"* — still works.

### ✅ Kanban, To-dos & Exam Scorecards
Drag a task to *Done* → syllabus % recalculates instantly. Priority, inline notes, DnD reordering, double-click-to-edit. A dedicated **Scorecard** widget tracks mock-exam attempts (paste a raw result or log sectionals) with score / accuracy / percentile trends and a Gemini error-pattern coach.

### 🌅 Daily Check-ins
Morning / midday / evening prompts take over screen-centre behind a blur, ask one question, then hand the screen back — snooze if unanswered. Answers file themselves as all-scope memory notes the AI can recall.

### 🤖 AI Companion with Write Access
The Gemini chat assistant can complete tasks, set subject progress, add to-dos (with priority + notes), schedule timetable slots, toggle habits, and create subjects via natural language.

### 🔊 AudioFX Synthesized Sounds
Lightweight Web Audio API synthesizers that generate zero-latency chimes on Todo completion, timer transitions, and button clicks (customizable in Settings).

### 🕰️ Mechanical Flip-Card Clock
Draggable, scroll-to-scale (0.5x to 3.0x) split-flap clock with position/scale persisted in localStorage.

</td>
</tr>
</table>

---

## 🖥️ Native Desktop Superpowers

```
┌─────────────────────────────────────────────────────────────────┐
│  ELECTRON DESKTOP                                               │
│                                                                 │
│  ⌨️  Global Hotkeys           🔒  Hardware Fingerprint          │
│     Ctrl/Cmd+Shift+P              SHA-256 of hostname +         │
│     Ctrl/Cmd+Shift+Space          platform + arch + CPU         │
│     Ctrl/Cmd+Shift+F              + non-internal MACs           │
│     Ctrl/Cmd+Shift+H                                            │
│     Ctrl/Cmd+Shift+M          🛡️  safeStorage & Web Crypto      │
│                                   DPAPI / Keychain / PBKDF2     │
│  📡  Minimize-to-Tray         🔄  OTA Auto-Updates              │
│     Background execution          Enforced update gate          │
│     Alarms fire even when         GitHub Release feed           │
│     window is hidden              Auto-merge → auto-release     │
│                                                                 │
│  🪟  Picture-in-Picture (PiP) 💾  Window State Persistence      │
│     Always-on-top micro timer     Size, position, maximize,     │
│     floating window               and fullscreen survive        │
│                                   restart                       │
└─────────────────────────────────────────────────────────────────┘
```

- **Picture-in-Picture (PiP)** — compact, always-on-top micro-timer window with live countdown and play/pause controls
- **Cryptographic App Lock** — PIN-protected security overlay with PBKDF2/AES-GCM encryption and auto-lock on idle
- **Frameless window** with custom chrome, strict min bounds `940×600`, HiDPI-locked rendering
- **Window state persistence** — size, position, maximize, and fullscreen survive restart
- **`backgroundThrottling: false`** — alarms and chimes fire regardless of window state
- **8-character code login** as a QR alternative — readable, typeable `XXXX-XXXX` codes for any phone without a working camera

---

## 🏗️ Architecture

```
┌─────────────────────┐         ┌──────────────────────┐         ┌───────────────────────┐
│   📱 Phone           │         │   🔥 Firebase Spark   │         │   🖥️  Desktop          │
│   Web Gateway        │         │                      │         │   Electron App        │
│                      │         │  ┌────────────────┐  │         │                       │
│  pro-track-app       │─────────▶  │   Google Auth  │ ◀─────────│  QR + ID-Token        │
│  .netlify.app        │         │  └────────────────┘  │         │  sign-in handshake    │
│                      │         │  ┌────────────────┐  │         │                       │
│  ✦ Landing Page      │         │  │   Firestore    │ ◀─────────│  Workspace Dashboard  │
│  ✦ /link Auth Gate   │         │  └────────────────┘  │         │  (post-QR)            │
│                      │         │                      │         │                       │
│  ✗ No dashboard      │         │  Persistent cache    │         │  signInWithCredential │
│    rendered here     │         │  Owner-only rules    │         │  + delete handshake   │
└─────────────────────┘         └──────────────────────┘         └───────────────────────┘
```

**The QR handshake flow:**
1. Mobile writes Google ID token to a one-shot Firestore doc (`8-char sessionId`, 2-min TTL)
2. Desktop listens → consumes token via `signInWithCredential`
3. Handshake doc is deleted immediately — single use, zero residue

---

## 🛠️ Tech Stack

<div align="center">

| Layer | Technology | Notes |
|:------|:-----------|:------|
| **UI** | React 18 + Vite | Blazing-fast HMR |
| **Styling** | Tailwind CSS v3 | CSS-variable theming, `--root-font-size` cascade |
| **Animation** | Framer Motion | Shared-layout morphing + flip-card clock |
| **Drag & Drop** | @dnd-kit/core + sortable | Kanban + todo reorder |
| **State** | Zustand | Feature slices, no boilerplate |
| **Backend** | Firebase Auth + Firestore | Google Auth, persistent local cache |
| **AI** | `@google/generative-ai` (`gemini-2.5-flash` cascade) | Function-calling with full write access; auto-fallback on "high demand" |
| **Security & Crypto** | Web Crypto API + Electron safeStorage | PBKDF2 (100k iter) + AES-GCM 256-bit encryption |
| **Audio & SFX** | Web Audio API | Zero-latency synthesized chimes & UI audioFX |
| **Testing** | Vitest 2 + ESLint 10 | 411 unit tests across 25 suites; zero lint warnings |
| **Desktop** | Electron + electron-builder + electron-updater | Multi-OS builds |
| **NL Parsing** | chrono-node | *"tomorrow 5pm for 2h"* → Date objects |
| **CI/CD** | GitHub Actions | Auto-merge dev→master, multi-OS matrix, changelog |
| **Deploy** | Netlify (web) · GitHub Releases (desktop) | Fully automated |

</div>

---

## 📦 Install

<div align="center">

| Platform | Download |
|:--------:|:--------|
| 🪟 **Windows** | [`.exe` Installer → GitHub Releases](https://github.com/thecheesybit/protrack/releases) |
| 🍎 **macOS** | [`.dmg` → GitHub Releases](https://github.com/thecheesybit/protrack/releases) |
| 🐧 **Linux** | [`.AppImage` → GitHub Releases](https://github.com/thecheesybit/protrack/releases) |

</div>

After install → scan the QR from your phone (or enter the 8-char code in the browser, or click **Sign in with Google** on desktop). The app **auto-updates** from the GitHub release feed.

---

## 🚀 Develop Locally

```bash
# 1. Clone & install
git clone https://github.com/thecheesybit/protrack.git
cd protrack
npm install

# 2. Configure Firebase
cp .env.example .env   # fill in your Firebase web config (see below)

# 3. Run
npm run dev                # web renderer in browser (add ?desktop=1 to preview workspace)
npm run electron:dev       # full desktop app against the dev server
```

**`.env` variables:**

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_WEB_URL=https://pro-track-app.netlify.app
```

> ⚠️ When pasting values into GitHub Actions secrets, **make sure there are no trailing newlines** — `printf "%s" "value" | gh secret set NAME` is the safe way. A stray `\n` on `projectId` breaks every auth request silently.

---

## 🏭 Build & Release

Releases are **fully automated**. Two workflows turn any push into a shipped installer:

```
push to development
    │
    ├─ auto-merge.yml ─── verify build → fast-forward into master
    │                       │
    │                       ▼
    └─────────────► push to master
                        │
                        ├─ 1. Bump package.json version
                        ├─ 2. Regenerate CHANGELOG.md from conventional commits
                        ├─ 3. Deploy web build → Netlify
                        └─ 4. Build Electron installers in parallel
                                 │
                                 ├─ Windows-latest  → .exe
                                 ├─ macOS-latest    → .dmg
                                 └─ Ubuntu-latest   → .AppImage
                                       │
                                       └─ 5. Publish GitHub Release
                                              │
                                              └─ 🔄 in-app auto-update picks it up
```

**Required GitHub secrets:**

| Secret | Purpose |
|:-------|:--------|
| `GITHUB_TOKEN` | Auto-provided — used for release publishing |
| `VITE_FIREBASE_*` (6 keys) | Baked into the renderer bundle at build time |
| `NETLIFY_AUTH_TOKEN` | Optional — enables web auto-deploy |
| `NETLIFY_SITE_ID` | Optional — enables web auto-deploy |

**Local one-shot build:**

```bash
npm run build                  # web production build → dist/
npm run electron:build:win     # Windows .exe → release/
npm run electron:build:mac     # macOS .dmg  → release/
```

---

## 💸 Free-Tier Discipline

Pro Track is engineered to stay **well within Firebase Spark limits** forever:

```
Daily Firestore budget (typical heavy day)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Reads   ████░░░░░░░░░░░░░░░░░░░░░░░░░░░  ~200  /  50,000 free
Writes  ██░░░░░░░░░░░░░░░░░░░░░░░░░░░░░   ~80  /  20,000 free
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**How:**
- Firestore persistent local cache → reloads cost ~0 reads
- Ephemeral state (timer ticks, Dynamic Island, NL drafts, flip-clock ticks) **never touches the database**
- Writes coalesce via `arrayUnion` / `increment` / batched `writeBatch`
- Achievement ledger bounded to 200 entries
- No Cloud Functions. No paid plan. Ever.

---

## 🔐 Security Model

| Surface | Mechanism |
|:--------|:----------|
| **Gemini API key** | Browser `localStorage` only — never uploaded to any server |
| **App Lock Vault** | Client-side PBKDF2 key derivation (100k iterations, SHA-256) + AES-GCM 256-bit encryption with random salt & IV |
| **Desktop session** | Encrypted via `safeStorage` (DPAPI / Keychain / libsecret) |
| **QR / Code `sessionId`** | 8-char base32 (~1e12 combos), single-use bearer secret, 2-minute TTL, deleted on claim |
| **Firestore rules** | Strict owner-only access on `users/{uid}/**` |
| **Hardware fingerprint** | SHA-256 of hostname + platform + arch + CPU model + non-internal MACs. Raw identifiers never leave the device. |
| **DevTools (production)** | F12, Ctrl/Cmd+Shift+I/J/C, Ctrl/Cmd+Alt+I intercepted at the input-event level; `devtools-opened` is force-closed as a safety net. |
| **Firebase env values** | Trimmed at runtime so trailing whitespace from pasted secrets can't poison auth URLs. |

> **Handshake trade-off:** QR handshake docs are writeable by any authenticated client — a deliberate Spark-plan trade-off. Mitigated by: write-once, single-use, TTL-bounded, and deleted on claim.

---

## 📄 License

**Personal, non-commercial use only.** See the in-app Privacy Policy and Terms of Service.

---

<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&color=0:0f3460,50:1a1a2e,100:09090e&height=120&section=footer&animation=fadeIn" width="100%"/>

**Built with obsession by [Ayush Kumar](https://github.com/thecheesybit)**
*If Pro Track saves your revision session, give it a ⭐*

</div>
