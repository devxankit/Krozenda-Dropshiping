import { Text as RNText, StyleSheet } from 'react-native'
import { colors, fontFamilyFor } from '../../theme'
import { useTranslated } from '../../lib/i18n'

// The app's Text. Differences from react-native's Text:
//  - maps fontWeight -> bundled Plus Jakarta Sans family (the web's body font)
//  - default colour is the web's body text colour
//  - plain-string children go through the runtime translator (see lib/i18n/dictionary.js), which
//    is how the web app's DOM translator is reproduced natively. Pass `noTranslate` to skip.
function Translated({ children }) {
  return useTranslated(children)
}

export function Text({ style, children, noTranslate = false, ...props }) {
  const flat = StyleSheet.flatten(style) || {}
  const { fontWeight, ...rest } = flat
  const fontFamily = rest.fontFamily || fontFamilyFor(fontWeight)
  const content =
    !noTranslate && typeof children === 'string' ? <Translated>{children}</Translated> : children
  return (
    <RNText {...props} style={[{ color: colors.text, fontFamily }, rest, { fontFamily }]}>
      {content}
    </RNText>
  )
}
