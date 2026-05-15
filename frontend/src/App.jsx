import { useState, useEffect } from 'react'
import './App.css'

function App() {
  const [dumpTodos, setDumpTodos] = useState([])
  const [suggestedTodos, setSuggestedTodos] = useState([])
  const [schedule, setSchedule] = useState([])
  const [summary, setSummary] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

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

  const generateSchedule = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch('http://localhost:5001/api/generate-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const data = await response.json()
      if (response.ok) {
        setSchedule(data.schedule || [])
        setSummary(data.summary || '')
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

  return (
    <div className="app">
      <header className="header">
        <h1>Todo10kr</h1>
        <p>Your agentic todo assistant</p>
      </header>

      <main className="main-content">
        <div className="todos-container">
          <section className="todo-section">
            <h2>Dump Todos</h2>
            <p className="section-desc">Everyday tasks</p>
            <ul className="todo-list">
              {dumpTodos.map((todo) => (
                <li key={todo.id} className={todo.completed ? 'completed' : ''}>
                  <span className="todo-title">{todo.title}</span>
                  {todo.completed && <span className="badge">done</span>}
                </li>
              ))}
            </ul>
          </section>

          <section className="todo-section">
            <h2>Suggested Todos</h2>
            <p className="section-desc">Growth & improvement tasks</p>
            <ul className="todo-list">
              {suggestedTodos.map((todo) => (
                <li key={todo.id}>
                  <div className="todo-content">
                    <span className="todo-title">{todo.title}</span>
                    <span className="category-badge">{todo.category}</span>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <section className="schedule-section">
          <div className="schedule-header">
            <div>
              <h2>Today&apos;s Schedule</h2>
              <p className="section-desc">
                AI-generated plan combining your dump and suggested todos
              </p>
            </div>
            <button
              className="generate-btn"
              onClick={generateSchedule}
              disabled={loading}
            >
              {loading ? 'Generating...' : 'Generate Schedule'}
            </button>
          </div>

          {error && <p className="error">{error}</p>}

          {summary && (
            <div className="summary-box">
              <strong>Summary:</strong> {summary}
            </div>
          )}

          {schedule.length === 0 && !loading && !error && (
            <p className="placeholder">
              Click &quot;Generate Schedule&quot; to plan your day.
            </p>
          )}

          {schedule.length > 0 && (
            <ul className="schedule-list">
              {schedule.map((slot, idx) => (
                <li key={idx} className={`schedule-item type-${slot.type || 'dump'}`}>
                  <div className="slot-time">{slot.time}</div>
                  <div className="slot-body">
                    <div className="slot-task">{slot.task}</div>
                    {slot.reason && (
                      <div className="slot-reason">{slot.reason}</div>
                    )}
                    {slot.type && (
                      <span className={`slot-type-badge type-${slot.type}`}>
                        {slot.type}
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  )
}

export default App
