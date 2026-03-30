// Consolidated comms handler: /api/comms?action=email|sms|whatsapp
// Keys are loaded from workspace_settings in DB; falls back to env vars.

const SB_URL = process.env.SUPABASE_URL
const SB_KEY = process.env.SUPABASE_SERVICE_KEY
const hdrs   = { 'apikey': SB_KEY, 'Authorization': `Bearer ${SB_KEY}`, 'Content-Type': 'application/json' }

async function getSettings(workspaceId) {
  if (!workspaceId) return null
  try {
    const r = await fetch(`${SB_URL}/rest/v1/workspace_settings?workspace_id=eq.${workspaceId}&select=*`, { headers: hdrs })
    const rows = await r.json()
    return rows?.[0] || null
  } catch { return null }
}

// ── Email ─────────────────────────────────────────────────────────────────────

async function sendViaResend(to, subject, body, isHtml, apiKey, fromEmail) {
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: fromEmail,
      to: [to],
      subject: subject || 'Message from InterviewOS',
      ...(isHtml ? { html: body } : { html: body.replace(/\n/g, '<br/>'), text: body }),
    }),
  })
  const d = await r.json()
  if (!r.ok) throw new Error(d.message || d.name || 'Resend error')
  return { success: true, id: d.id }
}

async function sendViaSendGrid(to, subject, body, isHtml, apiKey, fromEmail, fromName) {
  const r = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: fromEmail, ...(fromName ? { name: fromName } : {}) },
      subject: subject || 'Message from InterviewOS',
      content: [
        { type: 'text/html', value: isHtml ? body : body.replace(/\n/g, '<br/>') },
        ...(!isHtml ? [{ type: 'text/plain', value: body }] : []),
      ],
    }),
  })
  if (!r.ok) {
    let msg = 'SendGrid error'
    try { const d = await r.json(); msg = d.errors?.[0]?.message || msg } catch {}
    throw new Error(msg)
  }
  return { success: true }
}

async function sendEmail(to, subject, body, isHtml, settings) {
  const provider  = settings?.email_provider || 'resend'
  const apiKey    = settings?.email_api_key    || process.env.RESEND_API_KEY
  const fromEmail = settings?.email_from       || process.env.RESEND_FROM_EMAIL
  const fromName  = settings?.email_from_name  || ''

  if (!apiKey)    throw new Error('No email API key configured. Add one in Settings → Integrations.')
  if (!fromEmail) throw new Error('No sender email configured. Add one in Settings → Integrations.')

  if (provider === 'sendgrid') return sendViaSendGrid(to, subject, body, isHtml, apiKey, fromEmail, fromName)
  return sendViaResend(to, subject, body, isHtml, apiKey, fromEmail)
}

// ── Twilio (SMS + WhatsApp) ───────────────────────────────────────────────────

async function sendTwilio(to, body, from, settings) {
  const sid   = settings?.twilio_account_sid   || process.env.TWILIO_ACCOUNT_SID
  const token = settings?.twilio_auth_token    || process.env.TWILIO_AUTH_TOKEN

  if (!sid || !token) throw new Error('Twilio credentials not configured. Add them in Settings → Integrations.')

  const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ To: to, From: from, Body: body }).toString(),
  })
  const d = await r.json()
  if (!r.ok) throw new Error(d.message || 'Twilio error')
  return { success: true, sid: d.sid }
}

// ── Handler ───────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const { action, to, subject, body, isHtml, workspace_id } = req.body
  if (!to || !body) return res.status(400).json({ error: 'Missing to or body' })

  const settings = await getSettings(workspace_id)

  try {
    if (action === 'email') {
      return res.status(200).json(await sendEmail(to, subject, body, isHtml, settings))
    }

    if (action === 'sms') {
      const from = settings?.twilio_phone_number || process.env.TWILIO_PHONE_NUMBER
      if (!from) throw new Error('Twilio phone number not configured.')
      return res.status(200).json(await sendTwilio(to, body, from, settings))
    }

    if (action === 'whatsapp') {
      const from = settings?.twilio_whatsapp_number || process.env.TWILIO_WHATSAPP_NUMBER
      if (!from) throw new Error('Twilio WhatsApp number not configured.')
      const toWA = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`
      const fromWA = from.startsWith('whatsapp:') ? from : `whatsapp:${from}`
      return res.status(200).json(await sendTwilio(toWA, body, fromWA, settings))
    }

    return res.status(400).json({ error: 'Unknown action' })
  } catch (e) { return res.status(500).json({ error: e.message }) }
}
