export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const { studySlug, formId, answers, slotId } = req.body
  if (!studySlug || !answers) return res.status(400).json({ error: 'Missing fields' })

  const SB_URL = process.env.VITE_SUPABASE_URL
  const SB_KEY = process.env.SUPABASE_SERVICE_KEY
  const hdrs   = { 'Content-Type': 'application/json', 'apikey': SB_KEY, 'Authorization': `Bearer ${SB_KEY}`, 'Prefer': 'return=representation' }

  try {
    // 1. Load study
    const sr = await fetch(`${SB_URL}/rest/v1/studies?slug=eq.${studySlug}&select=*`, { headers: hdrs })
    const studies = await sr.json()
    if (!studies.length) return res.status(404).json({ error: 'Study not found' })
    const study = studies[0]

    // 2. Load slot
    let slot = null
    if (slotId) {
      const slotR = await fetch(`${SB_URL}/rest/v1/slots?id=eq.${slotId}&select=*`, { headers: hdrs })
      const slots = await slotR.json()
      slot = slots[0] || null
    }

    // 3. Extract key fields from answers
    const name  = Object.entries(answers).find(([k,v]) => k.toLowerCase().includes('name'))?.[1] || 'Unknown'
    const email = Object.entries(answers).find(([k,v]) => k.toLowerCase().includes('email'))?.[1] || ''
    const phone = Object.entries(answers).find(([k,v]) => k.toLowerCase().includes('phone'))?.[1] || ''

    // 4. Create participant
    const pr = await fetch(`${SB_URL}/rest/v1/participants`, {
      method: 'POST', headers: hdrs,
      body: JSON.stringify({
        workspace_id: study.workspace_id,
        study_id:     study.id,
        name, email, phone,
        status:    'booked',
        booked_at: slot?.starts_at || new Date().toISOString(),
        form_data: answers,
      }),
    })
    const parts = await pr.json()
    const participant = parts[0]
    if (!participant) return res.status(500).json({ error: 'Failed to create participant' })

    // 5. Mark slot as taken
    if (slot) {
      await fetch(`${SB_URL}/rest/v1/slots?id=eq.${slotId}`, {
        method: 'PATCH', headers: hdrs,
        body: JSON.stringify({ available: false, participant_id: participant.id }),
      })
    }

    // 6. Create Google Calendar event + Meet link
    let meetLink = slot?.meet_link || ''
    try {
      const host = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'
      const calR = await fetch(`${host}/api/create-calendar-event`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId: study.workspace_id, participantName: name, participantEmail: email, startsAt: slot?.starts_at, durationMinutes: slot?.duration_minutes || 60, title: `Research Interview — ${name}` }),
      })
      const calData = await calR.json()
      if (calData.meetLink) {
        meetLink = calData.meetLink
        await fetch(`${SB_URL}/rest/v1/participants?id=eq.${participant.id}`, {
          method: 'PATCH', headers: hdrs,
          body: JSON.stringify({ meet_link: meetLink, gcal_event_id: calData.eventId || '' }),
        })
        if (slotId) {
          await fetch(`${SB_URL}/rest/v1/slots?id=eq.${slotId}`, {
            method: 'PATCH', headers: hdrs,
            body: JSON.stringify({ meet_link: meetLink }),
          })
        }
      }
    } catch {}

    // 7. Load and fire booking_confirmed comms templates
    const tmplR = await fetch(`${SB_URL}/rest/v1/templates?workspace_id=eq.${study.workspace_id}&trigger_type=eq.booking_confirmed&is_active=eq.true&select=*`, { headers: hdrs })
    const templates = await tmplR.json()

    const applyVars = (text) => {
      const dt = slot ? new Date(slot.starts_at) : null
      return text
        .replace(/{{name}}/g,  name)
        .replace(/{{email}}/g, email)
        .replace(/{{phone}}/g, phone)
        .replace(/{{study}}/g, study.name)
        .replace(/{{date}}/g,  dt ? dt.toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' }) : '')
        .replace(/{{time}}/g,  dt ? dt.toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' }) : '')
        .replace(/{{link}}/g,  meetLink)
        .replace(/{{prize_code}}/g, '')
    }

    await Promise.allSettled(templates.map(async t => {
      const body    = applyVars(t.body)
      const subject = applyVars(t.subject || '')
      try {
        if (t.channel === 'email' && email) {
          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ from: process.env.RESEND_FROM_EMAIL, to: [email], subject: subject || 'Session confirmed', ...(t.is_html ? { html: body } : { html: body.replace(/\n/g,'<br/>'), text: body }) }),
          })
        }
        if (t.channel === 'whatsapp' && phone) {
          const sid = process.env.TWILIO_ACCOUNT_SID, token = process.env.TWILIO_AUTH_TOKEN
          const toWA = phone.startsWith('whatsapp:') ? phone : `whatsapp:${phone}`
          await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
            method: 'POST',
            headers: { 'Authorization': 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ To: toWA, From: process.env.TWILIO_WHATSAPP_NUMBER, Body: body }).toString(),
          })
        }
        await fetch(`${SB_URL}/rest/v1/send_log`, {
          method: 'POST', headers: hdrs,
          body: JSON.stringify({ workspace_id: study.workspace_id, participant_id: participant.id, template_id: t.id, channel: t.channel, subject, body_preview: body.slice(0,200), status: 'sent' }),
        })
      } catch {}
    }))

    return res.status(200).json({ success: true, participantId: participant.id })
  } catch (e) { return res.status(500).json({ error: e.message }) }
}
