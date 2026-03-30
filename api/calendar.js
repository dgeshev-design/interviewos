// Consolidated calendar handler: /api/calendar?action=sync|create|generate|save-token

async function getRefreshedToken(rt) {
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID, client_secret: process.env.GOOGLE_CLIENT_SECRET, refresh_token: rt, grant_type: 'refresh_token' }).toString(),
  })
  return r.json()
}

async function getToken(workspaceId, SB_URL, hdrs) {
  const r = await fetch(`${SB_URL}/rest/v1/google_tokens?workspace_id=eq.${workspaceId}&select=*`, { headers: hdrs })
  const tokens = await r.json()
  if (!tokens.length) throw new Error('No Google token. Please connect Google Calendar in Settings.')
  let { access_token, refresh_token: rt, expiry } = tokens[0]
  if (expiry && new Date(expiry).getTime() - Date.now() < 300000 && rt) {
    const refreshed = await getRefreshedToken(rt)
    if (!refreshed.error) {
      access_token = refreshed.access_token
      await fetch(`${SB_URL}/rest/v1/google_tokens?workspace_id=eq.${workspaceId}`, {
        method: 'PATCH', headers: hdrs,
        body: JSON.stringify({ access_token, expiry: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(), updated_at: new Date().toISOString() }),
      })
    }
  }
  return { ...tokens[0], access_token }
}

