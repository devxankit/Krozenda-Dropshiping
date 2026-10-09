import { StyleSheet, View } from 'react-native'
import { Text } from '../ui/Text'
import { colors } from '../../theme'

// Renders CMS policy text (plain text or light markdown: #, ###, -, **bold**). Port of the web's
// PolicyContent: a deliberately small markdown subset turned into real elements, CMS text stays text.
function renderInline(text, baseStyle) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((part, i) =>
    part.startsWith('**') && part.endsWith('**') && part.length > 4 ? (
      <Text key={i} noTranslate style={[baseStyle, styles.strong]}>
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

export function PolicyContent({ content, style }) {
  const blocks = parseBlocks(content)
  return (
    <View style={[styles.wrap, style]}>
      {blocks.map((block, i) => {
        if (block.type === 'h2') {
          return (
            <Text key={i} noTranslate style={[styles.h2, { paddingTop: 8 }]}>
              {renderInline(block.text, styles.h2)}
            </Text>
          )
        }
        if (block.type === 'h3') {
          return (
            <Text key={i} noTranslate style={[styles.h3, { paddingTop: 4 }]}>
              {renderInline(block.text, styles.h3)}
            </Text>
          )
        }
        if (block.type === 'ul') {
          return (
            <View key={i} style={{ gap: 4, paddingLeft: 20 }}>
              {block.items.map((item, j) => (
                <View key={j} style={styles.li}>
                  <Text noTranslate style={styles.body}>
                    {'•'}
                  </Text>
                  <Text noTranslate style={[styles.body, { flex: 1 }]}>
                    {renderInline(item, styles.body)}
                  </Text>
                </View>
              ))}
            </View>
          )
        }
        return (
          <Text key={i} noTranslate style={styles.body}>
            {block.lines.map((line, j) => (j > 0 ? ['\n', ...renderInline(line, styles.body)] : renderInline(line, styles.body)))}
          </Text>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: 16 },
  body: { fontSize: 14, lineHeight: 22.75, color: colors.slate[700] },
  strong: { fontWeight: '600', color: colors.slate[900] },
  h2: { fontSize: 16, lineHeight: 24, fontWeight: '700', color: colors.slate[900] },
  h3: { fontSize: 14, lineHeight: 20, fontWeight: '700', color: colors.slate[900] },
  li: { flexDirection: 'row', gap: 8 },
})
