import { View } from 'react-native'
import { Text } from '../../components/ui/Text'
import { colors } from '../../theme'

// Native port of components/common/PolicyContent.jsx. Renders CMS policy text: plain text (numbered,
// CAPITALISED headings) or light markdown (#, ###, -, **bold**). Never HTML - CMS text stays text.

function renderInline(text) {
  // Plain strings stay strings so the app's runtime translator can translate them.
  if (!text.includes('**')) return text
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((part, i) =>
    part.startsWith('**') && part.endsWith('**') && part.length > 4 ? (
      <Text key={i} style={{ fontWeight: '600', color: colors.slate[900] }}>
        {part.slice(2, -2)}
      </Text>
    ) : (
      part
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

const body = { fontSize: 14, lineHeight: 22.75, color: colors.slate[700] }

export function PolicyContent({ content }) {
  const blocks = parseBlocks(content)

  return (
    <View style={{ gap: 16 }}>
      {blocks.map((block, i) => {
        if (block.type === 'h2') {
          return (
            <Text key={i} selectable style={{ paddingTop: 8, fontSize: 16, lineHeight: 24, fontWeight: '700', color: colors.slate[900] }}>
              {renderInline(block.text)}
            </Text>
          )
        }
        if (block.type === 'h3') {
          return (
            <Text key={i} selectable style={{ paddingTop: 4, fontSize: 14, lineHeight: 20, fontWeight: '700', color: colors.slate[900] }}>
              {renderInline(block.text)}
            </Text>
          )
        }
        if (block.type === 'ul') {
          return (
            <View key={i} style={{ gap: 4, paddingLeft: 20 }}>
              {block.items.map((item, j) => (
                <View key={j} style={{ flexDirection: 'row' }}>
                  <Text noTranslate style={[body, { width: 14 }]}>
                    {'•'}
                  </Text>
                  <Text selectable style={[body, { flex: 1 }]}>
                    {renderInline(item)}
                  </Text>
                </View>
              ))}
            </View>
          )
        }
        if (!block.lines.some((line) => line.includes('**'))) {
          return (
            <Text key={i} selectable style={body}>
              {block.lines.join('\n')}
            </Text>
          )
        }
        return (
          <Text key={i} selectable style={body}>
            {block.lines.map((line, j) => (
              <Text key={j} style={body}>
                {j > 0 ? '\n' : ''}
                {renderInline(line)}
              </Text>
            ))}
          </Text>
        )
      })}
    </View>
  )
}
