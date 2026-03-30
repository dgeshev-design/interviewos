// Consolidated public handler: /api/public?action=get-study|submit

// Compute available slots dynamically from the availability rule,
// subtracting GCal blocks and already-booked sessions.
function computeSlots(rule, gcalBlocks, bookedSlots, bookingConfig) {
  if (!rule) return []
  const { days_of_week, time_from, time_to, duration_minutes, buffer_minutes, timezone_offset } = rule
  const tzOff = parseInt(timezone_offset || 0, 10)
  const dur   = parseInt(duration_minutes, 10) || 60
  const buf   = parseInt(buffer_minutes,   10) || 0
  const step  = dur + buf

  // Convert admin local time → UTC for slot generation
  const [fH, fM] = time_from.split(':').map(Number)
  const [tH, tM] = time_to.split(':').map(Number)
  // Raw UTC minutes (may be negative or >=1440 for cross-midnight timezones)
  const fromUTCRaw = fH * 60 + fM + tzOff
  const toUTCRaw   = tH * 60 + tM + tzOff
  const fromUTCMin = ((fromUTCRaw) % 1440 + 1440) % 1440
  const toUTCMin   = ((toUTCRaw)   % 1440 + 1440) % 1440
  const fromUTCH = Math.floor(fromUTCMin / 60), fromUTCM = fromUTCMin % 60
  const toUTCH   = Math.floor(toUTCMin   / 60), toUTCM   = toUTCMin   % 60

  const now = new Date()
  const cfg = bookingConfig || {}

  // Apply per-study hour override (clamp to rule window)
  let effectiveFromUTCH = fromUTCH, effectiveFromUTCM = fromUTCM
  let effectiveToUTCH   = toUTCH,   effectiveToUTCM   = toUTCM
  let crossMidnightFrom = fromUTCRaw < 0, crossMidnightTo = toUTCRaw >= 1440
  if (cfg.hour_from) {
    const [oH, oM] = cfg.hour_from.split(':').map(Number)
    const oRaw = oH * 60 + oM + tzOff
    const oMin = ((oRaw) % 1440 + 1440) % 1440
    effectiveFromUTCH = Math.floor(oMin / 60); effectiveFromUTCM = oMin % 60
    crossMidnightFrom = oRaw < 0
  }
  if (cfg.hour_to) {
    const [oH, oM] = cfg.hour_to.split(':').map(Number)
    const oRaw = oH * 60 + oM + tzOff
    const oMin = ((oRaw) % 1440 + 1440) % 1440
    effectiveToUTCH = Math.floor(oMin / 60); effectiveToUTCM = oMin % 60
    crossMidnightTo = oRaw >= 1440
  }

  // Determine window based on visibility type (ignore stale date_from/date_to unless visibility==='range')
  const vis = cfg.visibility || 'days'
  const today = new Date(); today.setUTCHours(0, 0, 0, 0)
  let cur = new Date(today)
  let windowEnd

  if (vis === 'today') {
    windowEnd = new Date(today); windowEnd.setUTCHours(23, 59, 59, 999)
  } else if (vis === 'tomorrow') {
    // today + tomorrow — windowStart stays today, windowEnd = end of tomorrow
    windowEnd = new Date(today.getTime() + 86400000); windowEnd.setUTCHours(23, 59, 59, 999)
  } else if (vis === 'range') {
    if (cfg.date_from) { const df = new Date(cfg.date_from + 'T00:00:00Z'); if (df > cur) cur.setTime(df.getTime()) }
    windowEnd = cfg.date_to ? new Date(cfg.date_to + 'T23:59:59Z') : new Date(cur.getTime() + 30 * 86400000)
  } else {
    // 'days' — today counts as day 1, so N days = today through today+(N-1)
    windowEnd = new Date(cur.getTime() + (parseInt(cfg.days_ahead || 30, 10) - 1) * 86400000)
    windowEnd.setUTCHours(23, 59, 59, 999)
  }

  const busy = [...gcalBlocks, ...bookedSlots]
  const slots = []

  while (cur <= windowEnd) {
    // Use local day-of-week (not UTC), since admin configured days in their timezone
    const dayStart = new Date(cur); dayStart.setUTCHours(effectiveFromUTCH, effectiveFromUTCM, 0, 0)
    if (crossMidnightFrom) dayStart.setUTCDate(dayStart.getUTCDate() - 1)
    const dayEnd = new Date(cur); dayEnd.setUTCHours(effectiveToUTCH, effectiveToUTCM, 0, 0)
    if (crossMidnightTo) dayEnd.setUTCDate(dayEnd.getUTCDate() + 1)
    const localDayOfWeek = new Date(dayStart.getTime() - tzOff * 60000).getUTCDay()
    if ((days_of_week || [1,2,3,4,5]).includes(localDayOfWeek)) {
      let s = new Date(dayStart)

      while (s.getTime() + dur * 60000 <= dayEnd.getTime()) {
        const slotEnd = new Date(s.getTime() + dur * 60000)
        if (s >= now) {
          const blocked = busy.some(b => new Date(b.starts_at) < slotEnd && new Date(b.ends_at) > s)
          if (!blocked) {
            slots.push({
              id:               `v_${s.getTime()}`,
              starts_at:        s.toISOString(),
              ends_at:          slotEnd.toISOString(),
              duration_minutes: dur,
              available:        true,
              is_gcal_block:    false,
            })
          }
        }
        s = new Date(s.getTime() + step * 60000)
      }
    }
    cur.setUTCDate(cur.getUTCDate() + 1)
  }
  return slots
}

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

      const [fr, rr] = await Promise.all([
        fetch(`${SB_URL}/rest/v1/forms?study_id=eq.${study.id}&is_active=eq.true&select=*`, { headers: hdrs }),
        fetch(`${SB_URL}/rest/v1/availability_rules?workspace_id=eq.${study.workspace_id}&select=*`, { headers: hdrs }),
      ])
      const forms = await fr.json()
      const rules = await rr.json()
      const rule  = rules[0] || null
      const activeForm    = forms.find(f => f.is_active) || forms[0] || null
      const bookingConfig = activeForm?.booking_config || {}

      // Determine look-ahead window (default 30 days, max 90)
      const daysAhead = parseInt(bookingConfig.days_ahead || 30, 10)
      const now    = new Date().toISOString()
      const future = new Date(Date.now() + daysAhead * 86400000).toISOString()

      // Fetch GCal blocks + booked sessions in window
      const [gcalR, bookedR] = await Promise.all([
        fetch(`${SB_URL}/rest/v1/slots?workspace_id=eq.${study.workspace_id}&is_gcal_block=eq.true&starts_at=gte.${now}&starts_at=lte.${future}&select=starts_at,ends_at`, { headers: hdrs }),
        fetch(`${SB_URL}/rest/v1/slots?workspace_id=eq.${study.workspace_id}&available=eq.false&is_gcal_block=eq.false&starts_at=gte.${now}&starts_at=lte.${future}&select=starts_at,ends_at`, { headers: hdrs }),
      ])
      const gcalBlocks  = await gcalR.json()
      const bookedSlots = await bookedR.json()

      const slots = computeSlots(rule, gcalBlocks, bookedSlots, bookingConfig)
      return res.status(200).json({ study, forms, slots, bookingConfig, ruleDaysOfWeek: rule?.days_of_week || null })
    } catch (e) { return res.status(500).json({ error: e.message }) }
  }

  // ── submit ───────────────────────────────────────────────────────────────
  if (action === 'submit') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
    const { studySlug, formId, answers, startsAt, durationMinutes } = req.body
    if (!studySlug || !answers) return res.status(400).json({ error: 'Missing fields' })
    try {
      const sr = await fetch(`${SB_URL}/rest/v1/studies?slug=eq.${encodeURIComponent(studySlug)}&select=*`, { headers: hdrs })
      const studies = await sr.json()
      if (!studies.length) return res.status(404).json({ error: 'Study not found' })
      const study = studies[0]

      let slot = null
      if (startsAt) {
        const dur    = parseInt(durationMinutes, 10) || 60
        const slotEnd = new Date(new Date(startsAt).getTime() + dur * 60000).toISOString()

        // Check for booking conflicts (race condition guard)
        const conflictR = await fetch(
          `${SB_URL}/rest/v1/slots?workspace_id=eq.${study.workspace_id}&available=eq.false&is_gcal_block=eq.false&starts_at=lt.${slotEnd}&ends_at=gt.${startsAt}&select=id`,
          { headers: hdrs }
        )
        const conflicts = await conflictR.json()
        if (conflicts.length) return res.status(409).json({ error: 'This slot was just booked. Please choose another time.' })

        // Also check GCal blocks
        const gcalConflictR = await fetch(
          `${SB_URL}/rest/v1/slots?workspace_id=eq.${study.workspace_id}&is_gcal_block=eq.true&starts_at=lt.${slotEnd}&ends_at=gt.${startsAt}&select=id`,
          { headers: hdrs }
        )
        const gcalConflicts = await gcalConflictR.json()
        if (gcalConflicts.length) return res.status(409).json({ error: 'This time is no longer available.' })

        // Insert the booked slot
        const slotInsR = await fetch(`${SB_URL}/rest/v1/slots`, {
          method: 'POST',
          headers: { ...hdrs, 'Prefer': 'return=representation' },
          body: JSON.stringify({
            workspace_id:     study.workspace_id,
            study_id:         study.id,
            starts_at:        startsAt,
            ends_at:          slotEnd,
            duration_minutes: dur,
            available:        false,
            is_gcal_block:    false,
            meet_link:        '',
          }),
        })
        const slotData = await slotInsR.json()
        slot = slotData[0] || null
      }

      // Fetch form fields to resolve field IDs → labels/types
      let formFields = []
      if (formId) {
        const fmR = await fetch(`${SB_URL}/rest/v1/forms?id=eq.${formId}&select=fields`, { headers: hdrs })
        const [fm] = await fmR.json()
        formFields = fm?.fields || []
      }
      const byType    = (type)    => { const f = formFields.find(f => f.type === type);                          return f ? (answers[f.id] || '') : '' }
      const byLabel   = (pattern) => { const f = formFields.find(f => f.label?.toLowerCase().includes(pattern)); return f ? (answers[f.id] || '') : '' }
      const byMapping = (key)     => { const f = formFields.find(f => f.participant_field === key);              return f ? (answers[f.id] || '') : '' }
      const name      = byMapping('name')  || byLabel('name')  || Object.values(answers)[0] || 'Unknown'
      const email     = byMapping('email') || byType('email')  || byLabel('email')
      const occupation = byMapping('occupation')
      const location   = byMapping('location')
      const age_group  = byMapping('age_group')
      const rawPhone  = byMapping('phone') || byType('tel')    || byLabel('phone')
      // Phone stored as "ISO|localNumber" (e.g. "GB|07911123456") or legacy "+44|07911123456"
      // Normalize to E.164 using libphonenumber-js, strip leading trunk digit (0) automatically
      let phone = rawPhone
      if (rawPhone?.includes('|')) {
        const [left, num] = rawPhone.split('|')
        try {
          const { parsePhoneNumberWithError, getCountries, getCountryCallingCode } = await import('libphonenumber-js')
          // ISO format: "GB" — use directly. Legacy dial-code format: "+44" — find matching ISO
          let iso = left
          if (left.startsWith('+')) {
            const dc = left.slice(1)
            iso = getCountries().find(c => { try { return String(getCountryCallingCode(c)) === dc } catch { return false } }) || 'GB'
          }
          phone = parsePhoneNumberWithError(num, iso).format('E.164')
        } catch {
          // fallback: dial-code + number, strip leading 0
          const dialCode = left.startsWith('+') ? left : ''
          phone = dialCode + num.replace(/^\s*0/, '').replace(/[\s\-()]/g, '')
        }
      }

      const pr = await fetch(`${SB_URL}/rest/v1/participants`, {
        method: 'POST', headers: { ...hdrs, 'Prefer': 'return=representation' },
        body: JSON.stringify({ workspace_id: study.workspace_id, study_id: study.id, name, email, phone, ...(occupation && { occupation }), ...(location && { location }), ...(age_group && { age_group }), status: 'booked', booked_at: slot?.starts_at || new Date().toISOString(), form_data: answers }),
      })
      const parts = await pr.json()
      const participant = parts[0]
      if (!participant) return res.status(500).json({ error: 'Failed to create participant' })

      // Link participant to slot
      if (slot) {
        await fetch(`${SB_URL}/rest/v1/slots?id=eq.${slot.id}`, {
          method: 'PATCH', headers: hdrs,
          body: JSON.stringify({ participant_id: participant.id }),
        })
      }

      // Try to create Google Calendar event
      let meetLink = ''
      if (slot) {
        try {
          const tokR = await fetch(`${SB_URL}/rest/v1/google_tokens?workspace_id=eq.${study.workspace_id}&select=*`, { headers: hdrs })
          const tokens = await tokR.json()
          if (tokens.length) {
            let { id: tokenId, access_token, refresh_token: rt, expiry } = tokens[0]
            if (expiry && new Date(expiry).getTime() - Date.now() < 300000 && rt) {
              const rr = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID, client_secret: process.env.GOOGLE_CLIENT_SECRET, refresh_token: rt, grant_type: 'refresh_token' }).toString() })
              const refreshed = await rr.json()
              if (!refreshed.error) {
                access_token = refreshed.access_token
                await fetch(`${SB_URL}/rest/v1/google_tokens?id=eq.${tokenId}`, { method: 'PATCH', headers: hdrs, body: JSON.stringify({ access_token, expiry: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(), updated_at: new Date().toISOString() }) })
              }
            }
            const gcalEmail = tokens[0].email
            const start = new Date(slot.starts_at)
            const end   = new Date(start.getTime() + slot.duration_minutes * 60000)
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
              await fetch(`${SB_URL}/rest/v1/participants?id=eq.${participant.id}`, { method: 'PATCH', headers: hdrs, body: JSON.stringify({ meet_link: meetLink }) })
              await fetch(`${SB_URL}/rest/v1/slots?id=eq.${slot.id}`, { method: 'PATCH', headers: hdrs, body: JSON.stringify({ gcal_event_id: gcalEventId, ...(meetLink ? { meet_link: meetLink } : {}) }) })
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
      // Load workspace comms settings once for all template sends
      const wsSettingsR = await fetch(`${SB_URL}/rest/v1/workspace_settings?workspace_id=eq.${study.workspace_id}&select=*`, { headers: hdrs })
      const wsSettingsRows = await wsSettingsR.json()
      const ws = wsSettingsRows?.[0] || {}

      await Promise.allSettled(templates.map(async t => {
        const body = applyVars(t.body); const subject = applyVars(t.subject || '')
        try {
          if (t.channel === 'email' && email) {
            const provider  = ws.email_provider || 'resend'
            const apiKey    = ws.email_api_key    || process.env.RESEND_API_KEY
            const fromEmail = ws.email_from       || process.env.RESEND_FROM_EMAIL
            const fromName  = ws.email_from_name  || ''
            if (apiKey && fromEmail) {
              if (provider === 'sendgrid') {
                await fetch('https://api.sendgrid.com/v3/mail/send', { method: 'POST', headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ personalizations: [{ to: [{ email }] }], from: { email: fromEmail, ...(fromName ? { name: fromName } : {}) }, subject: subject || 'Session confirmed', content: [{ type: 'text/html', value: t.is_html ? body : body.replace(/\n/g,'<br/>') }, ...(!t.is_html ? [{ type: 'text/plain', value: body }] : [])] }) })
              } else {
                await fetch('https://api.resend.com/emails', { method: 'POST', headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: fromEmail, to: [email], subject: subject || 'Session confirmed', ...(t.is_html ? { html: body } : { html: body.replace(/\n/g,'<br/>'), text: body }) }) })
              }
            }
          }
          if ((t.channel === 'sms' || t.channel === 'whatsapp') && phone) {
            const sid = ws.twilio_account_sid || process.env.TWILIO_ACCOUNT_SID
            const tok = ws.twilio_auth_token  || process.env.TWILIO_AUTH_TOKEN
            if (sid && tok) {
              const authHeader = 'Basic ' + Buffer.from(`${sid}:${tok}`).toString('base64')
              if (t.channel === 'sms') {
                const from = ws.twilio_phone_number || process.env.TWILIO_PHONE_NUMBER
                if (from) await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, { method: 'POST', headers: { 'Authorization': authHeader, 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ To: phone, From: from, Body: body }).toString() })
              } else {
                const rawFrom = ws.twilio_whatsapp_number || process.env.TWILIO_WHATSAPP_NUMBER
                if (rawFrom) {
                  const toWA   = phone.startsWith('whatsapp:') ? phone : `whatsapp:${phone}`
                  const fromWA = rawFrom.startsWith('whatsapp:') ? rawFrom : `whatsapp:${rawFrom}`
                  await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, { method: 'POST', headers: { 'Authorization': authHeader, 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ To: toWA, From: fromWA, Body: body }).toString() })
                }
              }
            }
          }
          await fetch(`${SB_URL}/rest/v1/send_log`, { method: 'POST', headers: hdrs, body: JSON.stringify({ workspace_id: study.workspace_id, participant_id: participant.id, template_id: t.id, channel: t.channel, subject, body_preview: body.slice(0,200), status: 'sent' }) })
        } catch {}
      }))

      return res.status(200).json({ success: true, participantId: participant.id })
    } catch (e) { return res.status(500).json({ error: e.message }) }
  }

  // ── get-report ───────────────────────────────────────────────────────────
  if (action === 'get-report') {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
    const token = url.searchParams.get('token')
    if (!token) return res.status(400).json({ error: 'Missing token' })
    try {
      const sr = await fetch(`${SB_URL}/rest/v1/studies?report_token=eq.${encodeURIComponent(token)}&select=*`, { headers: hdrs })
      const studies = await sr.json()
      if (!studies.length) return res.status(404).json({ error: 'Report not found.' })
      const study = studies[0]

      const pr = await fetch(`${SB_URL}/rest/v1/participants?study_id=eq.${study.id}&select=id,name,status,booked_at,summary,quotes,rating,recording_url&order=created_at.asc`, { headers: hdrs })
      const participants = await pr.json()

      return res.status(200).json({ study, participants: participants || [] })
    } catch (e) { return res.status(500).json({ error: e.message }) }
  }

  return res.status(400).json({ error: 'Unknown action' })
}
