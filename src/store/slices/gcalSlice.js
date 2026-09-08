/**
 * Google Calendar display cache — LOCAL ONLY, never persisted to Firestore.
 *
 * `useCalendarSync` pulls events from every visible Google calendar (primary,
 * secondary, subscribed, holidays, shared, Gmail-generated) and drops the
 * normalized list here. Widgets read it for the month/day agenda and to plot
 * remote events on the timetable grid. Because it's ephemeral, hundreds of
 * holiday entries cost zero Firestore quota.
 *
 * Pure slice — no timers, no I/O.
 */
export const createGcalSlice = (set) => ({
  gcalEvents: [], // normalized: { id, calendarId, calendarName, color, title, allDay, startMs, endMs, dateStr, startMin, endMin, location, htmlLink, readonly, isHoliday }
  gcalCalendars: [], // { id, name, color, accessRole, primary, writable }
  gcalSetupError: null, // { message, consoleUrl } when the Calendar API needs a Cloud Console fix
  gcalLastSyncAt: 0,

  setGcalEvents: (gcalEvents) =>
    set({ gcalEvents: Array.isArray(gcalEvents) ? gcalEvents : [], gcalLastSyncAt: Date.now() }),

  setGcalCalendars: (gcalCalendars) =>
    set({ gcalCalendars: Array.isArray(gcalCalendars) ? gcalCalendars : [] }),

  setGcalSetupError: (gcalSetupError) => set({ gcalSetupError: gcalSetupError || null }),

  clearGcalCache: () =>
    set({ gcalEvents: [], gcalCalendars: [], gcalSetupError: null, gcalLastSyncAt: 0 }),
})
