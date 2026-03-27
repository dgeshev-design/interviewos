// Consolidated comms handler: /api/comms?action=email|sms|whatsapp
import { Resend } from 'resend'

async function sendEmail(to, subject, body, isHtml) {
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.RESEND_FROM_EMAIL,
      to: [to],
      subject: subject || 'Message from InterviewOS',
      ...(isHtml ? { html: body } : { html: body.replace(/\n/g, '<br/>'), text: body }),
    }),
  })
  const d = await r.json()
  if (!r.ok) throw new Error(d.message || 'Resend error')
  return { success: true, id: d.id }
}

async function sendTwilio(to, body, from) {
  const sid = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: { 'Authorization': 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ To: to, From: from, Body: body }).toString(),
  })
  const d = await r.json()
  if (!r.ok) throw new Error(d.message || 'Twilio error')
  return { success: true, sid: d.sid }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const { action, to, subject, body, isHtml } = req.body
  if (!to || !body) return res.status(400).json({ error: 'Missing to or body' })
  try {
    if (action === 'email') return res.status(200).json(await sendEmail(to, subject, body, isHtml))
    if (action === 'sms') return res.status(200).json(await sendTwilio(to, body, process.env.TWILIO_PHONE_NUMBER))
    if (action === 'whatsapp') {
      const toWA = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`
      return res.status(200).json(await sendTwilio(toWA, body, process.env.TWILIO_WHATSAPP_NUMBER))
    }
    return res.status(400).json({ error: 'Unknown action' })
  } catch (e) { return res.status(500).json({ error: e.message }) }
}
