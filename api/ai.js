// Consolidated AI handler: /api/ai?action=mark-quotes|generate-summary|generate-synthesis
// Accepts ai_settings object in request body (provider, api_key, model)
// Supports: openai, claude, gemini

async function callOpenAI(messages, apiKey, model) {
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: model || 'gpt-4o-mini', messages, temperature: 0.4 }),
  })
  const d = await r.json()
  if (!r.ok) throw new Error(d.error?.message || 'OpenAI error')
  return d.choices[0].message.content
}

async function callClaude(messages, apiKey, model) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: model || 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      messages,
    }),
  })
  const d = await r.json()
  if (!r.ok) throw new Error(d.error?.message || 'Claude error')
  return d.content[0].text
}

async function callGemini(messages, apiKey, model) {
  const modelId = model || 'gemini-1.5-flash'
  // Gemini needs alternating user/model roles; collapse system messages into user
  const contents = messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }))
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents, generationConfig: { temperature: 0.4, maxOutputTokens: 2048 } }),
    }
  )
  const d = await r.json()
  if (!r.ok) throw new Error(d.error?.message || 'Gemini error')
  return d.candidates[0].content.parts[0].text
}

async function callAI(messages, settings) {
  const { provider, api_key, model } = settings
  if (!api_key) throw new Error('No AI API key configured. Add one in Settings → AI.')
  if (provider === 'claude')  return callClaude(messages, api_key, model)
  if (provider === 'gemini')  return callGemini(messages, api_key, model)
  return callOpenAI(messages, api_key, model)
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { action, transcript, quotes, ai_settings } = req.body

  if (!ai_settings?.api_key) {
    return res.status(400).json({ error: 'No AI API key configured. Add one in Settings → AI.' })
  }

  try {
    // ── Mark quotes ────────────────────────────────────────────────────────
    if (action === 'mark-quotes') {
      if (!transcript) return res.status(400).json({ error: 'Missing transcript' })

      const messages = [{
        role: 'user',
        content: `You are a UX research assistant. Extract the 5-10 most insightful, interesting, or surprising quotes from this interview transcript. Return ONLY a valid JSON array of strings, each being a verbatim quote from the transcript. No intro text, no explanation, no markdown — just the JSON array.\n\nTranscript:\n${transcript.slice(0, 12000)}`,
      }]

      const text = await callAI(messages, ai_settings)
      const match = text.match(/\[[\s\S]*\]/)
      if (!match) return res.status(200).json({ quotes: [] })
      const parsed = JSON.parse(match[0])
      return res.status(200).json({ quotes: Array.isArray(parsed) ? parsed : [] })
    }

    // ── Generate participant summary ───────────────────────────────────────
    if (action === 'generate-summary') {
      if (!transcript) return res.status(400).json({ error: 'Missing transcript' })

      const quotesSection = quotes?.length
        ? `\n\nKey quotes already identified:\n${quotes.map(q => `- "${q}"`).join('\n')}`
        : ''

      const messages = [{
        role: 'user',
        content: `You are a UX research assistant. Write a concise 2-4 paragraph summary of this participant interview. Focus on their key needs, pain points, behaviours and attitudes. Be specific and evidence-based.${quotesSection}\n\nTranscript:\n${transcript.slice(0, 12000)}`,
      }]

      const summary = await callAI(messages, ai_settings)
      return res.status(200).json({ summary })
    }

    // ── Generate study synthesis ───────────────────────────────────────────
    if (action === 'generate-synthesis') {
      if (!quotes?.length) return res.status(400).json({ error: 'No quotes to synthesise' })

      const quotesList = quotes
        .map(q => `- "${q.text}"${q.participantName ? ` — ${q.participantName}` : ''}`)
        .join('\n')

      const messages = [{
        role: 'user',
        content: `You are a UX research analyst. Based on the following quotes from multiple participant interviews, write a synthesis that identifies key themes, patterns, pain points and opportunities. Structure it clearly with sections. Be analytical and actionable.\n\nQuotes:\n${quotesList}`,
      }]

      const synthesis = await callAI(messages, ai_settings)
      return res.status(200).json({ synthesis })
    }

    return res.status(400).json({ error: 'Unknown action' })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
