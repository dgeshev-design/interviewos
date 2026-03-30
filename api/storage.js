// /api/storage?action=ensure-bucket
// Creates the form-assets bucket (public) using the service key if it doesn't exist.

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const SB_URL = process.env.VITE_SUPABASE_URL
  const SB_KEY = process.env.SUPABASE_SERVICE_KEY
  const hdrs   = { 'Content-Type': 'application/json', 'apikey': SB_KEY, 'Authorization': `Bearer ${SB_KEY}` }

  try {
    const r = await fetch(`${SB_URL}/storage/v1/bucket`, {
      method: 'POST',
      headers: hdrs,
      body: JSON.stringify({ id: 'form-assets', name: 'form-assets', public: true }),
    })
    const d = await r.json()
    // 200 = created, 409/400 with "already exists" = fine
    if (!r.ok && !d.message?.toLowerCase().includes('already exist')) {
      return res.status(r.status).json({ error: d.message || 'Failed to create bucket' })
    }
    return res.status(200).json({ ok: true })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
