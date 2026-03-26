// All calls to /api/* go to Vercel serverless functions
// which hold the secret keys server-side

export async function sendEmail({ to, subject, body }) {
  const res = await fetch('/api/send-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to, subject, body })
  })
  return res.json()
}

export async function sendSMS({ to, body }) {
  const res = await fetch('/api/send-sms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to, body })
  })
  return res.json()
}

export async function sendWhatsApp({ to, body }) {
  const res = await fetch('/api/send-whatsapp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to, body })
  })
  return res.json()
}

export async function aiSuggest({ questionText, notes, participantName }) {
  const res = await fetch('/api/ai-suggest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ questionText, notes, participantName })
  })
  return res.json()
}

export async function aiSummarise({ questions, participantName }) {
  const res = await fetch('/api/ai-summarise', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ questions, participantName })
  })
  return res.json()
}

export async function aiGenerateQuestions({ briefText }) {
  const res = await fetch('/api/ai-generate-questions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ briefText })
  })
  return res.json()
}
