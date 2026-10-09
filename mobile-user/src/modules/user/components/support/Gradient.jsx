import { GradientFill } from '../../../auth/components/GradientFill'

// Absolute-fill linear gradient (Tailwind bg-gradient-to-r / -br). Delegates to GradientFill, which
// measures its parent so the gradient always covers the whole box.
// `direction`: 'r' = left to right, 'br' = top-left to bottom-right.
export function Gradient({ stops, direction = 'r' }) {
  return (
    <GradientFill
      colors={stops.map(([, color]) => color)}
      locations={stops.map(([offset]) => Number(offset))}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: direction === 'br' ? 1 : 0 }}
    />
  )
}
