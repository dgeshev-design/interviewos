export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const { workspaceId, accessToken, refreshToken, expiresIn, email } = req.body
  if (!workspaceId || !accessToken) return res.status(400).json({ error: 'Missing fields' })

  const URL  = process.env.VITE_SUPABASE_URL
  const KEY  = process.env.SUPABASE_SERVICE_KEY
  const hdrs = {
    'Content-Type':  'application/json',
    'apikey':        KEY,
    'Authorization': `Bearer ${KEY}`,
    'Prefer':        'resolution=merge-duplicates,return=representation',
  }

  try {
    const expiry = expiresIn ? new Date(Date.now() + expiresIn * 1000).toISOString() : null
    const r = await fetch(`${URL}/rest/v1/google_tokens`, {
      method: 'POST', headers: hdrs,
      body: JSON.stringify({ workspace_id: workspaceId, access_token: accessToken, refresh_token: refreshToken || null, expiry, email: email || null, updated_at: new Date().toISOString() }),
    })
    const d = await r.json()
    if (!r.ok) return res.status(r.status).json({ error: d.message })
    return res.status(200).json({ success: true })
  } catch (e) { return res.status(500).json({ error: e.message }) }
}
