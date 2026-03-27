async function refreshToken(rt) {
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID, client_secret: process.env.GOOGLE_CLIENT_SECRET, refresh_token: rt, grant_type: 'refresh_token' }).toString(),
  })
  return r.json()
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const { workspaceId } = req.body
  if (!workspaceId) return res.status(400).json({ error: 'Missing workspaceId' })

  const SB_URL = process.env.VITE_SUPABASE_URL
  const SB_KEY = process.env.SUPABASE_SERVICE_KEY
  const hdrs   = { 'Content-Type': 'application/json', 'apikey': SB_KEY, 'Authorization': `Bearer ${SB_KEY}` }

  try {
    // Load token
    const tr = await fetch(`${SB_URL}/rest/v1/google_tokens?workspace_id=eq.${workspaceId}&select=*`, { headers: hdrs })
    const tokens = await tr.json()
    if (!tokens.length) return res.status(401).json({ error: 'No Google token' })

    let { access_token, refresh_token: rt, expiry } = tokens[0]

    if (expiry && new Date(expiry) < new Date()) {
      const refreshed = await refreshToken(rt)
      if (refreshed.error) return res.status(401).json({ error: 'Token refresh failed' })
      access_token = refreshed.access_token
      await fetch(`${SB_URL}/rest/v1/google_tokens?workspace_id=eq.${workspaceId}`, {
        method: 'PATCH', headers: hdrs,
        body: JSON.stringify({ access_token, expiry: new Date(Date.now() + refreshed.expires_in * 1000).toISOString() }),
      })
    }

    // Fetch next 14 days of events from Google Calendar
    const now     = new Date()
    const twoWeeks = new Date(now.getTime() + 14 * 86400000)
    const gcalUrl = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${now.toISOString()}&timeMax=${twoWeeks.toISOString()}&singleEvents=true&orderBy=startTime`

    const gr = await fetch(gcalUrl, { headers: { 'Authorization': `Bearer ${access_token}` } })
    const gcalData = await gr.json()
    if (!gr.ok) return res.status(gr.status).json({ error: gcalData.error?.message })

    const gcalEvents = gcalData.items || []

    // Delete old gcal blocks for this workspace
    await fetch(`${SB_URL}/rest/v1/slots?workspace_id=eq.${workspaceId}&is_gcal_block=eq.true`, {
      method: 'DELETE', headers: hdrs
    })

    // Insert new blocks (skip all-day events, skip events created by InterviewOS)
    const blocks = gcalEvents
      .filter(e => e.start?.dateTime && !e.description?.includes('InterviewOS session'))
      .map(e => ({
        workspace_id:     workspaceId,
        starts_at:        e.start.dateTime,
        ends_at:          e.end.dateTime,
        duration_minutes: Math.round((new Date(e.end.dateTime) - new Date(e.start.dateTime)) / 60000),
        available:        false,
        is_gcal_block:    true,
        gcal_event_id:    e.id,
        meet_link:        '',
      }))

    if (blocks.length > 0) {
      await fetch(`${SB_URL}/rest/v1/slots`, {
        method: 'POST', headers: { ...hdrs, 'Prefer': 'return=minimal' },
        body: JSON.stringify(blocks),
      })
    }

    return res.status(200).json({ success: true, synced: blocks.length })
  } catch (e) { return res.status(500).json({ error: e.message }) }
}
