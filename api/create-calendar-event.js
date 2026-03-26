export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { workspaceId, participantName, participantEmail, startsAt, durationMinutes, title } = req.body
  if (!workspaceId || !startsAt) return res.status(400).json({ error: 'Missing required fields' })

  const SUPABASE_URL = process.env.VITE_SUPABASE_URL
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY

  const headers = {
    'Content-Type':  'application/json',
    'apikey':        SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
  }

  try {
    // 1. Get stored Google token for this workspace
    const tokenRes = await fetch(
      `${SUPABASE_URL}/rest/v1/google_tokens?workspace_id=eq.${workspaceId}&select=*`,
      { headers }
    )
    const tokens = await tokenRes.json()
    if (!tokens.length) {
      return res.status(401).json({ error: 'No Google Calendar connected. Please reconnect your account.' })
    }

    let { access_token, refresh_token, expiry, email: ownerEmail } = tokens[0]

    // 2. Refresh token if expired
    if (expiry && new Date(expiry) < new Date()) {
      const refreshed = await refreshAccessToken(refresh_token)
      if (refreshed.error) return res.status(401).json({ error: 'Token refresh failed. Please reconnect Google.' })
      access_token = refreshed.access_token

      // Update stored token
      await fetch(`${SUPABASE_URL}/rest/v1/google_tokens?workspace_id=eq.${workspaceId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          access_token,
          expiry: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        }),
      })
    }

    // 3. Build event times
    const start = new Date(startsAt)
    const end   = new Date(start.getTime() + (durationMinutes || 60) * 60000)

    // 4. Build attendees
    const attendees = [{ email: ownerEmail }]
    if (participantEmail) attendees.push({ email: participantEmail, displayName: participantName || '' })

    // 5. Create Google Calendar event with Meet conferencing
    const eventBody = {
      summary:     title || `Research Interview — ${participantName || 'Participant'}`,
      description: `InterviewOS research session.\n\nParticipant: ${participantName || '—'}\nEmail: ${participantEmail || '—'}`,
      start: { dateTime: start.toISOString(), timeZone: 'UTC' },
      end:   { dateTime: end.toISOString(),   timeZone: 'UTC' },
      attendees,
      conferenceData: {
        createRequest: {
          requestId:             `interviewos-${Date.now()}`,
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      },
      reminders: {
        useDefault: false,
        overrides:  [
          { method: 'email',  minutes: 24 * 60 },
          { method: 'popup',  minutes: 30 },
        ],
      },
      guestsCanModify:     false,
      guestsCanInviteOthers: false,
    }

    const calRes = await fetch(
      'https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1&sendUpdates=all',
      {
        method:  'POST',
        headers: {
          'Authorization': `Bearer ${access_token}`,
          'Content-Type':  'application/json',
        },
        body: JSON.stringify(eventBody),
      }
    )

    const calData = await calRes.json()
    if (!calRes.ok) {
      console.error('Google Calendar error:', calData)
      return res.status(calRes.status).json({ error: calData.error?.message || 'Google Calendar error' })
    }

    const meetLink = calData.conferenceData?.entryPoints?.find(e => e.entryPointType === 'video')?.uri || ''
    const eventId  = calData.id

    return res.status(200).json({ success: true, meetLink, eventId, htmlLink: calData.htmlLink })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}

async function refreshAccessToken(refreshToken) {
  if (!refreshToken) return { error: 'No refresh token' }
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type:    'refresh_token',
    }).toString(),
  })
  return res.json()
}
