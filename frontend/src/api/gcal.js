import { apiFetch, API_BASE } from './client.js'

export const getStatus = () => apiFetch('/api/auth/google/status')
export const disconnect = () =>
  apiFetch('/api/auth/google/disconnect', { method: 'POST' })

export const fetchTodayEvents = () => apiFetch('/api/gcal/events/today')

export const pushScheduleToCalendar = (schedule) =>
  apiFetch('/api/gcal/events/push-schedule', {
    method: 'POST',
    body: JSON.stringify({ schedule }),
  })

export const connectUrl = `${API_BASE}/api/auth/google`
