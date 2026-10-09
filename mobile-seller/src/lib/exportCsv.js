// Client-side CSV export (port of admin/lib/exportCsv.js). Writes the CSV to the cache directory
// and opens the system share sheet.
import { File, Paths } from 'expo-file-system'
import * as Sharing from 'expo-sharing'

function escapeCell(value) {
  if (value === null || value === undefined) return ''
  const text = String(value)
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function toCsv(columns, rows) {
  const header = columns.map((column) => escapeCell(column.header)).join(',')
  const body = rows.map((row) => columns.map((column) => escapeCell(column.value(row))).join(','))
  return [header, ...body].join('\r\n')
}

/**
 * `sections` is [{ title, columns: [{ header, value }], rows }] - several blocks in one file.
 * Async on native (writes the file, then shares it).
 */
export async function downloadCsv(filename, sections) {
  const blocks = sections
    .filter((section) => section.rows.length > 0)
    .map((section) =>
      section.title
        ? `${escapeCell(section.title)}\r\n${toCsv(section.columns, section.rows)}`
        : toCsv(section.columns, section.rows),
    )
  const safeName = String(filename || 'export.csv').replace(/[\/:*?"<>|]+/g, '_')
  const file = new File(Paths.cache, safeName)
  file.create({ overwrite: true })
  file.write(`﻿${blocks.join('\r\n\r\n')}`)
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', UTI: 'public.comma-separated-values-text', dialogTitle: safeName })
  }
}

export const rupees = (paise) => (paise / 100).toFixed(2)

// Plain text of a React node tree (replacement for the web's renderToStaticMarkup + strip tags).
function nodeText(node) {
  if (node === null || node === undefined || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(nodeText).join(' ')
  if (node.props) return nodeText(node.props.children)
  return ''
}

function cellText(column, row) {
  if (column.exportValue) return column.exportValue(row)
  const raw = row[column.key]
  if (raw === null || raw === undefined) return ''
  if (typeof raw !== 'object') return raw
  if (!column.render) return ''
  try {
    return nodeText(column.render(row)).replace(/\s+/g, ' ').trim()
  } catch {
    return ''
  }
}

export function downloadTableCsv(filename, columns, rows) {
  return downloadCsv(filename, [
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
