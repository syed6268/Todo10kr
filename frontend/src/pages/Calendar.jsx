import { useState, useEffect, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../context/AppContext.jsx'
import { completeTodo, uncompleteTodo } from '../api/todos.js'
import { generateSchedule } from '../api/schedule.js'
import {
  disconnect as disconnectGcal,
  fetchTodayEvents,
  pushScheduleToCalendar,
  connectUrl as gcalConnectUrl,
} from '../api/gcal.js'

const HOUR_HEIGHT = 72
const DAY_START = 7
const DAY_END = 21
const HOURS = Array.from({ length: DAY_END - DAY_START }, (_, i) => DAY_START + i)

function parseTimeToMin(t) {
  if (!t) return 0
  const m = String(t).match(/(\d+):(\d+)\s*(AM|PM)/i)
  if (!m) return 0
  let h = parseInt(m[1])
  const min = parseInt(m[2])
  const p = m[3].toUpperCase()
  if (p === 'PM' && h !== 12) h += 12
  if (p === 'AM' && h === 12) h = 0
  return h * 60 + min
}

function slotToPos(slot) {
  const parts = (slot.time || '').split(/[-–]/).map((s) => s.trim())
  const start = parseTimeToMin(parts[0])
  const end = parseTimeToMin(parts[1])
  if (!start || !end || end <= start) return null
  const top = ((start - DAY_START * 60) / 60) * HOUR_HEIGHT
  const height = Math.max(((end - start) / 60) * HOUR_HEIGHT, 28)
  return { top, height }
}

function eventToPos(evt) {
  const start = parseTimeToMin(evt.startTime)
  const end = parseTimeToMin(evt.endTime)
  if (!start || !end || end <= start) return null
  const top = ((start - DAY_START * 60) / 60) * HOUR_HEIGHT
  const height = Math.max(((end - start) / 60) * HOUR_HEIGHT, 28)
  return { top, height }
}

function currentTop() {
  const now = new Date()
  const min = now.getHours() * 60 + now.getMinutes()
  return ((min - DAY_START * 60) / 60) * HOUR_HEIGHT
}

function fmtHour(h) {
  if (h === 0) return '12 AM'
  if (h === 12) return '12 PM'
  return h < 12 ? `${h} AM` : `${h - 12} PM`
}

const slotCfg = {
  dump:      { bg: 'bg-indigo-50',  border: 'border-indigo-500',  text: 'text-indigo-900' },
  suggested: { bg: 'bg-violet-100', border: 'border-violet-500',  text: 'text-violet-900' },
  break:     { bg: 'bg-amber-50',   border: 'border-amber-400',   text: 'text-amber-900'  },
  free:      { bg: 'bg-slate-50',   border: 'border-slate-300',   text: 'text-slate-500'  },
}

export default function Calendar() {
  const {
    calendarEvents, setCalendarEvents,
    schedule, setSchedule,
    summary, setSummary,
    stats, setStats,
    setDeferred, setActiveGoals, setProposals,
    gcalConnected, setGcalConnected,
    useGCal, setUseGCal,
    refreshTodos,
  } = useApp()

  const [loading, setLoading] = useState(false)
  const [pushing, setPushing] = useState(false)
  const [fetching, setFetching] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [nowTop, setNowTop] = useState(currentTop())

  const scrollRef = useRef(null)

  const flash = useCallback((msg, isError = false) => {
    if (isError) setError(msg)
    else setNotice(msg)
    setTimeout(() => { setError(''); setNotice('') }, 3500)
  }, [])

  useEffect(() => {
    const id = setInterval(() => setNowTop(currentTop()), 60_000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = Math.max(0, nowTop - 120)
    }
  }, []) // mount only

  const pullGCal = async () => {
    setFetching(true)
    setError('')
    try {
      const data = await fetchTodayEvents()
      setCalendarEvents(data.events.map((e, i) => ({ ...e, id: e.id || `gcal-${i}` })))
      flash(`Loaded ${data.count} event(s) from Google Calendar`)
    } catch (err) {
      flash(err.message, true)
    } finally {
      setFetching(false)
    }
  }

  const generate = async () => {
    setLoading(true)
    try {
      const data = await generateSchedule({ calendarEvents, useGCal: useGCal && gcalConnected })
      setSchedule((data.schedule || []).map((s, i) => ({ ...s, _uid: s.id || `slot-${Date.now()}-${i}` })))
      setSummary(data.summary || '')
      setStats(data.stats || null)
      setDeferred(data.deferred || [])
      setActiveGoals(data.activeGoals || [])
      setProposals(data.proposals || [])
      if (data.source === 'gcal' && data.calendarEvents) {
        setCalendarEvents(data.calendarEvents.map((e, i) => ({ ...e, id: e.id || `gcal-${i}` })))
      }
      flash('Schedule generated!')
      await refreshTodos()
    } catch (err) {
      flash(err.message, true)
    } finally {
      setLoading(false)
    }
  }

  const pushToGCal = async () => {
    const pushable = schedule.filter(
      (s) => ['dump', 'suggested', 'break'].includes(s.type) && !s.gcalInserted
    )
    if (!pushable.length) { flash('Nothing new to insert'); return }
    setPushing(true)
    try {
      const data = await pushScheduleToCalendar(pushable)
      const successIds = new Set(
        (data.results || []).filter((r) => r.success && r.id).map((r) => r.id)
      )
      setSchedule((prev) =>
        prev.map((s) => (successIds.has(s.id) ? { ...s, gcalInserted: true } : s))
      )
      if (data.needsReconnect && data.inserted === 0) {
        flash('Google denied write access. Disconnect and reconnect.', true)
      } else {
        flash(`Inserted ${data.inserted} event(s) into Google Calendar`)
      }
    } catch (err) {
      flash(err.message, true)
    } finally {
      setPushing(false)
    }
  }

  const toggleDone = async (slot) => {
    if (!slot.todoId) return
    try {
      const fn = slot.completed ? uncompleteTodo : completeTodo
      await fn(slot.todoId)
      setSchedule((prev) =>
        prev.map((s) => (s._uid === slot._uid ? { ...s, completed: !s.completed } : s))
      )
      await refreshTodos()
    } catch (err) {
      flash(err.message, true)
    }
  }

  const today = new Date()
  const dateLabel = today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })

  const pushableCount = schedule.filter(
    (s) => ['dump', 'suggested', 'break'].includes(s.type) && !s.gcalInserted
  ).length

  const completedSlots = schedule.filter((s) => s.completed).length
  const totalSlots = schedule.filter((s) => ['dump', 'suggested'].includes(s.type)).length

  const showNowLine = nowTop >= 0 && nowTop <= HOURS.length * HOUR_HEIGHT

  return (
    <div className="flex h-full flex-col bg-slate-50">
      {/* Top bar */}
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
        <div className="flex items-center gap-4">
          <Link
            to="/"
            className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="Back"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 className="text-lg font-bold text-slate-900">Calendar</h1>
            <p className="text-xs text-slate-500">{dateLabel}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {gcalConnected ? (
            <>
              <span className="hidden sm:flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700 ring-1 ring-emerald-200">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Connected
              </span>
              <button
                onClick={pullGCal}
                disabled={fetching}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
              >
                {fetching ? 'Loading…' : 'Pull events'}
              </button>
              <button
                onClick={async () => { await disconnectGcal(); setGcalConnected(false); flash('Disconnected') }}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-500 transition hover:bg-slate-50"
              >
                Disconnect
              </button>
            </>
          ) : (
            <button
              onClick={() => { window.location.href = gcalConnectUrl }}
              className="flex items-center gap-2 rounded-lg bg-white border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              <svg className="h-3.5 w-3.5 text-slate-500" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/>
              </svg>
              Connect Google Calendar
            </button>
          )}
        </div>
      </div>

      {(error || notice) && (
        <div className={`px-6 py-2 text-sm font-medium ${error ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>
          {error || notice}
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Calendar timeline */}
        <div className="flex flex-1 flex-col overflow-hidden border-r border-slate-200 bg-white">
          <div className="flex items-center gap-4 border-b border-slate-100 px-6 py-2.5">
            <span className="text-xs font-semibold text-slate-500">Day Schedule</span>
            <span className="ml-auto flex items-center gap-1.5 text-[11px] text-slate-500">
              <span className="h-2 w-2 rounded-full bg-blue-500" /> Meetings
            </span>
            <span className="flex items-center gap-1.5 text-[11px] text-slate-500">
              <span className="h-2 w-2 rounded-full bg-violet-500" /> AI Tasks
            </span>
            <span className="flex items-center gap-1.5 text-[11px] text-slate-500">
              <span className="h-2 w-2 rounded-full bg-indigo-500" /> Manual
            </span>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto">
            <div className="relative" style={{ height: HOURS.length * HOUR_HEIGHT + 32 }}>
              {HOURS.map((h, i) => (
                <div
                  key={h}
                  className="absolute left-0 right-0 flex items-start"
                  style={{ top: i * HOUR_HEIGHT }}
                >
                  <span className="w-16 shrink-0 pr-3 pt-1 text-right text-[11px] font-medium text-slate-400">
                    {fmtHour(h)}
                  </span>
                  <div className="flex-1 border-t border-slate-100" />
                </div>
              ))}

              <div className="absolute inset-0 ml-16">
                {/* Calendar events */}
                {calendarEvents.map((evt) => {
                  const pos = eventToPos(evt)
                  if (!pos) return null
                  return (
                    <div
                      key={evt.id}
                      className="absolute left-2 right-2 overflow-hidden rounded-md border-l-[3px] border-blue-500 bg-blue-100 px-2.5 py-1 shadow-sm"
                      style={{ top: pos.top + 1, height: pos.height - 2 }}
                    >
                      <p className="truncate text-xs font-semibold text-blue-900">{evt.title}</p>
                      {pos.height > 36 && (
                        <p className="text-[10px] text-blue-700">{evt.startTime} – {evt.endTime}</p>
                      )}
                    </div>
                  )
                })}

                {/* AI schedule slots */}
                {schedule.map((slot) => {
                  if (slot.type === 'calendar') return null
                  const pos = slotToPos(slot)
                  if (!pos) return null
                  const cfg = slotCfg[slot.type] || slotCfg.dump
                  return (
                    <div
                      key={slot._uid}
                      className={`absolute left-2 right-2 overflow-hidden rounded-md border-l-[3px] px-2.5 py-1 shadow-sm transition-opacity ${cfg.bg} ${cfg.border} ${slot.completed ? 'opacity-50' : ''}`}
                      style={{ top: pos.top + 1, height: pos.height - 2 }}
                    >
                      <div className="flex items-start justify-between gap-1">
                        <div className="min-w-0 flex-1">
                          <p className={`truncate text-xs font-semibold ${cfg.text} ${slot.completed ? 'line-through' : ''}`}>
                            {slot.task}
                          </p>
                          {pos.height > 42 && (
                            <p className={`text-[10px] ${cfg.text} opacity-70`}>{slot.time}</p>
                          )}
                        </div>
                        {slot.todoId && (
                          <button
                            onClick={() => toggleDone(slot)}
                            className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold transition ${slot.completed ? 'bg-emerald-200 text-emerald-800' : 'bg-white/70 text-slate-600 hover:bg-emerald-100 hover:text-emerald-700'}`}
                          >
                            {slot.completed ? '✓' : 'Done'}
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}

                {/* Now line */}
                {showNowLine && (
                  <div className="pointer-events-none absolute left-0 right-0 z-10" style={{ top: nowTop }}>
                    <div className="flex items-center">
                      <span className="h-2.5 w-2.5 rounded-full bg-red-500 shadow-md shadow-red-500/50" />
                      <div className="h-px flex-1 bg-red-400" />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right control panel */}
        <div className="flex w-72 shrink-0 flex-col overflow-y-auto bg-white">
          <div className="border-b border-slate-100 px-5 py-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
              Schedule Intelligence
            </p>
            {stats && (
              <div className="mt-2">
                <p className="text-[11px] text-slate-500">Free time today</p>
                <p className="text-lg font-bold text-indigo-600">
                  {Math.floor((stats.totalFreeMinutes || 0) / 60)}h {(stats.totalFreeMinutes || 0) % 60}m available
                </p>
              </div>
            )}
            <div className="mt-3 flex flex-col gap-2">
              <button
                onClick={generate}
                disabled={loading}
                className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-500/20 transition hover:bg-indigo-700 disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                    Orchestrating…
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Synthesize Schedule
                  </>
                )}
              </button>
              {schedule.length > 0 && (
                <button
                  onClick={pushToGCal}
                  disabled={!gcalConnected || pushing || pushableCount === 0}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  {pushing ? 'Inserting…' : `Push to Calendar (${pushableCount})`}
                </button>
              )}
              <div className="flex items-center gap-2 px-1">
                <input
                  id="use-gcal"
                  type="checkbox"
                  checked={useGCal}
                  onChange={(e) => setUseGCal(e.target.checked)}
                  disabled={!gcalConnected}
                  className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600 disabled:opacity-50"
                />
                <label htmlFor="use-gcal" className={`text-[11px] ${gcalConnected ? 'text-slate-600' : 'text-slate-400'}`}>
                  Use live Google Calendar events
                </label>
              </div>
            </div>
            {summary && (
              <p className="mt-3 rounded-lg bg-indigo-50 px-3 py-2 text-[11px] leading-relaxed text-indigo-700">
                {summary}
              </p>
            )}
          </div>

          {schedule.length > 0 && (
            <div className="border-b border-slate-100 px-5 py-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Today's Progress</p>
              <div className="mt-3 flex gap-4">
                <div>
                  <p className="text-2xl font-bold text-slate-900">{completedSlots}</p>
                  <p className="text-[11px] text-slate-500">Completed</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">{Math.max(0, totalSlots - completedSlots)}</p>
                  <p className="text-[11px] text-slate-500">Remaining</p>
                </div>
              </div>
            </div>
          )}

          <div className="px-5 py-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Calendar Events</p>
            <p className="mt-1 text-[11px] text-slate-500">
              {calendarEvents.length} event{calendarEvents.length !== 1 ? 's' : ''} on the timeline
            </p>
            <div className="mt-3 space-y-1.5">
              {calendarEvents.slice(0, 5).map((e) => (
                <div key={e.id} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                  <p className="truncate text-xs font-semibold text-slate-700">{e.title}</p>
                  <p className="text-[10px] text-slate-500">{e.startTime} – {e.endTime}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
