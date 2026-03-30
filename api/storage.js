// /api/storage
// POST action=ensure-bucket  — creates form-assets bucket if missing
// POST action=sign-upload    — returns a signed upload URL for a given path

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const SB_URL = process.env.VITE_SUPABASE_URL
  const SB_KEY = process.env.SUPABASE_SERVICE_KEY
  const hdrs   = { 'Content-Type': 'application/json', 'apikey': SB_KEY, 'Authorization': `Bearer ${SB_KEY}` }

  const action = req.body?.action || 'ensure-bucket'

  // ── ensure-bucket ──────────────────────────────────────────────────────────
  if (action === 'ensure-bucket') {
    try {
      const r = await fetch(`${SB_URL}/storage/v1/bucket`, {
        method: 'POST',
        headers: hdrs,
        body: JSON.stringify({ id: 'form-assets', name: 'form-assets', public: true }),
      })
      const d = await r.json()
      if (!r.ok && !d.message?.toLowerCase().includes('already exist')) {
        return res.status(r.status).json({ error: d.message || 'Failed to create bucket' })
      }
      return res.status(200).json({ ok: true })
    } catch (e) {
      return res.status(500).json({ error: e.message })
    }
  }

  // ── sign-upload ────────────────────────────────────────────────────────────
  // Returns a signed upload URL so the client can PUT the file directly to
  // Supabase Storage without needing storage RLS permissions.
  if (action === 'sign-upload') {
    const { path } = req.body
    if (!path) return res.status(400).json({ error: 'Missing path' })
    try {
      // Ensure bucket exists first
      const br = await fetch(`${SB_URL}/storage/v1/bucket`, {
        method: 'POST',
        headers: hdrs,
        body: JSON.stringify({ id: 'form-assets', name: 'form-assets', public: true }),
      })
      const bd = await br.json()
      if (!br.ok && !bd.message?.toLowerCase().includes('already exist')) {
        return res.status(br.status).json({ error: bd.message || 'Failed to create bucket' })
      }

      // Generate signed upload URL (valid for 60s) — send empty body to satisfy Content-Type: application/json
      const r = await fetch(`${SB_URL}/storage/v1/object/upload/sign/form-assets/${path}`, {
        method: 'POST',
        headers: hdrs,
        body: JSON.stringify({}),
      })
      const d = await r.json()
      if (!r.ok) return res.status(r.status).json({ error: d.message || 'Failed to create signed URL' })
      return res.status(200).json({ signedUrl: `${SB_URL}${d.url}`, token: d.token })
    } catch (e) {
      return res.status(500).json({ error: e.message })
    }
  }

  return res.status(400).json({ error: 'Unknown action' })
}
