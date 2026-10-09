import { useId, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg'

// CSS linear-gradient replacement (no expo-linear-gradient in the app). Fills its parent absolutely;
// the parent supplies size, borderRadius and overflow: 'hidden'.
//   colors: ['#4f46e5', '#6366f1'], locations (optional, 0..1), start/end in 0..1 box coordinates
//   (default = 135deg like `linear-gradient(135deg, ...)`).
// The SVG is given the parent's MEASURED pixel size (onLayout) - a "100%" SVG kept the size of its first
// layout pass on Android, so a gradient behind content that grew afterwards stopped short.
export function GradientFill({ colors, locations, start = { x: 0, y: 0 }, end = { x: 1, y: 1 } }) {
  const id = `g${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const [size, setSize] = useState(null)
  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout
        setSize((s) => (s && s.width === width && s.height === height ? s : { width, height }))
      }}
    >
      {size ? (
        <Svg width={size.width} height={size.height}>
          <Defs>
            <LinearGradient id={id} x1={start.x} y1={start.y} x2={end.x} y2={end.y}>
              {colors.map((c, i) => (
                <Stop key={i} offset={locations ? locations[i] : colors.length === 1 ? 0 : i / (colors.length - 1)} stopColor={c} />
              ))}
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width={size.width} height={size.height} fill={`url(#${id})`} />
        </Svg>
      ) : null}
    </View>
  )
}
