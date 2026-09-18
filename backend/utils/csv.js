// A small RFC 4180 CSV reader and writer.
//
// Written rather than pulled in as a dependency on purpose: the whole surface
// this platform needs is "parse a seller's product upload" and "hand back a
// template", and the parsing rules that actually matter — quoted fields,
// embedded commas, embedded newlines, doubled quotes — are about forty lines.
// A dependency for that is forty lines of code plus a supply chain.
//
// What it deliberately does NOT do: .xlsx. That is a zip of XML and genuinely
// needs a library. Sellers exporting from Excel can "Save as CSV", and the
// import screen says so.

// Parse a CSV string into an array of row objects keyed by the header row.
//
// The state machine exists because a naive `split(',')` breaks on the first
// product description containing a comma, which is most of them.
function parseCsv(text) {
  const clean = String(text ?? '').replace(/^﻿/, ''); // strip a BOM Excel adds
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < clean.length; i += 1) {
    const char = clean[i];
    const next = clean[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        // A doubled quote inside a quoted field is one literal quote.
        field += '"';
        i += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      // Accept CRLF, LF and CR alike; skip the LF of a CRLF pair.
      if (char === '\r' && next === '\n') i += 1;
      row.push(field);
      field = '';
      rows.push(row);
      row = [];
    } else {
      field += char;
    }
  }

  // Whatever is left when the input runs out is the last field of the last
  // row — unless the file ended on a newline, in which case there is nothing.
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  // Drop entirely blank lines, which a spreadsheet export is full of.
  const nonEmpty = rows.filter((r) => r.some((cell) => String(cell).trim() !== ''));
  if (nonEmpty.length === 0) return { headers: [], rows: [] };

  const headers = nonEmpty[0].map((h) => String(h).trim());
  const dataRows = nonEmpty.slice(1).map((cells, index) => {
    const record = {};
    headers.forEach((header, columnIndex) => {
      record[header] = String(cells[columnIndex] ?? '').trim();
    });
    // 1-based, and +2 because row 1 is the header — so the number matches what
    // the seller sees in their spreadsheet's row gutter.
    record.__line = index + 2;
    return record;
  });

  return { headers, rows: dataRows };
}

// Quote only what has to be quoted, so a hand-inspected file stays readable.
function escapeCell(value) {
  const str = value === null || value === undefined ? '' : String(value);
  if (/[",\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

function toCsv(headers, rows) {
  const lines = [headers.map(escapeCell).join(',')];
  for (const row of rows) {
    lines.push(headers.map((header) => escapeCell(row[header])).join(','));
  }
  return lines.join('\r\n');
}

module.exports = { parseCsv, toCsv };
