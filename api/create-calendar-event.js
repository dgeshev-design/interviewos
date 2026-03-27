async function refreshToken(refreshToken) {
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID, client_secret: process.env.GOOGLE_CLIENT_SECRET, refresh_token: refreshToken, grant_type: 'refresh_token' }).toString(),
  })
  return r.json()
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const { workspaceId, participantName, participantEmail, startsAt, durationMinutes, title } = req.body
  if (!workspaceId || !startsAt) return res.status(400).json({ error: 'Missing fields' })

  const SB_URL = process.env.VITE_SUPABASE_URL
  const SB_KEY = process.env.SUPABASE_SERVICE_KEY
  const hdrs   = { 'Content-Type': 'application/json', 'apikey': SB_KEY, 'Authorization': `Bearer ${SB_KEY}` }

  try {
    // 1. Load token
    const tr = await fetch(`${SB_URL}/rest/v1/google_tokens?workspace_id=eq.${workspaceId}&select=*`, { headers: hdrs })
    const tokens = await tr.json()
    if (!tokens.length) return res.status(401).json({ error: 'No Google token. Please reconnect.' })

    let { access_token, refresh_token: rt, expiry, email: ownerEmail } = tokens[0]

    // 2. Refresh if expired
    if (expiry && new Date(expiry) < new Date()) {
      const refreshed = await refreshToken(rt)
      if (refreshed.error) return res.status(401).json({ error: 'Token refresh failed. Reconnect Google.' })
      access_token = refreshed.access_token
      await fetch(`${SB_URL}/rest/v1/google_tokens?workspace_id=eq.${workspaceId}`, {
        method: 'PATCH', headers: hdrs,
        body: JSON.stringify({ access_token, expiry: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(), updated_at: new Date().toISOString() }),
      })
    }

    // 3. Build event
    const start = new Date(startsAt)
    const end   = new Date(start.getTime() + (durationMinutes || 60) * 60000)
    const attendees = [{ email: ownerEmail }]
    if (participantEmail) attendees.push({ email: participantEmail, displayName: participantName || '' })

    const eventBody = {
      summary:     title || `Research Interview — ${participantName || 'Participant'}`,
      description: `InterviewOS session\nParticipant: ${participantName || '—'}\nEmail: ${participantEmail || '—'}`,
      start: { dateTime: start.toISOString(), timeZone: 'UTC' },
      end:   { dateTime: end.toISOString(),   timeZone: 'UTC' },
      attendees,
      conferenceData: { createRequest: { requestId: `ios-${Date.now()}`, conferenceSolutionKey: { type: 'hangoutsMeet' } } },
      reminders: { useDefault: false, overrides: [{ method: 'email', minutes: 1440 }, { method: 'popup', minutes: 30 }] },
      guestsCanModify: false,
    }

    const cr = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1&sendUpdates=all', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(eventBody),
    })
    const calData = await cr.json()
    if (!cr.ok) return res.status(cr.status).json({ error: calData.error?.message || 'Google Calendar error' })

    const meetLink = calData.conferenceData?.entryPoints?.find(e => e.entryPointType === 'video')?.uri || ''
    return res.status(200).json({ success: true, meetLink, eventId: calData.id, htmlLink: calData.htmlLink })
  } catch (e) { return res.status(500).json({ error: e.message }) }
}
