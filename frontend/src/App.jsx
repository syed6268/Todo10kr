import { useState, useEffect } from 'react'

const slotStyles = {
  calendar: 'border-l-sky-500 bg-sky-50',
  dump: 'border-l-indigo-500 bg-slate-50',
  suggested: 'border-l-violet-600 bg-violet-50/50',
  break: 'border-l-amber-400 bg-amber-50',
}

const badgeStyles = {
  calendar: 'bg-sky-500 text-white',
  dump: 'bg-indigo-500 text-white',
  suggested: 'bg-violet-600 text-white',
  break: 'bg-amber-400 text-amber-950',
}

function App() {
  const [dumpTodos, setDumpTodos] = useState([])
  const [suggestedTodos, setSuggestedTodos] = useState([])
  const [schedule, setSchedule] = useState([])
  const [summary, setSummary] = useState('')
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [calendarEvents, setCalendarEvents] = useState([
    { id: 1, title: 'Team standup', startTime: '9:00 AM', endTime: '9:30 AM' },
    { id: 2, title: 'Client meeting', startTime: '2:00 PM', endTime: '3:00 PM' },
  ])
  const [newEvent, setNewEvent] = useState({ title: '', startTime: '', endTime: '' })

  useEffect(() => {
    fetchTodos()
  }, [])

  const fetchTodos = async () => {
    try {
      const response = await fetch('http://localhost:5001/api/todos')
      const data = await response.json()
      setDumpTodos(data.dumpTodos)
      setSuggestedTodos(data.suggestedTodos)
    } catch (err) {
      console.error('Error fetching todos:', err)
      setError('Failed to load todos')
    }
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
    try {
      const response = await fetch('http://localhost:5001/api/generate-schedule-v2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ calendarEvents }),
      })
      const data = await response.json()
      if (response.ok) {
        setSchedule(data.schedule || [])
        setSummary(data.summary || '')
        setStats(data.stats || null)
      } else {
        setError(data.message || 'Failed to generate schedule')
      }
    } catch (err) {
      console.error('Error generating schedule:', err)
      setError('Failed to generate schedule')
    } finally {
      setLoading(false)
    }
  }

  const inputClass =
    'w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20'

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-800">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-10 text-center text-white">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Todo10kr v2</h1>
          <p className="mt-2 text-lg text-indigo-100">
            AI-powered calendar integration & intelligent scheduling
          </p>
        </header>

        <main className="flex flex-col gap-6">
          <section className="rounded-2xl bg-white p-6 shadow-xl shadow-black/10 sm:p-8">
            <h2 className="text-2xl font-semibold text-indigo-600">Your Calendar Events</h2>
            <p className="mt-1 text-sm text-slate-500">
              Add your existing calendar events so AI can fill the gaps
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
                className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
              >
                + Add
              </button>
            </div>

            <ul className="mt-4 space-y-2">
              {calendarEvents.map((event) => (
                <li
                  key={event.id}
                  className="flex items-center justify-between rounded-lg border-l-4 border-indigo-500 bg-slate-50 px-4 py-3"
                >
                  <div>
                    <p className="font-semibold text-slate-800">{event.title}</p>
                    <p className="text-sm text-slate-500">
                      {event.startTime} – {event.endTime}
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

          <section className="rounded-2xl bg-white p-6 shadow-xl shadow-black/10 sm:p-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-2xl font-semibold text-indigo-600">AI-Optimized Schedule</h2>
                <p className="mt-1 text-sm text-slate-500">
                  AI fills your free slots with the perfect tasks
                </p>
              </div>
              <button
                type="button"
                onClick={generateSmartSchedule}
                disabled={loading}
                className="shrink-0 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/30 transition hover:from-indigo-700 hover:to-violet-700 hover:shadow-indigo-500/40 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? 'Generating...' : '🤖 Generate Smart Schedule'}
              </button>
            </div>

            {error && (
              <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-center text-sm font-medium text-red-600">
                {error}
              </p>
            )}

            {stats && (
              <div className="mt-6 grid grid-cols-2 gap-4 rounded-xl border border-fuchsia-200 bg-gradient-to-br from-fuchsia-50 to-pink-50 p-5 lg:grid-cols-4">
                {[
                  ['Free Slots Found', stats.freeSlots],
                  ['Total Free Time', `${stats.totalFreeMinutes} min`],
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
                Add your calendar events above, then click &quot;Generate Smart Schedule&quot; to
                let AI optimize your day.
              </p>
            )}

            {schedule.length > 0 && (
              <ul className="mt-6 space-y-3">
                {schedule.map((slot, idx) => {
                  const type = slot.type || 'dump'
                  return (
                    <li
                      key={idx}
                      className={`grid gap-3 rounded-xl border-l-4 p-4 sm:grid-cols-[10rem_1fr] ${slotStyles[type] || slotStyles.dump}`}
                    >
                      <p className="text-sm font-semibold text-slate-600">{slot.time}</p>
                      <div>
                        <p className="font-semibold text-slate-900">
                          {slot.type === 'calendar' && '📅 '}
                          {slot.task}
                        </p>
                        {slot.reason && (
                          <p className="mt-1 text-sm text-slate-500">{slot.reason}</p>
                        )}
                        <span
                          className={`mt-2 inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${badgeStyles[type] || badgeStyles.dump}`}
                        >
                          {type === 'calendar' ? 'existing event' : type}
                        </span>
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
