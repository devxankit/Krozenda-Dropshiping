import React from 'react'

/**
 * Modern AI Assistant Icon:
 * Sleek futuristic robot chatbot vector with glowing cyan visor eyes, antenna signal,
 * friendly expression, and golden AI accent sparkle.
 */
export function AiSparkIcon({ className = '', accent = '#38BDF8', title, ...rest }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : 'true'}
      focusable="false"
      xmlns="http://www.w3.org/2000/svg"
      {...rest}
    >
      {title ? <title>{title}</title> : null}

      {/* Robot Antenna with pulse ball */}
      <circle cx="12" cy="2.5" r="1.5" fill={accent || 'currentColor'} />
      <path d="M12 4v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />

      {/* Robot Head Body */}
      <rect
        x="4"
        y="6"
        width="16"
        height="13"
        rx="4.5"
        fill="currentColor"
      />

      {/* Futuristic Visor Screen */}
      <rect
        x="6"
        y="8.2"
        width="12"
        height="7.5"
        rx="2.5"
        fill="#0F172A"
      />

      {/* Glowing Expressive Eyes */}
      <ellipse cx="9" cy="11.8" rx="1.5" ry="1.6" fill={accent || '#38BDF8'} />
      <ellipse cx="15" cy="11.8" rx="1.5" ry="1.6" fill={accent || '#38BDF8'} />

      {/* Friendly Smile */}
      <path
        d="M10.5 13.8C11 14.5 13 14.5 13.5 13.8"
        stroke={accent || '#38BDF8'}
        strokeWidth="1.2"
        strokeLinecap="round"
      />

      {/* Ear / Headphone Nodes */}
      <rect x="2.5" y="10" width="1.5" height="5" rx="0.75" fill="currentColor" opacity="0.85" />
      <rect x="20" y="10" width="1.5" height="5" rx="0.75" fill="currentColor" opacity="0.85" />

      {/* Floating Gold AI Sparkle */}
      <path
        d="M20.5 2.5c0 .8.6 1.4 1.4 1.4-.8 0-1.4.6-1.4 1.4 0-.8-.6-1.4-1.4-1.4.8 0 1.4-.6 1.4-1.4Z"
        fill="#FBBF24"
      />
    </svg>
  )
}

export default AiSparkIcon
