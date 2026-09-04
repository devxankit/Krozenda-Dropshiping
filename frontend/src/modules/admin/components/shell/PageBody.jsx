// The one page container. Every admin screen renders inside this, so gutter,
// vertical rhythm and max width are decided once rather than per screen.
export function PageBody({ children, className = '', width = 'full' }) {
  const widthClass = width === 'narrow' ? 'mx-auto max-w-5xl' : ''
  return (
    <div className={`flex flex-col gap-4 p-5 ${widthClass} ${className}`}>{children}</div>
  )
}
