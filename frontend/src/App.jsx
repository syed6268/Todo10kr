import { useState, useEffect, useCallback } from 'react'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5001'

const slotStyles = {
  calendar: 'border-l-sky-500 bg-sky-50',
  dump: 'border-l-indigo-500 bg-slate-50',
  suggested: 'border-l-violet-600 bg-violet-50/50',
  break: 'border-l-amber-400 bg-amber-50',
  free: 'border-l-emerald-400 bg-emerald-50/80 border-dashed',
}

const badgeStyles = {
  calendar: 'bg-sky-500 text-white',
  dump: 'bg-indigo-500 text-white',
  suggested: 'bg-violet-600 text-white',
  break: 'bg-amber-400 text-amber-950',
  free: 'bg-emerald-500 text-white',
}

function withScheduleIds(items) {
  return (items || []).map((slot, i) => ({
    ...slot,
    id: slot.id || `slot-${Date.now()}-${i}`,
  }))
}

function App() {
  const [dumpTodos, setDumpTodos] = useState([])
  const [suggestedTodos, setSuggestedTodos] = useState([])
  const [schedule, setSchedule] = useState([])
  const [summary, setSummary] = useState('')
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(false)
  const [pushingToGCal, setPushingToGCal] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const [gcalConnected, setGcalConnected] = useState(false)
  const [useGCal, setUseGCal] = useState(false)
  const [fetchingEvents, setFetchingEvents] = useState(false)

  const [calendarEvents, setCalendarEvents] = useState([
    { id: 1, title: 'Team standup', startTime: '9:00 AM', endTime: '9:30 AM' },
    { id: 2, title: 'Client meeting', startTime: '2:00 PM', endTime: '3:00 PM' },
  ])
  const [newEvent, setNewEvent] = useState({ title: '', startTime: '', endTime: '' })

  const checkGCalStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/google/status`)
      const data = await res.json()
      setGcalConnected(Boolean(data.connected))
      return Boolean(data.connected)
    } catch {
      return false
    }
  }, [])

  const fetchTodos = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/todos`)
      const data = await res.json()
      setDumpTodos(data.dumpTodos)
      setSuggestedTodos(data.suggestedTodos)
    } catch (err) {
      console.error('Error fetching todos:', err)
      setError('Failed to load todos')
    }
  }, [])

  const fetchGCalEvents = useCallback(async () => {
    setFetchingEvents(true)
    setError('')
    try {
      const res = await fetch(`${API_BASE}/api/gcal/events/today`)
      const data = await res.json()
      if (res.ok) {
        setCalendarEvents(data.events.map((e, i) => ({ ...e, id: e.id || `gcal-${i}` })))
        setNotice(`Loaded ${data.count} event(s) from Google Calendar`)
      } else {
        setError(data.message || data.error || 'Failed to fetch GCal events')
      }
    } catch (err) {
      console.error(err)
      setError('Failed to fetch GCal events')
    } finally {
      setFetchingEvents(false)
    }
  }, [])

  useEffect(() => {
    fetchTodos()
    checkGCalStatus()

    const params = new URLSearchParams(window.location.search)
    if (params.get('gcal') === 'connected') {
      setNotice('Google Calendar connected successfully!')
      window.history.replaceState({}, '', window.location.pathname)
    } else if (params.get('gcal') === 'error') {
      setError('Google Calendar connection failed.')
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [fetchTodos, checkGCalStatus])

  const connectGoogle = () => {
    window.location.href = `${API_BASE}/api/auth/google`
  }

  const disconnectGoogle = async () => {
    await fetch(`${API_BASE}/api/auth/google/disconnect`, { method: 'POST' })
    setGcalConnected(false)
    setUseGCal(false)
    setNotice('Google Calendar disconnected')
  }

  const addCalendarEvent = () => {
    if (newEvent.title && newEvent.startTime && newEvent.endTime) {
      setCalendarEvents([...calendarEvents, { ...newEvent, id: Date.now() }])
      setNewEvent({ title: '', startTime: '', endTime: '' })
    }
  }

  const removeCalendarEvent = (id) => {
    setCalendarEvents(calendarEvents.filter((e) => e.id !== id))
  }

  const generateSmartSchedule = async () => {
    setLoading(true)
    setError('')
    setNotice('')
    try {
      const res = await fetch(`${API_BASE}/api/schedule/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          calendarEvents,
          useGCal: useGCal && gcalConnected,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setSchedule(withScheduleIds(data.schedule))
        setSummary(data.summary || '')
        setStats(data.stats || null)
        if (data.source === 'gcal' && data.calendarEvents) {
          setCalendarEvents(
            data.calendarEvents.map((e, i) => ({ ...e, id: e.id || `gcal-${i}` }))
          )
          setNotice(`Used ${data.calendarEvents.length} live Google Calendar event(s)`)
        }
      } else {
        setError(data.message || data.error || 'Failed to generate schedule')
      }
    } catch (err) {
      console.error('Error generating schedule:', err)
      setError('Failed to generate schedule')
    } finally {
      setLoading(false)
    }
  }

  const clearScheduleSlot = (id) => {
    setSchedule((prev) =>
      prev.map((slot) =>
        slot.id === id
          ? {
              ...slot,
              type: 'free',
              task: 'Free time',
              reason: 'You cleared this task — this slot is available again',
              cleared: true,
              gcalInserted: false,
            }
          : slot
      )
    )
    setNotice('Slot cleared — marked as free time')
  }

  const insertIntoGoogleCalendar = async () => {
    if (!gcalConnected) {
      setError('Connect Google Calendar first')
      return
    }

    const pushable = schedule.filter(
      (s) => ['dump', 'suggested', 'break'].includes(s.type) && !s.gcalInserted
    )

    if (pushable.length === 0) {
      setNotice('No tasks to insert (only new dump/suggested/break slots can be pushed)')
      return
    }

    setPushingToGCal(true)
    setError('')
    try {
      const res = await fetch(`${API_BASE}/api/gcal/events/push-schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schedule: pushable }),
      })
      const data = await res.json()

      if (res.ok) {
        const successIds = new Set(
          (data.results || []).filter((r) => r.success && r.id).map((r) => r.id)
        )
        setSchedule((prev) =>
          prev.map((slot) =>
            successIds.has(slot.id) ? { ...slot, gcalInserted: true } : slot
          )
        )

        if (data.needsReconnect && data.inserted === 0) {
          const firstErr =
            (data.results || []).find((r) => !r.success)?.error || 'permission denied'
          setError(
            `Google denied write access (${firstErr}). Click Disconnect, then Connect Google Calendar again to grant write permission.`
          )
        } else if (data.inserted > 0) {
          setNotice(
            `Inserted ${data.inserted} event(s) into Google Calendar` +
              (data.failed ? ` (${data.failed} failed — check console)` : '')
          )
        } else {
          const firstErr =
            (data.results || []).find((r) => !r.success)?.error || 'no events inserted'
          setError(`Insert failed: ${firstErr}`)
        }
      } else {
        if (data.needsReconnect) {
          setError(
            `Google denied write access (${data.message || data.error}). Click Disconnect, then Connect Google Calendar again to grant write permission.`
          )
        } else {
          setError(data.message || data.error || 'Failed to insert into calendar')
        }
      }
    } catch (err) {
      console.error(err)
      setError('Failed to insert into Google Calendar')
    } finally {
      setPushingToGCal(false)
    }
  }

  const pushableCount = schedule.filter(
    (s) => ['dump', 'suggested', 'break'].includes(s.type) && !s.gcalInserted
  ).length

  const inputClass =
    'w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20'

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-800">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-10 text-center text-white">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Todo10kr v2</h1>
          <p className="mt-2 text-lg text-indigo-100">
            AI-powered Google Calendar integration & intelligent scheduling
          </p>
        </header>

        <main className="flex flex-col gap-6">
          {/* Google Calendar connection */}
          <section className="rounded-2xl bg-white p-6 shadow-xl shadow-black/10 sm:p-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-2xl font-semibold text-indigo-600">Google Calendar</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {gcalConnected
                    ? 'Connected — your real calendar events can be used for scheduling.'
                    : 'Connect to pull your actual events for today.'}
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                {gcalConnected ? (
                  <>
                    <button
                      type="button"
                      onClick={fetchGCalEvents}
                      disabled={fetchingEvents}
                      className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {fetchingEvents ? 'Loading...' : 'Pull today\u2019s events'}
                    </button>
                    <button
                      type="button"
                      onClick={disconnectGoogle}
                      className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                    >
                      Disconnect
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={connectGoogle}
                    className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700"
                  >
                    Connect Google Calendar
                  </button>
                )}
              </div>
            </div>

            <div className="mt-4 flex items-center gap-2 text-sm">
              <input
                id="useGCal"
                type="checkbox"
                checked={useGCal}
                disabled={!gcalConnected}
                onChange={(e) => setUseGCal(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 disabled:opacity-50"
              />
              <label
                htmlFor="useGCal"
                className={gcalConnected ? 'text-slate-700' : 'text-slate-400'}
              >
                When generating, fetch live events from Google Calendar
              </label>
            </div>
          </section>

          {/* Calendar input */}
          <section className="rounded-2xl bg-white p-6 shadow-xl shadow-black/10 sm:p-8">
            <h2 className="text-2xl font-semibold text-indigo-600">Calendar Events</h2>
            <p className="mt-1 text-sm text-slate-500">
              Events used for free-slot detection. Add manual events or pull from Google Calendar.
            </p>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_auto]">
              <input
                type="text"
                className={inputClass}
                placeholder="Event title (e.g., Team meeting)"
                value={newEvent.title}
                onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
              />
              <input
                type="text"
                className={inputClass}
                placeholder="Start (e.g., 9:00 AM)"
                value={newEvent.startTime}
                onChange={(e) => setNewEvent({ ...newEvent, startTime: e.target.value })}
              />
              <input
                type="text"
                className={inputClass}
                placeholder="End (e.g., 10:00 AM)"
                value={newEvent.endTime}
                onChange={(e) => setNewEvent({ ...newEvent, endTime: e.target.value })}
              />
              <button
                type="button"
                onClick={addCalendarEvent}
                className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
              >
                + Add
              </button>
            </div>

            <ul className="mt-4 space-y-2">
              {calendarEvents.length === 0 && (
                <li className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-500">
                  No events yet. Add one or pull from Google Calendar.
                </li>
              )}
              {calendarEvents.map((event) => (
                <li
                  key={event.id}
                  className="flex items-center justify-between rounded-lg border-l-4 border-indigo-500 bg-slate-50 px-4 py-3"
                >
                  <div>
                    <p className="font-semibold text-slate-800">
                      {event.source === 'gcal' && '📅 '}
                      {event.title}
                    </p>
                    <p className="text-sm text-slate-500">
                      {event.startTime} – {event.endTime}
                      {event.source === 'gcal' && (
                        <span className="ml-2 rounded bg-sky-100 px-1.5 py-0.5 text-xs font-medium text-sky-700">
                          gcal
                        </span>
                      )}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeCalendarEvent(event.id)}
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-red-500 text-lg leading-none text-white transition hover:bg-red-600"
                    aria-label="Remove event"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          </section>

          {/* Todos */}
          <div className="grid gap-6 md:grid-cols-2">
            <section className="rounded-2xl bg-white p-6 shadow-xl shadow-black/10 sm:p-8">
              <h2 className="text-xl font-semibold text-slate-800">Dump Todos</h2>
              <p className="mt-1 text-sm text-slate-500">Everyday tasks</p>
              <ul className="mt-4 divide-y divide-slate-100">
                {dumpTodos.map((todo) => (
                  <li
                    key={todo.id}
                    className={`flex items-center justify-between py-3 ${todo.completed ? 'opacity-50' : ''}`}
                  >
                    <span
                      className={`text-slate-700 ${todo.completed ? 'line-through' : 'font-medium'}`}
                    >
                      {todo.title}
                    </span>
                    {todo.completed && (
                      <span className="rounded bg-emerald-500 px-2 py-0.5 text-xs font-medium text-white">
                        done
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </section>

            <section className="rounded-2xl bg-white p-6 shadow-xl shadow-black/10 sm:p-8">
              <h2 className="text-xl font-semibold text-slate-800">Suggested Todos</h2>
              <p className="mt-1 text-sm text-slate-500">Growth & improvement tasks</p>
              <ul className="mt-4 divide-y divide-slate-100">
                {suggestedTodos.map((todo) => (
                  <li key={todo.id} className="py-3">
                    <p className="font-medium text-slate-700">{todo.title}</p>
                    <span className="mt-1 inline-block rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-medium text-indigo-700">
                      {todo.category}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          {/* Schedule */}
          <section className="rounded-2xl bg-white p-6 shadow-xl shadow-black/10 sm:p-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-2xl font-semibold text-indigo-600">AI-Optimized Schedule</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Delete tasks to free slots · Insert the plan into Google Calendar
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={generateSmartSchedule}
                  disabled={loading}
                  className="shrink-0 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/30 transition hover:from-indigo-700 hover:to-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? 'Generating...' : '🤖 Generate'}
                </button>
                {schedule.length > 0 && (
                  <button
                    type="button"
                    onClick={insertIntoGoogleCalendar}
                    disabled={!gcalConnected || pushingToGCal || pushableCount === 0}
                    title={
                      !gcalConnected
                        ? 'Connect Google Calendar first'
                        : pushableCount === 0
                          ? 'All tasks already inserted or none to push'
                          : `Insert ${pushableCount} task(s) into Google Calendar`
                    }
                    className="shrink-0 rounded-lg border-2 border-indigo-600 bg-white px-5 py-3 text-sm font-semibold text-indigo-600 transition hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {pushingToGCal
                      ? 'Inserting...'
                      : `📅 Insert into Calendar (${pushableCount})`}
                  </button>
                )}
              </div>
            </div>

            {error && (
              <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-center text-sm font-medium text-red-600">
                {error}
              </p>
            )}

            {notice && !error && (
              <p className="mt-4 rounded-lg bg-emerald-50 px-4 py-3 text-center text-sm font-medium text-emerald-700">
                {notice}
              </p>
            )}

            {stats && (
              <div className="mt-6 grid grid-cols-2 gap-4 rounded-xl border border-fuchsia-200 bg-gradient-to-br from-fuchsia-50 to-pink-50 p-5 lg:grid-cols-4">
                {[
                  ['Free Slots Found', stats.freeSlots],
                  ['Total Free Time', `${stats.totalFreeMinutes ?? 0} min`],
                  ['Dump Tasks Scheduled', stats.dumpScheduled || 0],
                  ['Growth Tasks Added', stats.suggestedScheduled || 0],
                ].map(([label, value]) => (
                  <div key={label}>
                    <p className="text-xs font-medium text-slate-500">{label}</p>
                    <p className="mt-1 text-2xl font-bold text-indigo-600">{value}</p>
                  </div>
                ))}
              </div>
            )}

            {summary && (
              <div className="mt-6 rounded-lg border-l-4 border-indigo-500 bg-indigo-50/80 px-4 py-3 text-slate-700">
                <strong className="text-indigo-800">AI Summary:</strong> {summary}
              </div>
            )}

            {schedule.length === 0 && !loading && !error && (
              <p className="mt-8 text-center text-sm italic text-slate-400">
                Add calendar events (or pull from Google), then click &quot;Generate Smart
                Schedule&quot;.
              </p>
            )}

            {schedule.length > 0 && (
              <ul className="mt-6 space-y-3">
                {schedule.map((slot) => {
                  const type = slot.type || 'dump'
                  const canClear = ['dump', 'suggested', 'break'].includes(type)
                  return (
                    <li
                      key={slot.id}
                      className={`grid gap-3 rounded-xl border-l-4 p-4 sm:grid-cols-[10rem_1fr_auto] ${slotStyles[type] || slotStyles.dump}`}
                    >
                      <p className="text-sm font-semibold text-slate-600">{slot.time}</p>
                      <div>
                        <p className="font-semibold text-slate-900">
                          {type === 'calendar' && '📅 '}
                          {type === 'free' && '✨ '}
                          {slot.task}
                        </p>
                        {slot.reason && (
                          <p className="mt-1 text-sm text-slate-500">{slot.reason}</p>
                        )}
                        <div className="mt-2 flex flex-wrap gap-2">
                          <span
                            className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${badgeStyles[type] || badgeStyles.dump}`}
                          >
                            {type === 'calendar' ? 'existing event' : type}
                          </span>
                          {slot.gcalInserted && (
                            <span className="inline-block rounded-full bg-sky-100 px-2.5 py-0.5 text-[10px] font-bold text-sky-700">
                              on calendar
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-start justify-end sm:pt-0">
                        {canClear && type !== 'free' && (
                          <button
                            type="button"
                            onClick={() => clearScheduleSlot(slot.id)}
                            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-red-300 hover:bg-red-50 hover:text-red-600"
                            title="Remove task and mark this time as free"
                          >
                            Clear → free
                          </button>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        </main>
      </div>
    </div>
  )
}

export default App
