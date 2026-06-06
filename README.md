# PRO TRACK

A radically simplified, auto-adapting **all-in-one productivity workspace** — built to feel premium, fluid, and minimalist (think Linear × Reflect × Forest).

> Everything happens on one unified, morphing board. No nested routing mazes.

## Tech Stack

| Layer | Choice |
|---|---|
| Frontend | React 18 (Vite SPA) |
| Styling | Tailwind CSS v3 (CSS-variable theming) |
| Animation | Framer Motion (shared-layout morphing) |
| State | Zustand (slices) + React Context (auth/theme boundaries) |
| Backend | Firebase — Google OAuth, Firestore, Storage |
| Deploy | Netlify |

## Getting Started

```bash
# 1. Install dependencies
npm install

# 2. Configure Firebase
cp .env.example .env       # then fill in your Firebase web config

# 3. Run
npm run dev
```

The app boots even without Firebase configured — the auth screen will show a
setup notice instead of crashing.

### Firebase setup checklist
1. Create a project at <https://console.firebase.google.com>.
2. Add a **Web app**, copy the config into `.env`.
3. **Authentication** → enable **Google** sign-in provider.
4. **Firestore Database** → create database (start in test mode for dev).
5. **Storage** → enable (used later for audio notes).

## Roadmap (sprints)

- [x] **Sprint 0** — Scaffolding (Vite, Tailwind, Firebase, Netlify)
- [x] **Sprint 1** — Auth & Layout Shell (Google OAuth, dashboard, mode switcher, focused-zoom)
- [x] **Sprint 2** — Modes & Workspace Context (CRUD, drag-reorder)
- [x] **Sprint 3** — Smart Timetable + Google Calendar
- [x] **Sprint 4** — Subject Tracker + micro-Kanban
- [x] **Sprint 5** — Deep Focus + Gamification + Analytics
- [x] **Sprint 6** — AI Companion + Voice Notes (Gemini)
- [x] **Sprint 7** — Wellness & Habits
- [x] **Sprint 8** — Polish & Ship
- [ ] **Desktop** — Electron wrapper + QR mobile→desktop auth sync

## Project Structure

```
src/
├─ components/   # auth, layout, widgets, ui, common
├─ context/      # AuthProvider, ThemeProvider
├─ hooks/        # useAuth, useTheme
├─ lib/          # firebase init, constants, icons
├─ providers/    # FirestoreSyncProvider (onSnapshot → store)
├─ services/     # Firestore data access (user, mode)
├─ store/        # Zustand root + slices
└─ utils/        # cn, helpers
```
