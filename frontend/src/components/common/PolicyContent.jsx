import { Fragment } from 'react'

// Renders CMS policy text. Admins write these either as plain text (numbered,
// CAPITALISED headings) or with light markdown (#, ###, -, **bold**). Both have
// to read cleanly, so the markdown subset is turned into real elements instead
// of being printed as literal symbols. Deliberately not a full markdown parser
// and never dangerouslySetInnerHTML: CMS text stays text.

function renderInline(text) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((part, i) =>
    part.startsWith('**') && part.endsWith('**') && part.length > 4 ? (
      <strong key={i} className="font-semibold text-slate-900">
        {part.slice(2, -2)}
      </strong>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    ),
  )
}

function parseBlocks(content) {
  const blocks = []
  let paragraph = []
  let list = []

  const flushParagraph = () => {
    if (paragraph.length) blocks.push({ type: 'p', lines: paragraph })
    paragraph = []
  }
  const flushList = () => {
    if (list.length) blocks.push({ type: 'ul', items: list })
    list = []
  }

  for (const raw of String(content || '').split(/\r?\n/)) {
    const line = raw.trim()
    if (!line) {
      flushParagraph()
      flushList()
      continue
    }

    const heading = line.match(/^(#{1,6})\s+(.*)$/)
    if (heading) {
      flushParagraph()
      flushList()
      blocks.push({ type: heading[1].length <= 1 ? 'h2' : 'h3', text: heading[2] })
      continue
    }

    const bullet = line.match(/^(?:[-*•])\s+(.*)$/)
    if (bullet) {
      flushParagraph()
      list.push(bullet[1])
      continue
    }

    flushList()
    paragraph.push(line)
  }
  flushParagraph()
  flushList()
  return blocks
}

export function PolicyContent({ content, className = '' }) {
  const blocks = parseBlocks(content)

  return (
    <div className={`space-y-4 text-sm leading-relaxed text-slate-700 ${className}`}>
      {blocks.map((block, i) => {
        if (block.type === 'h2') {
          return (
            <h2 key={i} className="pt-2 text-base font-bold text-slate-900">
              {renderInline(block.text)}
            </h2>
          )
        }
        if (block.type === 'h3') {
          return (
            <h3 key={i} className="pt-1 text-sm font-bold text-slate-900">
              {renderInline(block.text)}
            </h3>
          )
        }
        if (block.type === 'ul') {
          return (
            <ul key={i} className="list-disc space-y-1 pl-5">
              {block.items.map((item, j) => (
                <li key={j}>{renderInline(item)}</li>
              ))}
            </ul>
          )
        }
        return (
          <p key={i}>
            {block.lines.map((line, j) => (
              <Fragment key={j}>
                {j > 0 && <br />}
                {renderInline(line)}
              </Fragment>
            ))}
          </p>
        )
      })}
    </div>
  )
}
