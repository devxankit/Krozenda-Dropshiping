import { useId, useMemo, useState } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, Stop, Text as SvgText } from 'react-native-svg'
import { fonts } from '../../../theme'
import { ChartTooltip } from './ChartFrame'
import { AXIS, BORDER, CHART_MARGIN, CURSOR_LINE, GRID, INK, SERIES, SURFACE } from './chartTheme'

export { ChartFrame, ChartLegend, ChartTooltip } from './ChartFrame'
export * from './chartTheme'

// react-native-svg re-implementation of the web's recharts wrappers (the ones the seller screens
// use: AreaTrend and SparkArea). Same data props, same colours / grid / axis weights.
//
// series: [{ key, label, color? }] in fixed order.

// ---- geometry helpers ----------------------------------------------------

// Monotone cubic through pixel points, the same curve as recharts type="monotone" (d3 curveMonotoneX).
function sign(x) {
  return x < 0 ? -1 : 1
}

function slope3(p0, p1, p2) {
  const h0 = p1.x - p0.x
  const h1 = p2.x - p1.x
  const s0 = (p1.y - p0.y) / (h0 || (h1 < 0 ? -0 : 0))
  const s1 = (p2.y - p1.y) / (h1 || (h0 < 0 ? -0 : 0))
  const p = (s0 * h1 + s1 * h0) / (h0 + h1)
  return (sign(s0) + sign(s1)) * Math.min(Math.abs(s0), Math.abs(s1), 0.5 * Math.abs(p)) || 0
}

function slope2(p0, p1, t) {
  const h = p1.x - p0.x
  return h ? ((3 * (p1.y - p0.y)) / h - t) / 2 : t
}

function monotone(points) {
  const n = points.length
  if (n === 0) return ''
  if (n === 1) return `M${points[0].x},${points[0].y}`
  const t = new Array(n)
  if (n === 2) {
    t[0] = t[1] = (points[1].y - points[0].y) / (points[1].x - points[0].x || 1)
  } else {
    for (let i = 1; i < n - 1; i += 1) t[i] = slope3(points[i - 1], points[i], points[i + 1])
    t[0] = slope2(points[0], points[1], t[1])
    t[n - 1] = slope2(points[n - 2], points[n - 1], t[n - 2])
  }
  let d = `M${points[0].x},${points[0].y}`
  for (let i = 0; i < n - 1; i += 1) {
    const a = points[i]
    const b = points[i + 1]
    const dx = (b.x - a.x) / 3
    d += `C${a.x + dx},${a.y + dx * t[i]},${b.x - dx},${b.y - dx * t[i + 1]},${b.x},${b.y}`
  }
  return d
}

// 5 "nice" ticks (0 .. top) like the web axis.
function niceTicks(max, intervals = 4) {
  if (!(max > 0)) return [0, 1]
  const raw = max / intervals
  const pow = 10 ** Math.floor(Math.log10(raw))
  const frac = raw / pow
  const step = (frac <= 1 ? 1 : frac <= 2 ? 2 : frac <= 2.5 ? 2.5 : frac <= 5 ? 5 : 10) * pow
  const count = Math.ceil(max / step)
  return Array.from({ length: count + 1 }, (_, index) => index * step)
}

function useSize() {
  const [size, setSize] = useState({ width: 0, height: 0 })
  return [
    size,
    (event) => {
      const { width, height } = event.nativeEvent.layout
      setSize((prev) => (prev.width === width && prev.height === height ? prev : { width, height }))
    },
  ]
}

const gradientKey = (id) => id.replace(/[^a-zA-Z0-9]/g, '')

// ---- AreaTrend -----------------------------------------------------------

