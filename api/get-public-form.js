export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const { formId } = req.query
  if (!formId) return res.status(400).json({ error: 'Missing formId' })

  const SUPABASE_URL = process.env.VITE_SUPABASE_URL
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY

  const headers = {
    'apikey':        SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
  }

  try {
    // Load published form
    const formRes = await fetch(
      `${SUPABASE_URL}/rest/v1/published_forms?id=eq.${formId}&select=*`,
      { headers }
    )
    const forms = await formRes.json()
    if (!forms.length) return res.status(404).json({ error: 'Form not found' })
    const form = forms[0]

    // Load form fields for this workspace
    const fieldsRes = await fetch(
      `${SUPABASE_URL}/rest/v1/form_fields?workspace_id=eq.${form.workspace_id}&order=position.asc`,
      { headers }
    )
    const fields = await fieldsRes.json()

    // Load available slots
    const slotsRes = await fetch(
      `${SUPABASE_URL}/rest/v1/slots?workspace_id=eq.${form.workspace_id}&available=eq.true&starts_at=gte.${new Date().toISOString()}&order=starts_at.asc`,
      { headers }
    )
    const slots = await slotsRes.json()

    return res.status(200).json({ form, fields, slots })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
