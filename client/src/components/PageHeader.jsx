export default function PageHeader({ icon, title, subtitle, action }) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div className="flex items-center gap-3">
        {icon && (
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-brand-600"
            style={{ background: 'rgba(0,212,200,0.08)', border: '1px solid rgba(0,212,200,0.15)' }}>
            {icon}
          </div>
        )}
        <div>
          <h1 className="font-display font-bold text-2xl text-ink-900 leading-none">{title}</h1>
          {subtitle && <p className="text-ink-400 text-sm mt-1">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="flex-shrink-0 flex items-center gap-2">{action}</div>}
    </div>
  )
}
