import { useId } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  AXIS_PROPS,
  CHART_MARGIN,
  CURSOR_FILL,
  CURSOR_LINE,
  GRID_PROPS,
  SERIES,
  SURFACE,
  X_AXIS_PROPS,
} from './chartTheme'
import { ChartTooltip } from './ChartFrame'

export { ChartFrame, ChartLegend, ChartTooltip } from './ChartFrame'
export * from './chartTheme'

// Thin wrappers over recharts. They exist so no screen ever passes a colour,
// a stroke width or a tick style directly — the theme decides, once.
//
// series: [{ key, label, color? }] in fixed order.

export function AreaTrend({ data, series = [], xKey = 'label', formatValue, formatAxis, stacked = true }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={CHART_MARGIN}>
        <defs>
          {series.map((item, index) => (
            <linearGradient key={item.key} id={`fill-${item.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={item.color || SERIES[index]} stopOpacity={0.22} />
              <stop offset="100%" stopColor={item.color || SERIES[index]} stopOpacity={0.04} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid {...GRID_PROPS} />
        <XAxis dataKey={xKey} {...X_AXIS_PROPS} />
        <YAxis {...AXIS_PROPS} tickFormatter={formatAxis} width={52} />
        <Tooltip
          cursor={{ stroke: CURSOR_LINE, strokeWidth: 1 }}
          content={<ChartTooltip formatValue={formatValue} total={stacked} />}
        />
        {series.map((item, index) => (
          <Area
            key={item.key}
            type="monotone"
            dataKey={item.key}
            name={item.label}
            stackId={stacked ? 'stack' : undefined}
            stroke={item.color || SERIES[index]}
            strokeWidth={2}
            fill={`url(#fill-${item.key})`}
            // A 2px surface-coloured seam between stacked bands, so adjacent
            // fills read as separate areas rather than one gradient.
            activeDot={{ r: 3.5, strokeWidth: 2, stroke: SURFACE }}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  )
}

export function BarSeries({
  data,
  series = [],
  xKey = 'label',
  formatValue,
  formatAxis,
  stacked = false,
  horizontal = false,
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={CHART_MARGIN} layout={horizontal ? 'vertical' : 'horizontal'}>
        <CartesianGrid {...GRID_PROPS} vertical={horizontal} horizontal={!horizontal} />
        {horizontal ? (
          <>
            <XAxis type="number" {...AXIS_PROPS} tickFormatter={formatAxis} />
            <YAxis type="category" dataKey={xKey} {...AXIS_PROPS} width={130} />
          </>
        ) : (
          <>
            <XAxis dataKey={xKey} {...X_AXIS_PROPS} />
            <YAxis {...AXIS_PROPS} tickFormatter={formatAxis} width={52} />
          </>
        )}
        <Tooltip
          cursor={{ fill: CURSOR_FILL }}
          content={<ChartTooltip formatValue={formatValue} total={stacked} />}
        />
        {series.map((item, index) => (
          <Bar
            key={item.key}
            dataKey={item.key}
            name={item.label}
            stackId={stacked ? 'stack' : undefined}
            fill={item.color || SERIES[index]}
            radius={horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]}
            maxBarSize={horizontal ? 16 : 28}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}

export function DonutSplit({ data, formatValue, centreLabel, centreValue }) {
  return (
    <div className="relative h-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="label"
            innerRadius="62%"
            outerRadius="88%"
            paddingAngle={2}
            stroke={SURFACE}
            strokeWidth={2}
          >
            {data.map((entry, index) => (
              <Cell key={entry.label} fill={entry.color || SERIES[index]} />
            ))}
          </Pie>
          <Tooltip content={<ChartTooltip formatValue={formatValue} />} />
        </PieChart>
      </ResponsiveContainer>

      {centreValue && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="tabular text-lg font-bold tracking-tight text-slate-900">
            {centreValue}
          </span>
          <span className="text-2xs text-ink-faint">{centreLabel}</span>
        </div>
      )}
    </div>
  )
}

// The same trend as a filled area, sized to sit flush along the bottom edge
// of a stat tile. Area rather than line because at 40px tall a bare stroke
// reads as noise, while a filled shape still reads as a direction.
export function SparkArea({ data, dataKey = 'value', color = SERIES[0], height = 40 }) {
  // useId() emits colons, which some browsers refuse inside a url(#...)
  // reference — strip them so the gradient actually paints.
  const gradientId = `spark-${useId().replace(/[^a-zA-Z0-9]/g, '')}`

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.28} />
            <stop offset="100%" stopColor={color} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey={dataKey}
          stroke={color}
          strokeWidth={1.75}
          fill={`url(#${gradientId})`}
          dot={false}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

// Inline trend for a stat tile. No axes, no tooltip — it shows shape only,
// and the number beside it carries the value.
export function Sparkline({ data, dataKey = 'value', color = SERIES[0], height = 32 }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
        <Line
          type="monotone"
          dataKey={dataKey}
          stroke={color}
          strokeWidth={1.75}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
