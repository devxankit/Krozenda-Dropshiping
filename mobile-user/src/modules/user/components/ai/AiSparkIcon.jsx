import Svg, { Circle, Ellipse, Path, Rect } from 'react-native-svg'

/**
 * AI assistant mark: robot chatbot with glowing visor eyes, antenna signal, friendly expression and a
 * gold AI sparkle. `color` plays the role of the web's `currentColor` (text-white).
 */
export function AiSparkIcon({ size = 24, color = '#ffffff', accent = '#38BDF8', style }) {
  const glow = accent || '#38BDF8'
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size} fill="none" style={style}>
      {/* Antenna with pulse ball */}
      <Circle cx="12" cy="2.5" r="1.5" fill={accent || color} />
      <Path d="M12 4v2" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      {/* Head */}
      <Rect x="4" y="6" width="16" height="13" rx="4.5" fill={color} />
      {/* Visor */}
      <Rect x="6" y="8.2" width="12" height="7.5" rx="2.5" fill="#0F172A" />
      {/* Eyes */}
      <Ellipse cx="9" cy="11.8" rx="1.5" ry="1.6" fill={glow} />
      <Ellipse cx="15" cy="11.8" rx="1.5" ry="1.6" fill={glow} />
      {/* Smile */}
      <Path d="M10.5 13.8C11 14.5 13 14.5 13.5 13.8" stroke={glow} strokeWidth="1.2" strokeLinecap="round" />
      {/* Ear nodes */}
      <Rect x="2.5" y="10" width="1.5" height="5" rx="0.75" fill={color} opacity={0.85} />
      <Rect x="20" y="10" width="1.5" height="5" rx="0.75" fill={color} opacity={0.85} />
      {/* Gold sparkle */}
      <Path d="M20.5 2.5c0 .8.6 1.4 1.4 1.4-.8 0-1.4.6-1.4 1.4 0-.8-.6-1.4-1.4-1.4.8 0 1.4-.6 1.4-1.4Z" fill="#FBBF24" />
    </Svg>
  )
}
