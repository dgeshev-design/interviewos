export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const { workspaceId, studyId, dateFrom, dateTo, timeFrom, timeTo, durationMinutes, bufferMinutes, daysOfWeek } = req.body
  if (!workspaceId || !dateFrom || !dateTo || !timeFrom || !timeTo) return res.status(400).json({ error: 'Missing fields' })

  const SB_URL = process.env.VITE_SUPABASE_URL
  const SB_KEY = process.env.SUPABASE_SERVICE_KEY
  const hdrs   = { 'Content-Type': 'application/json', 'apikey': SB_KEY, 'Authorization': `Bearer ${SB_KEY}`, 'Prefer': 'return=representation' }

  try {
    const slots    = []
    const stepMins = (durationMinutes || 60) + (bufferMinutes || 0)
    const allowed  = daysOfWeek || [1,2,3,4,5]
    const current  = new Date(`${dateFrom}T00:00:00Z`)
    const end      = new Date(`${dateTo}T23:59:59Z`)

    while (current <= end) {
      const dow = current.getUTCDay()
      if (allowed.includes(dow)) {
        const [fH, fM] = timeFrom.split(':').map(Number)
        const [tH, tM] = timeTo.split(':').map(Number)
        const dayStart = new Date(current); dayStart.setUTCHours(fH, fM, 0, 0)
        const dayEnd   = new Date(current); dayEnd.setUTCHours(tH, tM, 0, 0)
        let slotStart  = new Date(dayStart)
        while (slotStart.getTime() + durationMinutes * 60000 <= dayEnd.getTime()) {
          const slotEnd = new Date(slotStart.getTime() + durationMinutes * 60000)
          slots.push({
            workspace_id:     workspaceId,
            study_id:         studyId || null,
            starts_at:        slotStart.toISOString(),
            ends_at:          slotEnd.toISOString(),
            duration_minutes: durationMinutes,
            available:        true,
            is_gcal_block:    false,
            meet_link:        '',
          })
          slotStart = new Date(slotStart.getTime() + stepMins * 60000)
        }
      }
      current.setUTCDate(current.getUTCDate() + 1)
    }

    if (!slots.length) return res.status(200).json({ created: 0 })

    // Save window record
    await fetch(`${SB_URL}/rest/v1/availability_windows`, {
      method: 'POST', headers: hdrs,
      body: JSON.stringify({ workspace_id: workspaceId, study_id: studyId || null, date_from: dateFrom, date_to: dateTo, time_from: timeFrom, time_to: timeTo, duration_minutes: durationMinutes, buffer_minutes: bufferMinutes || 0, days_of_week: allowed }),
    })

    const ir = await fetch(`${SB_URL}/rest/v1/slots`, { method: 'POST', headers: hdrs, body: JSON.stringify(slots) })
    const created = await ir.json()
    if (!ir.ok) return res.status(ir.status).json({ error: created.message })
    return res.status(200).json({ created: created.length })
  } catch (e) { return res.status(500).json({ error: e.message }) }
}
