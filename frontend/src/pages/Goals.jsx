import { useEffect, useState } from 'react'
import {
  listGoals,
  createGoal,
  updateGoal,
  deleteGoal,
  proposeForGoal,
} from '../api/goals.js'

const HORIZON_LABELS = {
  '1week': '1 week',
  '1month': '1 month',
  '3months': '3 months',
  '6months': '6 months',
  '1year': '1 year',
  '5years': '5 years',
}

const HORIZONS = Object.keys(HORIZON_LABELS)

const horizonAccent = {
  '1week': 'bg-sky-100 text-sky-700',
  '1month': 'bg-emerald-100 text-emerald-700',
  '3months': 'bg-amber-100 text-amber-700',
  '6months': 'bg-orange-100 text-orange-700',
  '1year': 'bg-violet-100 text-violet-700',
  '5years': 'bg-fuchsia-100 text-fuchsia-700',
}

const inputClass =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20'

const emptyForm = {
  title: '',
  description: '',
  horizon: '1month',
  priority: 3,
  category: '',
  targetDate: '',
  customInstructions: '',
}

export default function Goals() {
  const [goals, setGoals] = useState([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [form, setForm] = useState(emptyForm)
  const [proposalsByGoal, setProposalsByGoal] = useState({})
  const [proposingId, setProposingId] = useState(null)

  const refresh = async () => {
    setLoading(true)
    setError('')
    try {
      const data = await listGoals()
      setGoals(data.goals || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  const submit = async (e) => {
    e.preventDefault()
    if (!form.title.trim()) {
      setError('Title is required')
      return
    }
    setSaving(true)
    setError('')
    try {
      await createGoal({
        title: form.title.trim(),
        description: form.description.trim(),
        horizon: form.horizon,
        priority: Number(form.priority),
        category: form.category.trim(),
        targetDate: form.targetDate || undefined,
        agentConfig: form.customInstructions.trim()
          ? { customInstructions: form.customInstructions.trim() }
          : undefined,
      })
      setForm(emptyForm)
      setNotice('Milestone added')
      await refresh()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const toggleStatus = async (goal) => {
    const next =
      goal.status === 'active'
        ? 'paused'
        : goal.status === 'paused'
          ? 'active'
          : 'active'
    try {
      await updateGoal(goal._id, { status: next })
      await refresh()
    } catch (err) {
      setError(err.message)
    }
  }

  const remove = async (goal) => {
    if (!confirm(`Delete "${goal.title}"?`)) return
    try {
      await deleteGoal(goal._id)
      await refresh()
    } catch (err) {
      setError(err.message)
    }
  }

  const propose = async (goal) => {
    setProposingId(goal._id)
    setError('')
    try {
      const data = await proposeForGoal(goal._id)
      setProposalsByGoal((prev) => ({ ...prev, [goal._id]: data.proposal }))
    } catch (err) {
      setError(err.message)
    } finally {
      setProposingId(null)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="text-white">
        <h1 className="text-3xl font-bold tracking-tight">Milestones</h1>
        <p className="mt-1 text-sm text-indigo-100">
          Your long-term goals. Each gets its own AI Goal Agent that proposes daily actions.
        </p>
      </header>

      <section className="rounded-2xl bg-white p-6 shadow-xl shadow-black/10">
        <h2 className="text-xl font-semibold text-indigo-600">Add a milestone</h2>
        <p className="mt-1 text-sm text-slate-500">
          Example: <em>&quot;Get into a top-tier incubator&quot;</em> · 6 months · priority 1
        </p>

        <form onSubmit={submit} className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="text-xs font-semibold text-slate-600">Title *</label>
            <input
              type="text"
              className={inputClass}
              placeholder="e.g., Apply to 30 jobs"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </div>

          <div className="sm:col-span-2">
            <label className="text-xs font-semibold text-slate-600">Description</label>
            <textarea
              rows={2}
              className={inputClass}
              placeholder="What does success look like? Why does it matter?"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-600">Horizon *</label>
            <select
              className={inputClass}
              value={form.horizon}
              onChange={(e) => setForm({ ...form, horizon: e.target.value })}
            >
              {HORIZONS.map((h) => (
                <option key={h} value={h}>
                  {HORIZON_LABELS[h]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-600">
              Priority (1 = highest)
            </label>
            <select
              className={inputClass}
              value={form.priority}
              onChange={(e) => setForm({ ...form, priority: e.target.value })}
            >
              {[1, 2, 3, 4, 5].map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-600">Category</label>
            <input
              type="text"
              className={inputClass}
              placeholder="Career, Health, Learning…"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-600">Target date</label>
            <input
              type="date"
              className={inputClass}
              value={form.targetDate}
              onChange={(e) => setForm({ ...form, targetDate: e.target.value })}
            />
          </div>

          <div className="sm:col-span-2">
            <label className="text-xs font-semibold text-slate-600">
              Custom instructions for this goal&apos;s agent
            </label>
            <textarea
              rows={2}
              className={inputClass}
              placeholder="e.g., Bias toward research-heavy companies. Avoid weekends."
              value={form.customInstructions}
              onChange={(e) =>
                setForm({ ...form, customInstructions: e.target.value })
              }
            />
          </div>

          <div className="sm:col-span-2 flex items-center justify-between">
            {error && <span className="text-sm font-medium text-red-600">{error}</span>}
            {notice && !error && (
              <span className="text-sm font-medium text-emerald-600">{notice}</span>
            )}
            <button
              type="submit"
              disabled={saving}
              className="ml-auto rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/30 transition hover:from-indigo-700 hover:to-violet-700 disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Add milestone'}
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-2xl bg-white p-6 shadow-xl shadow-black/10">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-indigo-600">Your milestones</h2>
          <span className="text-xs text-slate-500">{goals.length} total</span>
        </div>

        {loading && <p className="mt-4 text-sm text-slate-500">Loading…</p>}
        {!loading && goals.length === 0 && (
          <p className="mt-4 text-sm italic text-slate-400">
            No milestones yet. Add one above — each spawns its own AI Goal Agent.
          </p>
        )}

        <ul className="mt-4 space-y-4">
          {goals.map((g) => {
            const proposal = proposalsByGoal[g._id]
            return (
              <li
                key={g._id}
                className="rounded-xl border border-slate-200 bg-slate-50/60 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-semibold text-slate-900">{g.title}</h3>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${horizonAccent[g.horizon] || 'bg-slate-200 text-slate-700'}`}
                      >
                        {HORIZON_LABELS[g.horizon] || g.horizon}
                      </span>
                      <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-bold text-slate-700">
                        P{g.priority}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${g.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}
                      >
                        {g.status}
                      </span>
                      {g.category && (
                        <span className="text-[11px] text-slate-500">· {g.category}</span>
                      )}
                    </div>
                    {g.description && (
                      <p className="mt-2 text-sm text-slate-600">{g.description}</p>
                    )}
                    {g.targetDate && (
                      <p className="mt-1 text-xs text-slate-500">
                        Target: {new Date(g.targetDate).toLocaleDateString()}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => propose(g)}
                      disabled={proposingId === g._id}
                      className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"
                    >
                      {proposingId === g._id ? 'Thinking…' : '🤖 Get suggestions'}
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleStatus(g)}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                    >
                      {g.status === 'active' ? 'Pause' : 'Activate'}
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(g)}
                      className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {proposal && (
                  <div className="mt-4 rounded-lg border border-indigo-100 bg-white p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">
                      Agent proposals
                    </p>
                    {proposal.progressReport && (
                      <p className="mt-1 text-sm text-slate-600">
                        {proposal.progressReport}
                      </p>
                    )}
                    <ul className="mt-2 space-y-2">
                      {(proposal.candidates || []).map((c, i) => (
                        <li
                          key={i}
                          className="rounded border border-slate-100 bg-slate-50 px-3 py-2 text-sm"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium text-slate-800">{c.title}</span>
                            <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-700">
                              {c.urgency} urgency
                            </span>
                            <span className="text-[11px] text-slate-500">
                              {c.estimatedMinutes}min · {c.energyCost} energy
                            </span>
                          </div>
                          {c.rationale && (
                            <p className="mt-1 text-xs text-slate-500">{c.rationale}</p>
                          )}
                        </li>
                      ))}
                    </ul>
                    {proposal.questionForUser && (
                      <p className="mt-2 rounded bg-amber-50 px-2 py-1 text-xs italic text-amber-700">
                        💬 {proposal.questionForUser}
                      </p>
                    )}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}
