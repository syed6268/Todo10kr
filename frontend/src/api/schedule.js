import { apiFetch, API_BASE } from './client.js'

export const generateSchedule = ({ calendarEvents = [], useGCal = false } = {}) =>
  apiFetch('/api/schedule/generate', {
    method: 'POST',
    body: JSON.stringify({ calendarEvents, useGCal }),
  })

export { API_BASE }
