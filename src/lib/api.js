async function post(path, body) {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return res.json()
}

export const sendEmail       = (data) => post('/api/send-email',        data)
export const sendWhatsApp    = (data) => post('/api/send-whatsapp',     data)
export const sendSMS         = (data) => post('/api/send-sms',          data)
export const createCalEvent  = (data) => post('/api/create-calendar-event', data)
export const syncGCal        = (data) => post('/api/sync-gcal',         data)
export const generateSlots   = (data) => post('/api/generate-slots',    data)
export const saveGoogleToken = (data) => post('/api/save-google-token', data)
export const submitPublicForm= (data) => post('/api/submit-form',       data)
