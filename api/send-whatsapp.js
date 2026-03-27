export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const { to, body } = req.body
  if (!to || !body) return res.status(400).json({ error: 'Missing to or body' })
  const sid = process.env.TWILIO_ACCOUNT_SID, token = process.env.TWILIO_AUTH_TOKEN
  const toFormatted = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`
  try {
    const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: { 'Authorization': 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ To: toFormatted, From: process.env.TWILIO_WHATSAPP_NUMBER, Body: body }).toString(),
    })
    const d = await r.json()
    if (!r.ok) return res.status(r.status).json({ error: d.message })
    return res.status(200).json({ success: true, sid: d.sid })
  } catch (e) { return res.status(500).json({ error: e.message }) }
}
