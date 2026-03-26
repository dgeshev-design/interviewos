export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { workspaceId, accessToken, refreshToken, expiresIn, email } = req.body
  if (!workspaceId || !accessToken) return res.status(400).json({ error: 'Missing fields' })

  const SUPABASE_URL = process.env.VITE_SUPABASE_URL
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY
  const headers = {
    'Content-Type':  'application/json',
    'apikey':        SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Prefer':        'resolution=merge-duplicates,return=representation',
  }

  const expiry = expiresIn
    ? new Date(Date.now() + expiresIn * 1000).toISOString()
    : null

  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/google_tokens`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        workspace_id:  workspaceId,
        access_token:  accessToken,
        refresh_token: refreshToken || null,
        expiry,
        email:         email || null,
        updated_at:    new Date().toISOString(),
      }),
    })
    const data = await r.json()
    if (!r.ok) return res.status(r.status).json({ error: data.message })
    return res.status(200).json({ success: true })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
