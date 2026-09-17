import React from 'react'

/**
 * The assistant's mark: a solid four-point sparkle with a smaller gold one
 * riding off its shoulder.
 *
 * Drawn here rather than pulled from react-icons because the stock outline
 * sparkle is a uniform hairline — at 20-24px on a saturated blue button its
 * strokes half disappear and it reads as a smudge. A filled glyph holds its
 * shape at every size the app uses.
 *
 * The gold accent is the one Krozenda colour the rest of the AI surface does
 * not already use (the logo is blue + gold), so the mark ties to the brand
 * instead of being a generic blue-on-blue sparkle. It is a separate path so
 * it can be recoloured — or dropped via `accent={null}` — without touching
 * the main shape.
 *
 * Both paths use the concave four-point star that has become the common
 * visual shorthand for AI, so it is recognisable before it is read.
 */
export function AiSparkIcon({ className = '', accent = 'currentColor', title, ...rest }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      // Decorative by default: the buttons that use this carry their own
      // aria-label, so announcing the glyph again would only be noise.
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : 'true'}
      focusable="false"
      {...rest}
    >
      {title ? <title>{title}</title> : null}

      {/* Main sparkle — centred low-left so the accent has room top-right. */}
      <path
        d="M10.5 3.2c0 4.6 3.7 8.3 8.3 8.3-4.6 0-8.3 3.7-8.3 8.3 0-4.6-3.7-8.3-8.3-8.3 4.6 0 8.3-3.7 8.3-8.3Z"
        fill="currentColor"
      />

      {/* Accent sparkle. */}
      {accent ? (
        <path
          d="M19 2.2c0 1.9 1.6 3.5 3.5 3.5-1.9 0-3.5 1.6-3.5 3.5 0-1.9-1.6-3.5-3.5-3.5 1.9 0 3.5-1.6 3.5-3.5Z"
          fill={accent}
        />
      ) : null}
    </svg>
  )
}

export default AiSparkIcon
