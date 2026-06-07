/**
 * gcal-sync — Google Calendar OAuth integration (not yet implemented).
 *
 * Returns 501 so callers fall back to the direct Google Calendar API path
 * (see calendarService.js). This removes the mock payloads that previously
 * logged caller tokens to the Netlify function console.
 */

exports.handler = async () => ({
  statusCode: 501,
  body: JSON.stringify({ error: 'Calendar sync not implemented' }),
})
