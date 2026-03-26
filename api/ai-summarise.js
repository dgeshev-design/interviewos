export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { questions, participantName } = req.body
  if (!questions?.length) return res.status(400).json({ error: 'Missing questions array' })

  const notesBlock = questions
    .filter(q => q.note?.trim())
    .map(q => `[${q.level}] ${q.body}\n→ ${q.note}`)
    .join('\n\n')

  if (!notesBlock) {
    return res.status(200).json({ text: 'No notes were captured during this session.' })
  }

  const prompt = `You are a senior UX researcher summarising a user interview.

Participant: ${participantName || 'Unknown'}

Interview notes by question:
${notesBlock}

Write a structured session summary with these exact sections:

## Key themes
3-5 bullet points covering the main patterns that emerged.

## Notable moments
2-3 specific things the participant said or expressed that stood out — quote directly from the notes where possible.

## Behavioural insights
What does this tell us about the participant's habits, motivations, or pain points?

## Recommended next steps
2-3 concrete actions for the research team based on this session.

Be specific and grounded in the notes. Avoid generic filler.`

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
        max_tokens: 1000,
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
