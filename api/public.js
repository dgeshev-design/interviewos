// Consolidated public handler: /api/public?action=get-study|submit

export default async function handler(req, res) {
  const SB_URL = process.env.VITE_SUPABASE_URL
  const SB_KEY = process.env.SUPABASE_SERVICE_KEY
  const hdrs   = { 'Content-Type': 'application/json', 'apikey': SB_KEY, 'Authorization': `Bearer ${SB_KEY}` }

  const url    = new URL(req.url, 'http://localhost')
  const action = url.searchParams.get('action') || req.query?.action

  // ── get-study ────────────────────────────────────────────────────────────
  if (action === 'get-study') {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
    const slug = url.searchParams.get('slug') || req.query?.slug
    if (!slug) return res.status(400).json({ error: 'Missing slug' })
    try {
      const sr = await fetch(`${SB_URL}/rest/v1/studies?slug=eq.${encodeURIComponent(slug)}&status=eq.active&select=*`, { headers: hdrs })
      const studies = await sr.json()
      if (!studies.length) return res.status(404).json({ error: 'Study not found or not active.' })
      const study = studies[0]
      const fr = await fetch(`${SB_URL}/rest/v1/forms?study_id=eq.${study.id}&is_active=eq.true&select=*`, { headers: hdrs })
      const forms = await fr.json()
      const now = new Date().toISOString()
      const future = new Date(Date.now() + 30 * 86400000).toISOString()
      const slotR = await fetch(`${SB_URL}/rest/v1/slots?workspace_id=eq.${study.workspace_id}&available=eq.true&is_gcal_block=eq.false&starts_at=gte.${now}&starts_at=lte.${future}&order=starts_at.asc&limit=30`, { headers: hdrs })
      const slots = await slotR.json()
      return res.status(200).json({ study, forms, slots })
    } catch (e) { return res.status(500).json({ error: e.message }) }
  }

  // ── submit ───────────────────────────────────────────────────────────────
  if (action === 'submit') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
    const { studySlug, formId, answers, slotId } = req.body
    if (!studySlug || !answers) return res.status(400).json({ error: 'Missing fields' })
    try {
      const sr = await fetch(`${SB_URL}/rest/v1/studies?slug=eq.${encodeURIComponent(studySlug)}&select=*`, { headers: hdrs })
      const studies = await sr.json()
      if (!studies.length) return res.status(404).json({ error: 'Study not found' })
      const study = studies[0]

      let slot = null
      if (slotId) {
        const slotR = await fetch(`${SB_URL}/rest/v1/slots?id=eq.${slotId}&select=*`, { headers: hdrs })
        const slots = await slotR.json()
        slot = slots[0] || null
      }

      // Fetch form fields to resolve field IDs → labels/types
      let formFields = []
      if (formId) {
        const fmR = await fetch(`${SB_URL}/rest/v1/forms?id=eq.${formId}&select=fields`, { headers: hdrs })
        const [fm] = await fmR.json()
        formFields = fm?.fields || []
      }
      const byType  = (type)    => { const f = formFields.find(f => f.type === type);                           return f ? (answers[f.id] || '') : '' }
      const byLabel = (pattern) => { const f = formFields.find(f => f.label?.toLowerCase().includes(pattern));  return f ? (answers[f.id] || '') : '' }
      const name  = byLabel('name')  || Object.values(answers)[0] || 'Unknown'
      const email = byType('email')  || byLabel('email')
      const phone = byType('tel')    || byLabel('phone')

      const pr = await fetch(`${SB_URL}/rest/v1/participants`, {
        method: 'POST', headers: { ...hdrs, 'Prefer': 'return=representation' },
        body: JSON.stringify({ workspace_id: study.workspace_id, study_id: study.id, name, email, phone, status: 'booked', booked_at: slot?.starts_at || new Date().toISOString(), form_data: answers }),
      })
      const parts = await pr.json()
      const participant = parts[0]
      if (!participant) return res.status(500).json({ error: 'Failed to create participant' })

      if (slot) {
        await fetch(`${SB_URL}/rest/v1/slots?id=eq.${slotId}`, { method: 'PATCH', headers: hdrs, body: JSON.stringify({ available: false, participant_id: participant.id }) })
      }

      // Try to create calendar event + get meet link (inline — no self-referencing HTTP)
      let meetLink = ''
      if (slot) {
        try {
          // Fetch google token
          const tokR = await fetch(`${SB_URL}/rest/v1/google_tokens?workspace_id=eq.${study.workspace_id}&select=*`, { headers: hdrs })
          const tokens = await tokR.json()
          if (tokens.length) {
            let { access_token, refresh_token: rt, expiry } = tokens[0]
            if (expiry && new Date(expiry).getTime() - Date.now() < 300000 && rt) {
              const rr = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID, client_secret: process.env.GOOGLE_CLIENT_SECRET, refresh_token: rt, grant_type: 'refresh_token' }).toString() })
              const refreshed = await rr.json()
              if (!refreshed.error) {
                access_token = refreshed.access_token
                await fetch(`${SB_URL}/rest/v1/google_tokens?workspace_id=eq.${study.workspace_id}`, { method: 'PATCH', headers: hdrs, body: JSON.stringify({ access_token, expiry: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(), updated_at: new Date().toISOString() }) })
              }
            }
            const gcalEmail = tokens[0].email
            const start = new Date(slot.starts_at)
            const end   = new Date(start.getTime() + (slot.duration_minutes || 60) * 60000)
            const attendees = [{ email: gcalEmail }]
            if (email) attendees.push({ email, displayName: name })
            const cr = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1&sendUpdates=all', {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${access_token}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ summary: `Research Interview — ${name}`, description: `InterviewOS session\nParticipant: ${name}\nEmail: ${email}`, start: { dateTime: start.toISOString(), timeZone: 'UTC' }, end: { dateTime: end.toISOString(), timeZone: 'UTC' }, attendees, conferenceData: { createRequest: { requestId: `ios-${Date.now()}`, conferenceSolutionKey: { type: 'hangoutsMeet' } } }, reminders: { useDefault: false, overrides: [{ method: 'email', minutes: 1440 }, { method: 'popup', minutes: 30 }] } }),
            })
            const calData = await cr.json()
            if (cr.ok) {
              meetLink = calData.conferenceData?.entryPoints?.find(e => e.entryPointType === 'video')?.uri || ''
              const gcalEventId = calData.id || ''
              const slotPatch = { gcal_event_id: gcalEventId }
              if (meetLink) slotPatch.meet_link = meetLink
              await fetch(`${SB_URL}/rest/v1/participants?id=eq.${participant.id}`, { method: 'PATCH', headers: hdrs, body: JSON.stringify({ meet_link: meetLink }) })
              await fetch(`${SB_URL}/rest/v1/slots?id=eq.${slotId}`, { method: 'PATCH', headers: hdrs, body: JSON.stringify(slotPatch) })
            }
          }
        } catch {}
      }

      // Fire booking_confirmed templates
      const tmplR = await fetch(`${SB_URL}/rest/v1/templates?workspace_id=eq.${study.workspace_id}&trigger_type=eq.booking_confirmed&is_active=eq.true`, { headers: hdrs })
      const templates = await tmplR.json()
      const applyVars = (text) => {
        const dt = slot ? new Date(slot.starts_at) : null
        return text.replace(/{{name}}/g, name).replace(/{{email}}/g, email).replace(/{{phone}}/g, phone).replace(/{{study}}/g, study.name).replace(/{{date}}/g, dt ? dt.toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' }) : '').replace(/{{time}}/g, dt ? dt.toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' }) : '').replace(/{{link}}/g, meetLink).replace(/{{prize_code}}/g, '')
      }
      await Promise.allSettled(templates.map(async t => {
        const body = applyVars(t.body); const subject = applyVars(t.subject || '')
        try {
          if (t.channel === 'email' && email) {
            await fetch('https://api.resend.com/emails', { method: 'POST', headers: { 'Authorization': `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: process.env.RESEND_FROM_EMAIL, to: [email], subject: subject || 'Session confirmed', ...(t.is_html ? { html: body } : { html: body.replace(/\n/g,'<br/>'), text: body }) }) })
          }
          if (t.channel === 'whatsapp' && phone) {
            const sid = process.env.TWILIO_ACCOUNT_SID, token = process.env.TWILIO_AUTH_TOKEN
            const toWA = phone.startsWith('whatsapp:') ? phone : `whatsapp:${phone}`
            await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, { method: 'POST', headers: { 'Authorization': 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ To: toWA, From: process.env.TWILIO_WHATSAPP_NUMBER, Body: body }).toString() })
          }
          await fetch(`${SB_URL}/rest/v1/send_log`, { method: 'POST', headers: hdrs, body: JSON.stringify({ workspace_id: study.workspace_id, participant_id: participant.id, template_id: t.id, channel: t.channel, subject, body_preview: body.slice(0,200), status: 'sent' }) })
        } catch {}
      }))

      return res.status(200).json({ success: true, participantId: participant.id })
    } catch (e) { return res.status(500).json({ error: e.message }) }
  }

  return res.status(400).json({ error: 'Unknown action' })
}
