export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { formId, answers, slotId } = req.body
  if (!formId || !answers) return res.status(400).json({ error: 'Missing formId or answers' })

  const SUPABASE_URL = process.env.VITE_SUPABASE_URL
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY // service key for server-side writes

  const headers = {
    'Content-Type':  'application/json',
    'apikey':        SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
  }

  try {
    // 1. Load the published form to get workspace_id and field definitions
    const formRes = await fetch(
      `${SUPABASE_URL}/rest/v1/published_forms?id=eq.${formId}&select=*`,
      { headers }
    )
    const forms = await formRes.json()
    if (!forms.length) return res.status(404).json({ error: 'Form not found' })
    const form = forms[0]

    // 2. Load slot if provided
    let slot = null
    if (slotId) {
      const slotRes = await fetch(
        `${SUPABASE_URL}/rest/v1/slots?id=eq.${slotId}&select=*`,
        { headers }
      )
      const slots = await slotRes.json()
      slot = slots[0] || null
    }

    // 3. Create participant
    const name  = answers.name  || answers['Full name']  || answers['full name']  || 'Unknown'
    const email = answers.email || answers['Email']       || answers['email']       || ''
    const phone = answers.phone || answers['Phone number']|| answers['phone']       || ''

    const participantRes = await fetch(
      `${SUPABASE_URL}/rest/v1/participants`,
      {
        method: 'POST',
        headers: { ...headers, 'Prefer': 'return=representation' },
        body: JSON.stringify({
          workspace_id: form.workspace_id,
          name,
          email,
          phone,
          status:    slot ? 'booked' : 'booked',
          booked_at: slot ? slot.starts_at : null,
          meet_link: slot?.meet_link || '',
          form_data: answers,
        })
      }
    )
    const participants = await participantRes.json()
    const participant  = participants[0]
    if (!participant) return res.status(500).json({ error: 'Failed to create participant' })

    // 4. Mark slot as taken
    if (slot) {
      await fetch(
        `${SUPABASE_URL}/rest/v1/slots?id=eq.${slotId}`,
        {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ participant_id: participant.id, available: false })
        }
      )
    }

    // 5. Create Google Calendar event with Meet link
    let meetLink = slot?.meet_link || ''
    let calendarEventId = null

    try {
      const calRes = await fetch(`${process.env.VERCEL_URL ? 'https://' + process.env.VERCEL_URL : 'http://localhost:3000'}/api/create-calendar-event`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId:      form.workspace_id,
          participantName:  name,
          participantEmail: email,
          startsAt:         slot?.starts_at,
          durationMinutes:  slot?.duration_minutes || 60,
          title:            `Research Interview — ${name}`,
        }),
      })
      const calData = await calRes.json()
      if (calData.meetLink) {
        meetLink       = calData.meetLink
        calendarEventId = calData.eventId

        // Update slot and participant with real meet link
        await fetch(`${SUPABASE_URL}/rest/v1/slots?id=eq.${slotId}`, {
          method: 'PATCH', headers,
          body: JSON.stringify({ meet_link: meetLink }),
        })
        await fetch(`${SUPABASE_URL}/rest/v1/participants?id=eq.${participant.id}`, {
          method: 'PATCH', headers,
          body: JSON.stringify({ meet_link: meetLink }),
        })
      }
    } catch (calErr) {
      console.warn('Calendar event creation failed:', calErr.message)
      // Non-fatal — continue with booking even if calendar fails
    }

    // 6. Load and fire comms templates for this workspace
    const tmplRes = await fetch(
      `${SUPABASE_URL}/rest/v1/templates?workspace_id=eq.${form.workspace_id}&select=*`,
      { headers }
    )
    const templates = await tmplRes.json()

    // Only fire trigger_offset = 0 (on booking) templates
    const onBooking = templates.filter(t => t.trigger_offset === 0)

    const applyVars = (text) => {
      const dt = slot ? new Date(slot.starts_at) : null
      return text
        .replace(/{{name}}/g,  name)
        .replace(/{{email}}/g, email)
        .replace(/{{phone}}/g, phone)
        .replace(/{{date}}/g,  dt ? dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '')
        .replace(/{{time}}/g,  dt ? dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '')
        .replace(/{{link}}/g,  slot?.meet_link || '')
    }

    const sendResults = await Promise.allSettled(
      onBooking.map(async (t) => {
        const body    = applyVars(t.body)
        const subject = applyVars(t.subject || '')

        if (t.channel === 'email' && email) {
          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
              'Content-Type':  'application/json',
            },
            body: JSON.stringify({
              from:    process.env.RESEND_FROM_EMAIL,
              to:      [email],
              subject: subject || 'Your session is confirmed',
              html:    body.replace(/\n/g, '<br/>'),
              text:    body,
            }),
          })
        }

        if (t.channel === 'sms' && phone) {
          const sid   = process.env.TWILIO_ACCOUNT_SID
          const token = process.env.TWILIO_AUTH_TOKEN
          const params = new URLSearchParams({ To: phone, From: process.env.TWILIO_PHONE_NUMBER, Body: body })
          await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
            method: 'POST',
            headers: {
              'Authorization': 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64'),
              'Content-Type':  'application/x-www-form-urlencoded',
            },
            body: params.toString(),
          })
        }

        if (t.channel === 'whatsapp' && phone) {
          const sid   = process.env.TWILIO_ACCOUNT_SID
          const token = process.env.TWILIO_AUTH_TOKEN
          const to    = phone.startsWith('whatsapp:') ? phone : `whatsapp:${phone}`
          const params = new URLSearchParams({ To: to, From: process.env.TWILIO_WHATSAPP_NUMBER, Body: body })
          await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
            method: 'POST',
            headers: {
              'Authorization': 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64'),
              'Content-Type':  'application/x-www-form-urlencoded',
            },
            body: params.toString(),
          })
        }

        // Log send
        await fetch(`${SUPABASE_URL}/rest/v1/send_log`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            workspace_id:   form.workspace_id,
            template_id:    t.id,
            participant_id: participant.id,
            channel:        t.channel,
            status:         'sent',
          }),
        })
      })
    )

    return res.status(200).json({ success: true, participantId: participant.id })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
