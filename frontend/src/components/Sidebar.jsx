import { NavLink } from 'react-router-dom'

const items = [
  { to: '/', label: 'Dashboard', icon: '🗓️', end: true },
  { to: '/goals', label: 'Milestones', icon: '🎯' },
]

export default function Sidebar() {
  return (
    <aside className="hidden w-64 shrink-0 flex-col gap-1 border-r border-white/10 bg-slate-950/60 px-4 py-6 text-white backdrop-blur md:flex">
      <div className="mb-6 px-2">
        <h1 className="text-2xl font-bold tracking-tight">Todo10kr</h1>
        <p className="text-xs text-slate-400">Agentic productivity OS</p>
      </div>
      <nav className="flex flex-col gap-1">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              [
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition',
                isActive
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30'
                  : 'text-slate-300 hover:bg-white/5 hover:text-white',
              ].join(' ')
            }
          >
            <span className="text-base">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="mt-auto px-2 pt-6 text-[11px] text-slate-500">
        Multi-agent scheduling · MongoDB · OpenAI
      </div>
    </aside>
  )
}
