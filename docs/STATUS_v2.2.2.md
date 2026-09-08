# PRO TRACK — status vs. everything discussed

**As of:** 2026-09-08 · **Branch:** `development` (local, **not pushed** — you gate the push)
**Version:** `2.2.2` · **Gates:** lint 0 · 411 tests · web + Electron builds green
**Commits this round:** ~16 on top of the P1–P13 consolidation.

---

## 1. Original consolidation brief (Steps 1–4)

| Item | Status |
|---|---|
| Step 1 — audit + `docs/CONSOLIDATION_PLAN_P1_P13.md` | ✅ done |
| Step 2 — P1–P13 + scorecard consolidated (dead code, chimes, scorecard delint, A3 docs) | ✅ done |
| Step 3 — marketing website rewritten to current features | ✅ done |
| Step 4 — auto-update fully silent (one-click NSIS, `quitAndInstall(true,true)`, single "Restart to apply" action) | ✅ done (code + config; a real v→v+1 release still needed to prove OTA) |
| Merge P3 / P7 / P4b (were done-but-unmerged) | ✅ handled by the parallel wave-3 session |

---

## 2. Screenshot feedback (markers 1–6) + the notes for them

| # | Ask | Status |
|---|---|---|
| 1 | To-do markers at the **exact time** they were added, numbered 1·2·3 — not a "+5" pile | ✅ undated to-dos render inline on today's column at their `createdAt` minute, numbered |
| 2 | Remove the small sapling tree icons on empty days | ✅ removed (+ removed ~5 MB of unused forest source art) |
| 3 | Everything (event / subject task / anything dated) shows at its real time on the timeline | ✅ to-dos, one-time events, note deadlines, **subject Kanban cards with a day/time**, and Google events all plot at their time |
| 3 | **Zoom in / out** on the timetable time-scale | ❌ **not done** — deferred |
| 3 | Day-header "7 open · 0 today" pill | ✅ left as-is (you said it's fine) |
| 4 | Compact "Completed" to-do panel must never overlap / float over the board | ✅ clipped in normal flow, capped height + own scroll |
| 5 | AI "model in high demand" — fix model selection | ✅ current model ids only, retry-then-cascade with backoff (was falling through to retired 404 models) |
| 5 | **Voice-note vs transcription** buttons must be distinct + intuitive | ❌ **not done** |
| 5 | General AI panel overhaul / more intuitive | ❌ **not done** (only the model engine was fixed) |
| 6 | Transparent `?` button top-right → full shortcuts/commands list; `?` key opens it | ✅ `HelpModal` — global + in-app + window shortcuts; `?` key opens; button sits **below** the titlebar controls |

Also from the same round:
| Ask | Status |
|---|---|
| Clicking a weekday header selects that day (was firing add-task) | ✅ opens that date in Day view |
| Answered morning/evening check-ins auto-save to Notes **memories** (all scopes) for the AI | ✅ done |
| Fullscreen (hero) timetable only had Week — add Day + Month there too | ✅ done |
| Month tab must be a **real month calendar grid**, not an agenda list | ✅ `MonthGrid` — 6×7 day cells; click a day → Day view |
| Month view should also work **without** a Google connection | ✅ shows local items; folds in Google when connected |
| "…and whatever is in the month tab now should be in the day tab" | 🟡 partial — Month is now a grid; the old agenda-list flavour was **not** relocated into Day (Day is still the single-day timeline). Tell me if you still want an "upcoming" list in Day. |

---

## 3. Google Calendar (the big one)

| Ask | Status |
|---|---|
| 403 on connect | ✅ you enabled the Calendar API; code now also parses the real Google reason with a Console link if it recurs |
| "session expired" right after connecting, drops to disconnected | ✅ fixed — a 403-insufficient-scope no longer clears the token; it degrades to the primary calendar + a one-time reconnect nudge |
| "connect asks me too often" — make it persistent as login | ✅ **web:** GIS silent refresh with your client id (proactive 50-min timer + silent 401 retry) → no more prompts. 🟡 **desktop:** `/link-gcal` now silent-first + auto-close, so a reconnect is one click that completes invisibly — but the *proactive* background re-handshake tab isn't auto-triggered yet, so ~hourly you may still see a "reconnect" card to click once. |
| Holidays (Ganesh Chaturthi 14th, etc.) must appear | ✅ pulls **every** calendar incl. holiday calendars — **needs you to reconnect once** so the token gets the wider `calendar` scope |
| "checking protrack tomorrow 8:30" test event must sync in | ✅ pulled from your primary calendar → shows in Day view at 8:30 and in the Month grid — **needs the reconnect / a sync to have run** |
| Stop dumping events (birthdays, "happy birthday", holidays) into the **to-do list** | ✅ pulled events go to a **local cache**, never to-dos; the Kanban board hard-filters `source:'gcal'`; a one-time migration deletes the old ones |
| A PRO TRACK to-do ("better visibility of timetable…") showed up as a Google event | ✅ push is now **calendar items only** (slots + one-time events); to-dos/notes/tasks are never pushed, and the stray ones get deleted from Google on the next sync |
| Two-way — things I add here push to Google | ✅ for slots + one-time events (with a 30-min reminder); holiday/subscribed/shared calendars stay read-only (Google forbids writing them) |
| Movie tickets / flights / reservations (Gmail-generated) show up | ✅ they're normal events on your calendars → pulled like everything else |
| Month-wise / date-wise layout, not all at once | ✅ Month grid (this month + navigate); Day view per day |
| "make sure gcal works no matter what" | 🟡 code is comprehensive + robust; **unverified on your machine** — needs you to reconnect and confirm |

---

## 4. Subjects / to-dos we discussed

Your backlog to-dos from the first screenshot map to phases that are already merged:

| Your note | Covered by |
|---|---|
| "no global switcher b/w subjects" / "subject global should be a list (max 5 visible → all)" | ✅ P9 — exhaustive scrollable list, no 5-cap, persistent rail |
| "adding new subject after 1st requires full screen" / "add subject/task/todo by click on section" | ✅ P9 — add-from-anywhere, double-click empty space, mode picker in All Scopes |
| "better visibility of timetable wrt task/event — expand on hover, detail at side" | ✅ P10 — compact markers + `ItemDetailPopover` in the gutter |
| "prompting to create subject todo via AI for repetitive tasks" | ✅ P12 — `SubjectQuickAdd` (type/dictate "add lesson 18 to 36") |
| "a counter on dashboard with reminders" | ✅ P11 — "N open · M today · K overdue" pill |
| "subject with no time = normal; with a day/time = appears on the timeline" | ✅ this round — `useModeTasksWithDates` feeds dated Kanban cards to timeline/day/month |
| "proceed with the plan.md" | ✅ this whole effort |

---

## 5. What's left

| # | Item | Size | Notes |
|---|---|---|---|
| L1 | **Timetable zoom** (in/out on the time scale) | M | needs threading a scale factor through the grid's positioned blocks |
| L2 | **AI panel: split voice-note vs transcription**, general intuitiveness pass | M–L | model engine is fixed; the UI/UX overhaul is untouched |
| L3 | **P8 cross-module nav** — wire P7's `openModule` into widgets (Subject→Analytics/History, timeline card→home widget, ledger→subject) | M | P7's bus exists; nothing consumes it yet |
| L4 | **Desktop GCal proactive refresh** — auto-open the silent `/link-gcal?silent=1` tab before the token expires, so desktop never shows a reconnect card | S–M | web is already fully silent |
| L5 | **"Upcoming" list in the Day tab** (if you still want the old month-agenda flavour there) | S | need your call |
| L6 | **Verify GCal end-to-end on your machine** — reconnect once, confirm holidays + the 8:30 test event appear, no stray events | — | your action |
| L7 | **Push `development`** → triggers auto-merge + release | — | your call; hold until you've reviewed |

**Roughly:** the consolidation brief + the screenshot markers + the GCal rework are **done**; what remains is the AI-UI overhaul, timetable zoom, P8 wiring, and your verification pass.
