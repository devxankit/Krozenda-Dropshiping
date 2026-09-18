import { createContext } from 'react'

// Split out of TranslationProvider.jsx and useTranslation.js so neither file
// exports a mix of components and non-components — that is what trips
// react-refresh/only-export-components and costs fast refresh on this tree.
//
// The default value is the English identity translator. It means a component
// that renders outside any provider (a modal portalled elsewhere, a screen
// mounted in isolation by a test) shows its source text instead of crashing,
// which is exactly the behaviour we want everywhere translation is optional.
export const TranslationContext = createContext({
  language: 'en',
  t: (text) => text,
  translating: false,
})
