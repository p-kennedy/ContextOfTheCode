import { NavLink } from 'react-router-dom'
import { ORIGINAL_CODE_URL } from './Prose'

const icon = d => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d={d} />
  </svg>
)

const links = [
  {
    to: '/',
    label: 'Dashboard',
    icon: icon('M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z'),
  },
  {
    to: '/about',
    label: 'About the project',
    icon: icon('M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z'),
  },
  {
    to: '/how-it-went',
    label: 'How it went',
    icon: icon('M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z'),
  },
]

export default function Sidebar() {
  return (
    <aside className="md:w-60 flex-shrink-0 bg-slate-900 flex flex-col">
      <div className="px-6 py-5 border-b border-slate-700">
        <span className="text-white font-semibold text-lg tracking-tight">MetricsFlow</span>
        <p className="text-slate-400 text-xs mt-0.5">Context of the Code · 2026</p>
      </div>

      <nav className="flex md:flex-col gap-1 px-3 py-3 md:py-4 md:flex-1 overflow-x-auto">
        {links.map(({ to, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            end
            className={({ isActive }) =>
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ' +
              (isActive ? 'bg-purple-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white')
            }
          >
            {icon}
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="hidden md:block px-6 py-4 border-t border-slate-700 space-y-1">
        <a href={ORIGINAL_CODE_URL} target="_blank" rel="noreferrer" className="block text-slate-400 hover:text-white text-xs">
          Original source code ↗
        </a>
        <p className="text-slate-500 text-xs">Data: Fortnite Ecosystem API</p>
      </div>
    </aside>
  )
}
