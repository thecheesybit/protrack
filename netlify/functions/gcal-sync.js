/**
 * Netlify Serverless Function: gcal-sync
 * Handles secure OAuth2 token exchange and bi-directional calendar sync
 * for PRO TRACK, keeping client-side architecture strictly within the free tier.
 */

exports.handler = async (event, context) => {
  // Only allow POST requests for state mutation
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed. Use POST.' })
    }
  }

  try {
    const payload = JSON.parse(event.body)
    const { action, authCode, tokenPayload, syncData } = payload

    switch (action) {
      case 'exchange_code':
        // MOCK: Exchange OAuth authorization code for tokens
        // In a real environment, you'd call https://oauth2.googleapis.com/token
        // using process.env.GOOGLE_CLIENT_ID and process.env.GOOGLE_CLIENT_SECRET
        if (!authCode) throw new Error('Missing authCode')
        
        return {
          statusCode: 200,
          body: JSON.stringify({
            access_token: 'mock_gcal_access_token_' + Date.now(),
            refresh_token: 'mock_gcal_refresh_token',
            expires_in: 3599
          })
        }

      case 'sync_up':
        // MOCK: Push local updates to Google Calendar
        if (!tokenPayload) throw new Error('Missing tokenPayload for authorization')
        
        // Push logic here...
        console.log('[gcal-sync] Pushing updates to Google Calendar:', syncData)

        return {
          statusCode: 200,
          body: JSON.stringify({ success: true, message: 'Sync Up Complete' })
        }

      case 'sync_down':
        // MOCK: Pull remote updates from Google Calendar
        if (!tokenPayload) throw new Error('Missing tokenPayload for authorization')
        
        // Fetch logic here...
        console.log('[gcal-sync] Pulling updates from Google Calendar')

        return {
          statusCode: 200,
          body: JSON.stringify({ 
            success: true, 
            events: [
              // mock payload matching ChronoGrid events
            ] 
          })
        }

      default:
        return {
          statusCode: 400,
          body: JSON.stringify({ error: 'Unknown sync action provided' })
        }
    }
  } catch (error) {
    console.error('[gcal-sync] Invocation Error:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || 'Internal Server Error' })
    }
  }
}
