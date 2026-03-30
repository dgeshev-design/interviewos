// /api/storage
// POST action=upload  — proxies file upload to Supabase using service key (bypasses RLS/CORS)
// POST action=ensure-bucket — creates form-assets bucket if missing

export const config = { api: { bodyParser: { sizeLimit: '10mb' } } }

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
        method: 'POST', headers: hdrs,
        body: JSON.stringify({ id: 'form-assets', name: 'form-assets', public: true }),
      })
      const d = await r.json()
      if (!r.ok && !d.message?.toLowerCase().includes('already exist')) {
        return res.status(r.status).json({ error: d.message || 'Failed to create bucket' })
      }
      return res.status(200).json({ ok: true })
    } catch (e) { return res.status(500).json({ error: e.message }) }
  }

  // ── upload ─────────────────────────────────────────────────────────────────
  // Receives { path, contentType, data (base64) }, uploads via service key.
  if (action === 'upload') {
    const { path, contentType, data } = req.body
    if (!path || !data) return res.status(400).json({ error: 'Missing path or data' })
    try {
      // Ensure bucket exists
      const br = await fetch(`${SB_URL}/storage/v1/bucket`, {
        method: 'POST', headers: hdrs,
        body: JSON.stringify({ id: 'form-assets', name: 'form-assets', public: true }),
      })
      const bd = await br.json()
      if (!br.ok && !bd.message?.toLowerCase().includes('already exist')) {
        return res.status(br.status).json({ error: bd.message || 'Failed to create bucket' })
      }

      // Upload file using service key — bypasses RLS and CORS entirely
      const buffer = Buffer.from(data, 'base64')
      const r = await fetch(`${SB_URL}/storage/v1/object/form-assets/${path}`, {
        method: 'POST',
        headers: { 'apikey': SB_KEY, 'Authorization': `Bearer ${SB_KEY}`, 'Content-Type': contentType || 'application/octet-stream', 'x-upsert': 'true' },
        body: buffer,
      })
      const d = await r.json()
      if (!r.ok) return res.status(r.status).json({ error: d.message || 'Upload failed' })
      const publicUrl = `${SB_URL}/storage/v1/object/public/form-assets/${path}`
      return res.status(200).json({ publicUrl })
    } catch (e) { return res.status(500).json({ error: e.message }) }
  }

  return res.status(400).json({ error: 'Unknown action' })
}
