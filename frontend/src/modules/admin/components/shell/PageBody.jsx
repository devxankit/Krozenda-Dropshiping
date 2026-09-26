// The one page container. Every admin and seller screen renders inside this,
// so gutter, vertical rhythm and max width are decided once rather than per
// screen. The gutter tightens on phones, and on very wide monitors content
// stops growing so a table row stays readable edge to edge.
export function PageBody({ children, className = '', width = 'full' }) {
  const widthClass = width === 'narrow' ? 'max-w-5xl' : 'max-w-[100rem]'
  return (
    <div
      className={`mx-auto flex w-full min-w-0 animate-fade-in flex-col gap-2.5 px-3 py-2.5 sm:gap-5 sm:px-6 sm:py-6 print:max-w-none print:animate-none print:gap-0 print:p-0 ${widthClass} ${className}`}
    >
      {children}
    </div>
  )
}