export function AreaTrend({ data, series = [], xKey = 'label', formatValue, formatAxis, stacked = true }) {
  const uid = gradientKey(useId())
  const [size, onLayout] = useSize()
  const [activeIndex, setActiveIndex] = useState(null)

  const n = data?.length || 0
  const { width, height } = size
  const x0 = CHART_MARGIN.left + AXIS.yWidth
  const x1 = width - CHART_MARGIN.right
  const y0 = CHART_MARGIN.top
  const y1 = height - CHART_MARGIN.bottom - AXIS.xHeight
  const plotW = Math.max(0, x1 - x0)
  const plotH = Math.max(0, y1 - y0)

  const model = useMemo(() => {
    if (!n || !series.length) return null
    // cumulative [lower, upper] per series per point
    const bands = series.map(() => [])
    let max = 0
    for (let i = 0; i < n; i += 1) {
      let running = 0
      series.forEach((item, s) => {
        const value = Number(data[i][item.key]) || 0
        const lower = stacked ? running : 0
        const upper = stacked ? running + value : value
        bands[s].push({ lower, upper, value })
        running = upper
        if (upper > max) max = upper
      })
    }
    const ticks = niceTicks(max)
    return { bands, ticks, top: ticks[ticks.length - 1] }
  }, [data, series, stacked, n])

  const xAt = (i) => (n > 1 ? x0 + (i / (n - 1)) * plotW : x0 + plotW / 2)
  const yAt = (v) => (model.top ? y1 - (v / model.top) * plotH : y1)

  // x labels: as many as fit (~56px each), always the first
  const labelStep = Math.max(1, Math.ceil(n / Math.max(1, Math.floor(plotW / 56))))

  function onPress(event) {
    if (!n) return
    const { locationX } = event.nativeEvent
    if (locationX < x0 - 8 || locationX > x1 + 8) {
      setActiveIndex(null)
      return
    }
    const index = n > 1 ? Math.round(((locationX - x0) / plotW) * (n - 1)) : 0
    setActiveIndex(Math.min(n - 1, Math.max(0, index)))
  }

  const active = model && activeIndex != null && activeIndex < n ? activeIndex : null
  const activeX = active != null ? xAt(active) : 0
  const tipOnLeft = activeX > x0 + plotW / 2

  return (
    <View style={styles.fill} onLayout={onLayout}>
      {width > 0 && height > 0 && model ? (
        <>
          <Svg width={width} height={height}>
            <Defs>
              {series.map((item, index) => {
                const color = item.color || SERIES[index]
                return (
                  <LinearGradient key={item.key} id={`fill-${uid}-${index}`} x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0" stopColor={color} stopOpacity={0.22} />
                    <Stop offset="1" stopColor={color} stopOpacity={0.04} />
                  </LinearGradient>
                )
              })}
            </Defs>

            {/* horizontal grid + y ticks */}
            {model.ticks.map((tick) => (
              <Line key={`g-${tick}`} x1={x0} x2={x1} y1={yAt(tick)} y2={yAt(tick)} stroke={GRID} strokeWidth={1} />
            ))}
            {model.ticks.map((tick) => (
              <SvgText
                key={`yt-${tick}`}
                x={AXIS.yWidth - AXIS.tickMargin}
                y={yAt(tick) + 4}
                fontSize={AXIS.fontSize}
                fill={INK.axis}
                textAnchor="end"
                fontFamily={fonts[400]}
              >
                {formatAxis ? formatAxis(tick) : String(tick)}
              </SvgText>
            ))}

            {/* x axis line + labels */}
            <Line x1={x0} x2={x1} y1={y1} y2={y1} stroke={BORDER} strokeWidth={1} />
            {data.map((row, i) =>
              i % labelStep === 0 ? (
                <SvgText
                  key={`xt-${i}`}
                  x={xAt(i)}
                  y={y1 + AXIS.tickMargin + AXIS.fontSize - 2}
                  fontSize={AXIS.fontSize}
                  fill={INK.axis}
                  textAnchor={i === 0 ? 'start' : xAt(i) > x1 - 20 ? 'end' : 'middle'}
                  fontFamily={fonts[400]}
                >
                  {String(row[xKey])}
                </SvgText>
              ) : null,
            )}

            {/* areas - drawn first series at the bottom of the stack */}
            {series.map((item, s) => {
              const color = item.color || SERIES[s]
              const upper = model.bands[s].map((b, i) => ({ x: xAt(i), y: yAt(b.upper) }))
              const lower = model.bands[s].map((b, i) => ({ x: xAt(i), y: yAt(b.lower) })).reverse()
              const top = monotone(upper)
              const bottom = monotone(lower).replace(/^M/, 'L')
              const fill = n > 1 ? `${top}${bottom}Z` : ''
              return (
                <G key={item.key}>
                  <Path d={fill} fill={`url(#fill-${uid}-${s})`} stroke="none" />
                  <Path d={top} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                </G>
              )
            })}

            {active != null ? (
              <>
                <Line x1={activeX} x2={activeX} y1={y0} y2={y1} stroke={CURSOR_LINE} strokeWidth={1} />
                {series.map((item, s) => (
                  <Circle
                    key={item.key}
                    cx={activeX}
                    cy={yAt(model.bands[s][active].upper)}
                    r={3.5}
                    fill={item.color || SERIES[s]}
                    stroke={SURFACE}
                    strokeWidth={2}
                  />
                ))}
              </>
            ) : null}
          </Svg>

          <Pressable style={StyleSheet.absoluteFill} onPress={onPress} accessibilityLabel="Chart" />

          {active != null ? (
            <ChartTooltip
              label={data[active][xKey]}
              formatValue={formatValue}
              total={stacked}
              payload={series.map((item, s) => ({
                key: item.key,
                name: item.label,
                color: item.color || SERIES[s],
                value: model.bands[s][active].value,
              }))}
              style={[styles.tip, tipOnLeft ? { left: x0 + 4 } : { right: CHART_MARGIN.right + 4 }]}
            />
          ) : null}
        </>
      ) : null}
    </View>
  )
}

// ---- SparkArea -----------------------------------------------------------

// The same trend as a filled area, sized to sit flush along the bottom edge of a stat tile.
export function SparkArea({ data, dataKey = 'value', color = SERIES[0], height = 40 }) {
  const uid = gradientKey(useId())
  const [size, onLayout] = useSize()
  const { width } = size
  const margin = { top: 4, right: 0, bottom: 0, left: 0 }

  let top = ''
  let fill = ''
  if (width > 0 && data?.length > 1) {
    const values = data.map((row) => Number(row[dataKey]) || 0)
    const max = Math.max(0, ...values)
    const plotH = height - margin.top - margin.bottom
    const points = values.map((value, i) => ({
      x: (i / (values.length - 1)) * width,
      y: max ? margin.top + plotH - (value / max) * plotH : margin.top + plotH,
    }))
    top = monotone(points)
    fill = `${top}L${width},${height}L0,${height}Z`
  }

  return (
    <View style={{ height, width: '100%' }} onLayout={onLayout} pointerEvents="none">
      {width > 0 && top ? (
        <Svg width={width} height={height}>
          <Defs>
            <LinearGradient id={`spark-${uid}`} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={color} stopOpacity={0.28} />
              <Stop offset="1" stopColor={color} stopOpacity={0.02} />
            </LinearGradient>
          </Defs>
          <Path d={fill} fill={`url(#spark-${uid})`} stroke="none" />
          <Path d={top} fill="none" stroke={color} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1, minHeight: 0 },
  tip: { position: 'absolute', top: 0 },
})
