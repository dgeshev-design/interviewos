export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { to, subject, body } = req.body
  if (!to || !body) return res.status(400).json({ error: 'Missing required fields: to, body' })

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL,
        to:   [to],
        subject: subject || 'Message from InterviewOS',
        html: body.replace(/\n/g, '<br/>'),
        text: body,
      }),
    })

    const data = await response.json()
    if (!response.ok) return res.status(response.status).json({ error: data.message || 'Resend error' })
    return res.status(200).json({ success: true, id: data.id })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