export default async function handler(req, res) {
  const SB_URL = process.env.VITE_SUPABASE_URL
  const SB_KEY = process.env.SUPABASE_SERVICE_KEY
  const hdrs   = { 'Content-Type': 'application/json', 'apikey': SB_KEY, 'Authorization': `Bearer ${SB_KEY}` }

  // Support both ?action=x in URL and action in body
  const url    = new URL(req.url, 'http://localhost')
  const action = url.searchParams.get('action') || req.body?.action

  // ── save-token ──────────────────────────────────────────────────────────
  if (action === 'save-token') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
    const { workspaceId, accessToken, refreshToken, expiresIn, email } = req.body
    if (!workspaceId || !accessToken) return res.status(400).json({ error: 'Missing fields' })
    try {
      const expiry = expiresIn ? new Date(Date.now() + expiresIn * 1000).toISOString() : null
      const r = await fetch(`${SB_URL}/rest/v1/google_tokens`, {
        method: 'POST',
        headers: { ...hdrs, 'Prefer': 'resolution=merge-duplicates,return=representation' },
        body: JSON.stringify({ workspace_id: workspaceId, access_token: accessToken, refresh_token: refreshToken || null, expiry, email: email || null, updated_at: new Date().toISOString() }),
      })
      const d = await r.json()
      if (!r.ok) return res.status(r.status).json({ error: d.message })
      return res.status(200).json({ success: true })
    } catch (e) { return res.status(500).json({ error: e.message }) }
  }

  // ── sync ────────────────────────────────────────────────────────────────
  if (action === 'sync') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
    const { workspaceId } = req.body
    if (!workspaceId) return res.status(400).json({ error: 'Missing workspaceId' })
    try {
      const token = await getToken(workspaceId, SB_URL, hdrs)
      const todayStart = new Date(); todayStart.setUTCHours(0,0,0,0)
      const now = todayStart.toISOString()
      const future = new Date(Date.now() + 60 * 86400000).toISOString()
      const gr = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${now}&timeMax=${future}&singleEvents=true&orderBy=startTime&maxResults=100`, { headers: { 'Authorization': `Bearer ${token.access_token}` } })
      if (!gr.ok) {
        const err = await gr.json()
        return res.status(gr.status).json({ error: err.error?.message || 'Google Calendar API error' })
      }
      const events = (await gr.json()).items || []

      // ── Detect booking cancellations from Google Calendar ────────────────
      // Find InterviewOS booked slots (not gcal blocks) that have a gcal_event_id
      const bookedSlotsR = await fetch(`${SB_URL}/rest/v1/slots?workspace_id=eq.${workspaceId}&is_gcal_block=eq.false&available=eq.false&gcal_event_id=not.is.null&select=id,gcal_event_id,participant_id`, { headers: hdrs })
      const bookedSlots  = await bookedSlotsR.json()
      const cancelledEventIds = new Set(events.filter(e => e.status === 'cancelled').map(e => e.id))
      const activeEventIds    = new Set(events.filter(e => e.status !== 'cancelled').map(e => e.id))
      for (const slot of (bookedSlots || [])) {
        // Event was explicitly cancelled OR is missing from the future window entirely
        const wasCancelled = cancelledEventIds.has(slot.gcal_event_id) || (!activeEventIds.has(slot.gcal_event_id))
        if (wasCancelled && slot.participant_id) {
          await fetch(`${SB_URL}/rest/v1/slots?id=eq.${slot.id}`, { method: 'PATCH', headers: hdrs, body: JSON.stringify({ available: true, participant_id: null, meet_link: '', gcal_event_id: null }) })
          await fetch(`${SB_URL}/rest/v1/participants?id=eq.${slot.participant_id}`, { method: 'PATCH', headers: hdrs, body: JSON.stringify({ status: 'cancelled' }) })
        }
      }

      // ── Rebuild gcal busy blocks ─────────────────────────────────────────
      await fetch(`${SB_URL}/rest/v1/slots?workspace_id=eq.${workspaceId}&is_gcal_block=eq.true`, { method: 'DELETE', headers: hdrs })
      const blocks = events
        .filter(e => (e.start?.dateTime || e.start?.date) && e.status !== 'cancelled' && !e.description?.includes('InterviewOS session'))
        .map(e => {
          const isAllDay = !e.start.dateTime
          const starts_at = isAllDay ? `${e.start.date}T00:00:00Z` : e.start.dateTime
          const ends_at   = isAllDay ? `${e.end.date}T00:00:00Z`   : e.end.dateTime
          const duration_minutes = Math.round((new Date(ends_at) - new Date(starts_at)) / 60000)
          return { workspace_id: workspaceId, starts_at, ends_at, duration_minutes, available: false, is_gcal_block: true, gcal_event_id: e.id, meet_link: '', study_id: null }
        })
      if (blocks.length > 0) await fetch(`${SB_URL}/rest/v1/slots`, { method: 'POST', headers: { ...hdrs, 'Prefer': 'return=minimal' }, body: JSON.stringify(blocks) })
      return res.status(200).json({ success: true, synced: blocks.length })
    } catch (e) { return res.status(500).json({ error: e.message }) }
  }

  // ── create ──────────────────────────────────────────────────────────────
  if (action === 'create') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
    const { workspaceId, participantName, participantEmail, startsAt, durationMinutes, title } = req.body
    if (!workspaceId || !startsAt) return res.status(400).json({ error: 'Missing fields' })
    try {
      const token = await getToken(workspaceId, SB_URL, hdrs)
      const start = new Date(startsAt)
      const end   = new Date(start.getTime() + (durationMinutes || 60) * 60000)
      const attendees = [{ email: token.email }]
      if (participantEmail) attendees.push({ email: participantEmail, displayName: participantName || '' })
      const cr = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1&sendUpdates=all', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ summary: title || `Research Interview — ${participantName}`, description: `InterviewOS session\nParticipant: ${participantName}\nEmail: ${participantEmail}`, start: { dateTime: start.toISOString(), timeZone: 'UTC' }, end: { dateTime: end.toISOString(), timeZone: 'UTC' }, attendees, conferenceData: { createRequest: { requestId: `ios-${Date.now()}`, conferenceSolutionKey: { type: 'hangoutsMeet' } } }, reminders: { useDefault: false, overrides: [{ method: 'email', minutes: 1440 }, { method: 'popup', minutes: 30 }] } }),
      })
      const calData = await cr.json()
      if (!cr.ok) return res.status(cr.status).json({ error: calData.error?.message })
      const meetLink = calData.conferenceData?.entryPoints?.find(e => e.entryPointType === 'video')?.uri || ''
      return res.status(200).json({ success: true, meetLink, eventId: calData.id })
    } catch (e) { return res.status(500).json({ error: e.message }) }
  }

  // ── cancel event ────────────────────────────────────────────────────────
  if (action === 'cancel') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
    const { workspaceId, eventId } = req.body
    if (!workspaceId || !eventId) return res.status(400).json({ error: 'Missing fields' })
    try {
      const token = await getToken(workspaceId, SB_URL, hdrs)
      const dr = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token.access_token}` },
      })
      // 204 = success, 410 = already deleted — both are fine
      if (!dr.ok && dr.status !== 410) {
        const err = await dr.json().catch(() => ({}))
        return res.status(dr.status).json({ error: err.error?.message || 'Failed to delete calendar event' })
      }
      return res.status(200).json({ success: true })
    } catch (e) { return res.status(500).json({ error: e.message }) }
  }

  // ── generate slots ──────────────────────────────────────────────────────
  if (action === 'generate') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
    const { workspaceId, studyId, dateFrom, dateTo, timeFrom, timeTo, durationMinutes, bufferMinutes, daysOfWeek, timezoneOffset } = req.body
    if (!workspaceId || !dateFrom || !dateTo) return res.status(400).json({ error: 'Missing fields' })
    try {
      const dur = parseInt(durationMinutes, 10) || 60
      const buf = parseInt(bufferMinutes, 10) || 0
      const step = dur + buf
      const allowed = daysOfWeek || [1,2,3,4,5]
      // Convert local time input to UTC using browser's timezone offset
      // getTimezoneOffset() = UTC - local in minutes (e.g. UTC+3 → -180)
      // UTC = local + timezoneOffset (in minutes)
      const tzOff = parseInt(timezoneOffset || 0, 10)
      const [fH, fM] = (timeFrom || '09:00').split(':').map(Number)
      const [tH, tM] = (timeTo   || '17:00').split(':').map(Number)
      const fromUTCMin = ((fH * 60 + fM + tzOff) % 1440 + 1440) % 1440
      const toUTCMin   = ((tH * 60 + tM + tzOff) % 1440 + 1440) % 1440
      const fromUTCH = Math.floor(fromUTCMin / 60), fromUTCM = fromUTCMin % 60
      const toUTCH   = Math.floor(toUTCMin   / 60), toUTCM   = toUTCMin   % 60
      const slots = []
      const cur = new Date(`${dateFrom}T00:00:00Z`)
      const end = new Date(`${dateTo}T23:59:59Z`)
      while (cur <= end) {
        if (allowed.includes(cur.getUTCDay())) {
          const dayStart = new Date(cur); dayStart.setUTCHours(fromUTCH, fromUTCM, 0, 0)
          const dayEnd   = new Date(cur); dayEnd.setUTCHours(toUTCH, toUTCM, 0, 0)
          let s = new Date(dayStart)
          while (s.getTime() + dur * 60000 <= dayEnd.getTime()) {
            slots.push({ workspace_id: workspaceId, study_id: studyId || null, starts_at: s.toISOString(), ends_at: new Date(s.getTime() + dur * 60000).toISOString(), duration_minutes: dur, available: true, is_gcal_block: false, meet_link: '' })
            s = new Date(s.getTime() + step * 60000)
          }
        }
        cur.setUTCDate(cur.getUTCDate() + 1)
      }
      if (!slots.length) return res.status(200).json({ created: 0 })
      await fetch(`${SB_URL}/rest/v1/availability_windows`, { method: 'POST', headers: { ...hdrs, 'Prefer': 'return=minimal' }, body: JSON.stringify({ workspace_id: workspaceId, study_id: studyId || null, date_from: dateFrom, date_to: dateTo, time_from: timeFrom, time_to: timeTo, duration_minutes: dur, buffer_minutes: buf, days_of_week: allowed }) })
      const ir = await fetch(`${SB_URL}/rest/v1/slots`, { method: 'POST', headers: { ...hdrs, 'Prefer': 'return=representation' }, body: JSON.stringify(slots) })
      const created = await ir.json()
      return res.status(200).json({ created: Array.isArray(created) ? created.length : 0 })
    } catch (e) { return res.status(500).json({ error: e.message }) }
  }

  // ── get-rule ────────────────────────────────────────────────────────────
  if (action === 'get-rule') {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
    const wid = url.searchParams.get('workspaceId')
    if (!wid) return res.status(400).json({ error: 'Missing workspaceId' })
    try {
      const r = await fetch(`${SB_URL}/rest/v1/availability_rules?workspace_id=eq.${wid}&select=*`, { headers: hdrs })
      const rows = await r.json()
      return res.status(200).json(rows[0] || null)
    } catch (e) { return res.status(500).json({ error: e.message }) }
  }

  // ── save-rule ────────────────────────────────────────────────────────────
  if (action === 'save-rule') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
    const { workspaceId, daysOfWeek, timeFrom, timeTo, durationMinutes, bufferMinutes, timezoneOffset } = req.body
    if (!workspaceId) return res.status(400).json({ error: 'Missing workspaceId' })
    const payload = {
      workspace_id:     workspaceId,
      days_of_week:     daysOfWeek     || [1,2,3,4,5],
      time_from:        timeFrom        || '09:00',
      time_to:          timeTo          || '17:00',
      duration_minutes: parseInt(durationMinutes, 10) || 60,
      buffer_minutes:   parseInt(bufferMinutes,   10) || 0,
      timezone_offset:  parseInt(timezoneOffset   || 0, 10),
      updated_at:       new Date().toISOString(),
    }
    try {
      // Check if rule already exists; PATCH if so, POST if not
      const existR = await fetch(`${SB_URL}/rest/v1/availability_rules?workspace_id=eq.${workspaceId}&select=id`, { headers: hdrs })
      const existing = await existR.json()
      let r, d
      if (existing.length) {
        r = await fetch(`${SB_URL}/rest/v1/availability_rules?workspace_id=eq.${workspaceId}`, {
          method: 'PATCH',
          headers: { ...hdrs, 'Prefer': 'return=representation' },
          body: JSON.stringify(payload),
        })
      } else {
        r = await fetch(`${SB_URL}/rest/v1/availability_rules`, {
          method: 'POST',
          headers: { ...hdrs, 'Prefer': 'return=representation' },
          body: JSON.stringify(payload),
        })
      }
      d = await r.json()
      if (!r.ok) return res.status(r.status).json({ error: (Array.isArray(d) ? d[0]?.message : d?.message) || 'Save failed' })
      return res.status(200).json(Array.isArray(d) ? d[0] : d)
    } catch (e) { return res.status(500).json({ error: e.message }) }
  }

  return res.status(400).json({ error: 'Unknown action' })
}
