// Parse CSV text into an array of rows (arrays of strings). Handles quoted
// cells with commas, doubled quotes and line breaks inside them, CRLF or LF
// line endings, and the byte-order mark Excel writes at the start of a
// "CSV UTF-8" file. Fully blank lines are dropped.
const BOM = String.fromCharCode(0xfeff)

export function parseCsv(text) {
  let src = String(text || '')
  if (src.startsWith(BOM)) src = src.slice(1)
  const rows = []
  let row = []
  let cell = ''
  let quoted = false

  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i]
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        cell += '"'
        i += 1
      } else if (ch === '"') {
        quoted = false
      } else {
        cell += ch
      }
    } else if (ch === '"') {
      quoted = true
    } else if (ch === ',') {
      row.push(cell)
      cell = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i += 1
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else {
      cell += ch
    }
  }
  if (cell !== '' || row.length > 0) {
    row.push(cell)
    rows.push(row)
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''))
}
