export const ORIGINAL_CODE_URL =
  'https://github.com/matthewb62/ContextOfTheCode/tree/2c53c176667d0a966fca8b9247830b1868ec013d'

export function Page({ title, subtitle, children }) {
  return (
    <div className="p-6 md:p-8 max-w-3xl">
      <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
      {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
      <div className="mt-8 space-y-10">{children}</div>
    </div>
  )
}

export function Section({ title, children }) {
  return (
    <section>
      <h2 className="text-lg font-semibold text-slate-800 mb-3">{title}</h2>
      <div className="space-y-3 text-[15px] leading-relaxed text-slate-600">{children}</div>
    </section>
  )
}

export function List({ items }) {
  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3">
          <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-purple-500" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}

export function Code({ children }) {
  return (
    <code className="rounded bg-slate-100 px-1.5 py-0.5 text-[13px] text-slate-700">{children}</code>
  )
}

export function A({ href, children }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="text-purple-600 hover:underline">
      {children}
    </a>
  )
}
