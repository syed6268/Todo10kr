import { NavLink } from 'react-router-dom'

const items = [
  { to: '/', label: 'Dashboard', icon: '🗓️', end: true },
  { to: '/goals', label: 'Milestones', icon: '🎯' },
]

export default function MobileNav() {
  return (
    <nav className="sticky top-0 z-30 flex gap-2 border-b border-white/10 bg-slate-950/80 px-3 py-2 text-white backdrop-blur md:hidden">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) =>
            [
              'flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium',
              isActive ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-white/5',
            ].join(' ')
          }
        >
          <span>{item.icon}</span>
          {item.label}
        </NavLink>
      ))}
    </nav>
  )
}
