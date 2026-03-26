export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { briefText } = req.body
  if (!briefText?.trim()) return res.status(400).json({ error: 'Missing briefText' })

  const prompt = `You are an expert UX researcher. A team has uploaded a research brief and wants you to generate interview questions using the Waterfall/Funnel method.

The Waterfall method has 3 levels:
- L1 (Context): Broad, vague openers that let the participant speak freely without being led. Usually starts with "Walk me through…" or "Tell me about…"
- L2 (Pivot): Targeted follow-ups that explore the "why" behind something. Triggered when the participant mentions a keyword related to the research goals.
- L3 (Bait): Comparative A vs B scenarios used when the participant struggles to articulate a specific preference or dealbreaker.

Research brief:
---
${briefText.slice(0, 4000)}
---

Generate a set of interview questions in this EXACT JSON format. Return ONLY the JSON array, no other text, no markdown backticks:
[
  { "level": "L1", "body": "Question text here" },
  { "level": "L2", "body": "Question text here" },
  { "level": "L3", "body": "Question text here" }
]

Rules:
- Generate 2-3 L1 questions, 3-4 L2 questions, 2-3 L3 questions (8-10 total)
- L1 must be vague and open-ended — never ask about specific features directly
- L2 should reference likely keywords the participant might mention based on the brief
- L3 should present realistic tradeoffs relevant to the research goals
- Questions must feel natural in a conversation, not like a survey`

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
        max_tokens: 1200,
        messages:   [{ role: 'user', content: prompt }],
      }),
    })

    const data = await response.json()
    if (!response.ok) return res.status(response.status).json({ error: data.error?.message || 'Anthropic error' })

    const raw = data.content?.[0]?.text || '[]'

    // Strip any accidental markdown fences
    const clean = raw.replace(/```json|```/g, '').trim()

    let questions
    try {
      questions = JSON.parse(clean)
    } catch {
      return res.status(500).json({ error: 'AI returned malformed JSON. Try again.' })
    }

    // Validate shape
    const valid = questions.filter(q =>
      typeof q.level === 'string' &&
      typeof q.body  === 'string' &&
      ['L1','L2','L3'].includes(q.level)
    )

    return res.status(200).json({ questions: valid })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
