export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { questionText, notes, participantName } = req.body
  if (!questionText) return res.status(400).json({ error: 'Missing questionText' })

  const prompt = `You are assisting a UX researcher conducting a user interview using the Waterfall/Funnel method (L1 vague openers → L2 keyword pivots → L3 A/B scenarios).

Participant: ${participantName || 'unknown'}
Current question asked: "${questionText}"
Notes captured so far:
${notes || 'None yet.'}

Based on the notes, suggest 2-3 sharp, natural follow-up questions the researcher could ask right now. 
- Keep them conversational, not clinical
- Each should dig deeper into something specific mentioned in the notes
- Label each as L2 (explore why) or L3 (compare/contrast) as appropriate
- Be concise — one line per suggestion

Format:
[L2] Question here
[L3] Question here`

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key':         process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Type':      'application/json',
      },
      body: JSON.stringify({
        model:      'claude-sonnet-4-20250514',
        max_tokens: 400,
        messages:   [{ role: 'user', content: prompt }],
      }),
    })

    const data = await response.json()
    if (!response.ok) return res.status(response.status).json({ error: data.error?.message || 'Anthropic error' })

    const text = data.content?.[0]?.text || ''
    return res.status(200).json({ text })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
