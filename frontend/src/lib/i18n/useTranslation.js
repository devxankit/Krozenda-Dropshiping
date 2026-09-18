import { useContext } from 'react'
import { TranslationContext } from './context'

// The one hook a screen needs:
//
//   const { t } = useTranslation()
//   <h1>{t('Legal & Policy Settings')}</h1>
//
// The English string stays in the JSX — it is the key AND the fallback, so
// there is no key file to keep in sync and nothing renders as `settings.title`
// when a lookup misses. Outside a provider it returns the source text, which
// is why wrapping a screen is opt-in rather than required.
export function useTranslation() {
  return useContext(TranslationContext)
}
