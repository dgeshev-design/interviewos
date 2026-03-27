export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  const { slug } = req.query
  if (!slug) return res.status(400).json({ error: 'Missing slug' })

  const SB_URL = process.env.VITE_SUPABASE_URL
  const SB_KEY = process.env.SUPABASE_SERVICE_KEY
  const hdrs   = { 'apikey': SB_KEY, 'Authorization': `Bearer ${SB_KEY}` }

  try {
    // Study
    const sr = await fetch(`${SB_URL}/rest/v1/studies?slug=eq.${slug}&status=eq.active&select=*`, { headers: hdrs })
    const studies = await sr.json()
    if (!studies.length) return res.status(404).json({ error: 'Study not found or not active.' })
    const study = studies[0]

    // Active forms for this study
    const fr = await fetch(`${SB_URL}/rest/v1/forms?study_id=eq.${study.id}&is_active=eq.true&select=*`, { headers: hdrs })
    const forms = await fr.json()

    // Available slots (next 30 days)
    const now    = new Date().toISOString()
    const future = new Date(Date.now() + 30 * 86400000).toISOString()
    const slotR  = await fetch(`${SB_URL}/rest/v1/slots?workspace_id=eq.${study.workspace_id}&available=eq.true&is_gcal_block=eq.false&starts_at=gte.${now}&starts_at=lte.${future}&order=starts_at.asc&limit=30`, { headers: hdrs })
    const slots  = await slotR.json()

    return res.status(200).json({ study, forms, slots })
  } catch (e) { return res.status(500).json({ error: e.message }) }
}
