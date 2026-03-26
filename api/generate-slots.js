export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const {
    workspaceId,
    dateFrom,        // "2025-04-01"
    dateTo,          // "2025-04-07"
    timeFrom,        // "10:00"
    timeTo,          // "16:00"
    durationMinutes, // 60
    bufferMinutes,   // 15
    daysOfWeek,      // [1,2,3,4,5] — 0=Sun
  } = req.body

  if (!workspaceId || !dateFrom || !dateTo || !timeFrom || !timeTo || !durationMinutes) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  const SUPABASE_URL = process.env.VITE_SUPABASE_URL
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY
  const headers = {
    'Content-Type':  'application/json',
    'apikey':        SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Prefer':        'return=representation',
  }

  try {
    const slots    = []
    const stepMins = durationMinutes + (bufferMinutes || 0)
    const allowed  = daysOfWeek || [1, 2, 3, 4, 5]

    const current = new Date(`${dateFrom}T00:00:00Z`)
    const end     = new Date(`${dateTo}T23:59:59Z`)

    while (current <= end) {
      const dow = current.getUTCDay()
      if (allowed.includes(dow)) {
        // Generate slots for this day
        const [fromH, fromM] = timeFrom.split(':').map(Number)
        const [toH,   toM  ] = timeTo.split(':').map(Number)

        const dayStart = new Date(current)
        dayStart.setUTCHours(fromH, fromM, 0, 0)

        const dayEnd = new Date(current)
        dayEnd.setUTCHours(toH, toM, 0, 0)

        let slotStart = new Date(dayStart)
        while (slotStart.getTime() + durationMinutes * 60000 <= dayEnd.getTime()) {
          slots.push({
            workspace_id:     workspaceId,
            starts_at:        slotStart.toISOString(),
            duration_minutes: durationMinutes,
            available:        true,
            meet_link:        '',
          })
          slotStart = new Date(slotStart.getTime() + stepMins * 60000)
        }
      }
      current.setUTCDate(current.getUTCDate() + 1)
    }

    if (slots.length === 0) {
      return res.status(200).json({ created: 0, slots: [] })
    }

    // Insert all slots
    const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/slots`, {
      method:  'POST',
      headers,
      body:    JSON.stringify(slots),
    })
    const created = await insertRes.json()
    if (!insertRes.ok) return res.status(insertRes.status).json({ error: created.message || 'Insert failed' })

    // Save the window record
    await fetch(`${SUPABASE_URL}/rest/v1/availability_windows`, {
      method:  'POST',
      headers,
      body: JSON.stringify({
        workspace_id:     workspaceId,
        date_from:        dateFrom,
        date_to:          dateTo,
        time_from:        timeFrom,
        time_to:          timeTo,
        duration_minutes: durationMinutes,
        buffer_minutes:   bufferMinutes || 0,
        days_of_week:     allowed,
      }),
    })

    return res.status(200).json({ created: created.length, slots: created })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
