// Client-side CSV export. The reporting endpoints return exactly what the
// screen is showing, so an export is a re-serialisation of data already in
// hand — no second round trip, and no "export" button that does nothing.

import { renderToStaticMarkup } from 'react-dom/server'

function escapeCell(value) {
  if (value === null || value === undefined) return ''
  const text = String(value)
  // Quote anything a spreadsheet would otherwise split or swallow.
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function toCsv(columns, rows) {
  const header = columns.map((column) => escapeCell(column.header)).join(',')
  const body = rows.map((row) =>
    columns.map((column) => escapeCell(column.value(row))).join(','),
  )
  return [header, ...body].join('\r\n')
}

/**
 * Download one or more tables as a single CSV.
 *
 * `sections` is [{ title, columns: [{ header, value }], rows }] — several
 * blocks in one file, because a screen's export is the whole screen, not
 * whichever chart happened to be in focus.
 */
export function downloadCsv(filename, sections) {
  const blocks = sections
    .filter((section) => section.rows.length > 0)
    .map((section) =>
      section.title
        ? `${escapeCell(section.title)}\r\n${toCsv(section.columns, section.rows)}`
        : toCsv(section.columns, section.rows),
    )

  // The BOM is what makes Excel read ₹ and other UTF-8 correctly.
  const blob = new Blob([`\ufeff${blocks.join('\r\n\r\n')}`], {
    type: 'text/csv;charset=utf-8;',
  })

  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

// Money is held in paise everywhere in this panel; a spreadsheet wants rupees
// as a number it can sum, not a formatted string with a ₹ in it.
export const rupees = (paise) => (paise / 100).toFixed(2)

// Best-effort text for a DataTable column that only has a JSX `render`, not a
// dedicated `exportValue`. Renders the same cell the user sees and strips the
// markup, so the export matches the table instead of dumping "[object Object]".
function cellText(column, row) {
  if (column.exportValue) return column.exportValue(row)
  const raw = row[column.key]
  if (raw === null || raw === undefined) return ''
  if (typeof raw !== 'object') return raw
  if (!column.render) return ''
  try {
    return renderToStaticMarkup(column.render(row))
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  } catch {
    return ''
  }
}

/**
 * Export whatever a DataTable is currently showing, using its own column
 * definitions (`key` + `header`, optionally `exportValue` or `render`).
 * This is what every plain list screen's ExportMenu should call — it needs
 * no bespoke column mapping to stop being a no-op.
 */
export function downloadTableCsv(filename, columns, rows) {
  downloadCsv(filename, [
    {
      title: undefined,
      columns: columns.map((column) => ({
        header: typeof column.header === 'string' ? column.header : column.key,
        value: (row) => cellText(column, row),
      })),
      rows,
    },
  ])
}
