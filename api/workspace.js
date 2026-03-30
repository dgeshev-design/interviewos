// GET /api/workspace?domain=hostname
// Resolves a hostname → workspace using the service key (bypasses RLS)

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const SB_URL = process.env.VITE_SUPABASE_URL
  const SB_KEY = process.env.SUPABASE_SERVICE_KEY
  const hdrs   = { 'Content-Type': 'application/json', 'apikey': SB_KEY, 'Authorization': `Bearer ${SB_KEY}` }

  const url    = new URL(req.url, 'http://localhost')
  const domain = url.searchParams.get('domain')
  if (!domain) return res.status(400).json({ error: 'Missing domain' })

  try {
    // Look up domain
    const dr = await fetch(
      `${SB_URL}/rest/v1/workspace_domains?domain=eq.${encodeURIComponent(domain)}&select=*`,
      { headers: hdrs }
    )
    const rows = await dr.json()
    if (!rows.length) return res.status(404).json({ error: 'Domain not found' })
    const { workspace_id, is_master } = rows[0]

    // Fetch workspace
    const wr = await fetch(
      `${SB_URL}/rest/v1/workspaces?id=eq.${workspace_id}&select=*`,
      { headers: hdrs }
    )
    const workspaces = await wr.json()
    if (!workspaces.length) return res.status(404).json({ error: 'Workspace not found' })

    return res.status(200).json({ workspace: workspaces[0], is_master: !!is_master })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
