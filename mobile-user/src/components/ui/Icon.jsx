import { SvgXml } from 'react-native-svg'
import { ICONS } from './iconData'
import { colors } from '../../theme'

// react-icons glyphs (same icon set as the web app: Heroicons 2 `Hi*`, FA6, Feather), rendered from
// the generated markup in iconData.js. Usage: <Icon name="HiHome" size={20} color={colors.slate[500]} />
// Names are the react-icons export names. After porting a screen that uses a new icon, run
// `node tools/gen-icons.mjs`.
export function Icon({ name, size = 20, color = colors.text, style }) {
  const xml = ICONS[name]
  if (!xml) {
    if (__DEV__) console.warn(`Icon "${name}" missing - run node tools/gen-icons.mjs`)
    return null
  }
  return <SvgXml xml={xml} width={size} height={size} color={color} style={style} />
}
