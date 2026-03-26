export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { to, body } = req.body
  if (!to || !body) return res.status(400).json({ error: 'Missing required fields: to, body' })

  const sid   = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  const from  = process.env.TWILIO_PHONE_NUMBER

  const params = new URLSearchParams({ To: to, From: from, Body: body })

  try {
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64'),
          'Content-Type':  'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      }
    )
    const data = await response.json()
    if (!response.ok) return res.status(response.status).json({ error: data.message || 'Twilio error' })
    return res.status(200).json({ success: true, sid: data.sid })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
