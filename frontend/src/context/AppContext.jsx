import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { listTodos } from '../api/todos.js'
import { listGoals } from '../api/goals.js'
import { getStatus as getGcalStatus } from '../api/gcal.js'

const AppContext = createContext(null)

function readSession(key, fallback) {
  try {
    const v = sessionStorage.getItem(key)
    return v ? JSON.parse(v) : fallback
  } catch {
    return fallback
  }
}

const DEFAULT_EVENTS = [
  { id: 1, title: 'Team standup', startTime: '9:00 AM', endTime: '9:30 AM' },
  { id: 2, title: 'Client meeting', startTime: '2:00 PM', endTime: '3:00 PM' },
]

export function AppProvider({ children }) {
  const [calendarEvents, _setCalendarEvents] = useState(() =>
    readSession('cal_events', DEFAULT_EVENTS)
  )
  const [schedule, _setSchedule] = useState(() => readSession('schedule', []))
  const [summary, setSummary] = useState(() => readSession('summary', ''))
  const [stats, setStats] = useState(() => readSession('stats', null))
  const [deferred, setDeferred] = useState(() => readSession('deferred', []))
  const [activeGoals, setActiveGoals] = useState([])
  const [proposals, setProposals] = useState([])
  const [dumpTodos, setDumpTodos] = useState([])
  const [suggestedTodos, setSuggestedTodos] = useState([])
  const [goals, setGoals] = useState([])
  const [gcalConnected, setGcalConnected] = useState(false)
  const [useGCal, setUseGCal] = useState(false)

  const setCalendarEvents = useCallback((v) => {
    const next = typeof v === 'function' ? v(readSession('cal_events', DEFAULT_EVENTS)) : v
    sessionStorage.setItem('cal_events', JSON.stringify(next))
    _setCalendarEvents(next)
  }, [])

  const setSchedule = useCallback((v) => {
    const next = typeof v === 'function' ? v(readSession('schedule', [])) : v
    sessionStorage.setItem('schedule', JSON.stringify(next))
    _setSchedule(next)
  }, [])

  useEffect(() => {
    sessionStorage.setItem('summary', JSON.stringify(summary))
  }, [summary])
  useEffect(() => {
    sessionStorage.setItem('stats', JSON.stringify(stats))
  }, [stats])
  useEffect(() => {
    sessionStorage.setItem('deferred', JSON.stringify(deferred))
  }, [deferred])

  const refreshTodos = useCallback(async () => {
    try {
      const data = await listTodos()
      setDumpTodos(data.dumpTodos || [])
      setSuggestedTodos(data.suggestedTodos || [])
    } catch (err) {
      console.error('Failed to fetch todos:', err.message)
    }
  }, [])

  const refreshGoals = useCallback(async () => {
    try {
      const data = await listGoals()
      setGoals(data.goals || [])
    } catch (err) {
      console.error('Failed to fetch goals:', err.message)
    }
  }, [])

  const checkGCal = useCallback(async () => {
    try {
      const data = await getGcalStatus()
      setGcalConnected(Boolean(data.connected))
    } catch {
      setGcalConnected(false)
    }
  }, [])

  useEffect(() => {
    refreshTodos()
    refreshGoals()
    checkGCal()
  }, [refreshTodos, refreshGoals, checkGCal])

  return (
    <AppContext.Provider
      value={{
        calendarEvents, setCalendarEvents,
        schedule, setSchedule,
        summary, setSummary,
        stats, setStats,
        deferred, setDeferred,
        activeGoals, setActiveGoals,
        proposals, setProposals,
        dumpTodos, setDumpTodos,
        suggestedTodos, setSuggestedTodos,
        goals, setGoals,
        gcalConnected, setGcalConnected,
        useGCal, setUseGCal,
        refreshTodos,
        refreshGoals,
        checkGCal,
      }}
    >
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be inside AppProvider')
  return ctx
}
