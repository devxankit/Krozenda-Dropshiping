// Client-side CSV export. The reporting endpoints return exactly what the
// screen is showing, so an export is a re-serialisation of data already in
// hand — no second round trip, and no "export" button that does nothing.

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
    .map((section) => `${escapeCell(section.title)}\r\n${toCsv(section.columns, section.rows)}`)

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
