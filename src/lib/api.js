async function post(path, body) {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return res.json()
}

async function get(path) {
  const res = await fetch(path)
  return res.json()
}

export const sendEmail    = (data) => post('/api/comms', { action: 'email',     ...data })
export const sendWhatsApp = (data) => post('/api/comms', { action: 'whatsapp',  ...data })
export const sendSMS      = (data) => post('/api/comms', { action: 'sms',       ...data })

export const syncGCal        = (data) => post('/api/calendar?action=sync',       data)
export const createCalEvent  = (data) => post('/api/calendar?action=create',     data)
export const cancelCalEvent  = (data) => post('/api/calendar?action=cancel',     data)
export const generateSlots   = (data) => post('/api/calendar?action=generate',   data)
export const saveGoogleToken = (data) => post('/api/calendar?action=save-token', data)

export const getPublicStudy   = (slug) => get(`/api/public?action=get-study&slug=${encodeURIComponent(slug)}`)
export const submitPublicForm = (data) => post('/api/public?action=submit',      data)

export const getAvailabilityRule  = (workspaceId) => get(`/api/calendar?action=get-rule&workspaceId=${workspaceId}`)
export const saveAvailabilityRule = (data)        => post('/api/calendar?action=save-rule', data)

export const callAI = (data) => post('/api/ai', data)
