import { useEffect, useState } from 'react'
import { Pressable, View, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import * as Clipboard from 'expo-clipboard'
import * as Print from 'expo-print'
import { Screen } from '../../components/layout/Screen'
import { Text } from '../../components/ui/Text'
import { Icon } from '../../components/ui/Icon'
import { SmartImage } from '../../components/ui/SmartImage'
import { Skeleton } from '../../components/ui/Skeleton'
import { api } from '../../lib/axios'
import { env } from '../../config/env'
import { CMS_ROUTES, USER_ROUTES, AUTH_ROUTES } from '../../config/routes'
import { toast } from '../../lib/toast'
import { colors, radius, shadows } from '../../theme'
import { PolicyContent } from './PolicyContent'
import { FALLBACK_CONTENT } from './cmsFallback'

const NAV_DOCUMENTS = [
  { slug: 'terms', title: 'Terms & Conditions', icon: 'HiScale', path: CMS_ROUTES.TERMS },
  { slug: 'privacy-policy', title: 'Privacy Policy', icon: 'HiShieldCheck', path: CMS_ROUTES.PRIVACY },
  { slug: 'shipping-policy', title: 'Shipping Policy', icon: 'HiTruck', path: CMS_ROUTES.SHIPPING },
  { slug: 'return-policy', title: 'Return Policy', icon: 'HiArrowUturnLeft', path: CMS_ROUTES.RETURN },
]

const titleCase = (slug) => slug.split('-').map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(' ')

const escapeHtml = (value) =>
  String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// Public legal / CMS page (terms, privacy-policy, return-policy, shipping-policy, about, cod-policy,
// vendor-agreement, seller-faq and /p/:slug). `slug` (route param) wins over `defaultSlug`.
export function PublicCmsScreen({ defaultSlug, slug: slugProp }) {
  const [currentYear] = useState(() => `${new Date().getFullYear()}`)
  const router = useRouter()
  const slug = slugProp || defaultSlug || 'terms'

  const [pageData, setPageData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let isMounted = true
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset to the loading state when the slug changes
    setLoading(true)

    async function loadPage() {
      try {
        const { data } = await api.get(`/public/cms/${slug}`)
        if (isMounted && data?.data) {
          setPageData(data.data)
        }
      } catch {
        // Use fallback content if API hasn't loaded or page is in fallback map
        if (isMounted) {
          const fallback = FALLBACK_CONTENT[slug] || {
            title: titleCase(slug),
            version: 'v1.0',
            updatedAt: currentYear,
            updatedBy: 'Compliance Team',
            requiresAcceptance: false,
            content: `# ${titleCase(slug)}\n\nOfficial documentation for KroZenda Marketplace.\n\nFor inquiries, please contact compliance@krozenda.com.`,
          }
          setPageData(fallback)
        }
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    loadPage()
    return () => {
      isMounted = false
    }
  }, [slug, currentYear])

  const goBack = () => {
    if (router.canGoBack()) router.back()
    else router.replace(USER_ROUTES.DASHBOARD)
  }

  const handleCopyLink = async () => {
    await Clipboard.setStringAsync(`${env.webOrigin}${CMS_ROUTES.page(slug)}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  const handlePrint = async () => {
    if (!pageData) return
    try {
      await Print.printAsync({
        html: `<html><body style="font-family:sans-serif;padding:24px"><h1>${escapeHtml(pageData.title)}</h1><pre style="white-space:pre-wrap;font-family:inherit;font-size:13px;line-height:1.6">${escapeHtml(pageData.content)}</pre></body></html>`,
      })
    } catch {
      toast.error('Could not open the print dialog')
    }
  }

  const header = (
    <View style={styles.header}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 }}>
        <Pressable onPress={goBack} accessibilityLabel="Go back" style={styles.iconBtn}>
          <Icon name="HiArrowLeft" size={20} color={colors.slate[500]} />
        </Pressable>
        <Pressable onPress={() => router.push(USER_ROUTES.DASHBOARD)} accessibilityLabel="KroZenda Home">
          <SmartImage src="/images/logo.png" alt="KroZenda Logo" ratio={1.5} fit="contain" style={{ height: 32, width: 48 }} />
        </Pressable>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Pressable onPress={handleCopyLink} style={[styles.outlineBtn, shadows['2xs']]}>
          {copied ? (
            <>
              <Icon name="HiCheckCircle" size={16} color={colors.emerald[600]} />
              <Text style={{ fontSize: 12, fontWeight: '700', color: colors.emerald[700] }}>Link Copied!</Text>
            </>
          ) : (
            <Icon name="HiClipboard" size={16} color={colors.slate[500]} />
          )}
        </Pressable>
        <Pressable onPress={handlePrint} style={[styles.outlineBtn, shadows['2xs']]}>
          <Icon name="HiPrinter" size={16} color={colors.slate[500]} />
        </Pressable>
        <Pressable
          onPress={goBack}
          style={({ pressed }) => [styles.backBtn, shadows.sm, { backgroundColor: pressed ? colors.blue[800] : colors.blue[700] }]}
        >
          <Icon name="HiArrowLeft" size={14} color="#fff" />
          <Text style={{ fontSize: 12, fontWeight: '700', color: '#fff' }}>Back</Text>
        </Pressable>
      </View>
    </View>
  )

  return (
    <Screen header={header}>
      <View style={{ padding: 16, gap: 24 }}>
        {/* Document switcher */}
        <View style={[styles.navCard, shadows.xs]}>
          <Text style={styles.navTitle}>Legal Documents & Policies</Text>
          <View style={{ gap: 4 }}>
            {NAV_DOCUMENTS.map((doc) => {
              const isActive = slug === doc.slug
              return (
                <Pressable
                  key={doc.slug}
                  onPress={() => router.push(doc.path)}
                  style={[styles.navItem, isActive && [{ backgroundColor: colors.blue[50] }, shadows['2xs']]]}
                >
                  <Icon name={doc.icon} size={16} color={isActive ? colors.blue[600] : colors.slate[400]} />
                  <Text
                    numberOfLines={1}
                    style={{ flexShrink: 1, fontSize: 12, fontWeight: isActive ? '800' : '700', color: isActive ? colors.blue[700] : colors.slate[600] }}
                  >
                    {doc.title}
                  </Text>
                </Pressable>
              )
            })}
          </View>
          <View style={styles.compliance}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Icon name="HiShieldCheck" size={16} color={colors.emerald[600]} />
              <Text style={{ fontSize: 12, fontWeight: '700', color: colors.slate[900] }}>Regulatory Compliance</Text>
            </View>
            <Text style={{ fontSize: 11, lineHeight: 15, color: colors.slate[500] }}>
              Operated in adherence with the Information Technology Act, 2000 and Consumer Protection (E-Commerce) Rules, 2020.
            </Text>
            <View style={{ paddingTop: 8, gap: 4 }}>
              <Text noTranslate style={styles.mono}>Email: compliance@krozenda.com</Text>
              <Text noTranslate style={styles.mono}>Helpline: +91 1800-KROZENDA</Text>
            </View>
          </View>
        </View>

        {/* Document reader */}
        <View style={[styles.article, shadows.sm]}>
          {loading ? (
            <View style={{ gap: 16 }}>
              <Skeleton style={{ height: 32, width: '66%', borderRadius: radius.xl }} />
              <Skeleton style={{ height: 16, width: '33%' }} />
              <View style={{ paddingTop: 24, gap: 12 }}>
                <Skeleton style={{ height: 16, width: '100%' }} />
                <Skeleton style={{ height: 16, width: '83%' }} />
                <Skeleton style={{ height: 16, width: '66%' }} />
              </View>
            </View>
          ) : pageData ? (
            <>
              <View style={styles.docHead}>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                  <View style={[styles.pill, { backgroundColor: colors.emerald[50], borderColor: colors.emerald[200] }]}>
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.emerald[500] }} />
                    <Text style={{ fontSize: 12, fontWeight: '700', color: colors.emerald[700] }}>Active Policy</Text>
                  </View>
                  <View style={{ backgroundColor: colors.slate[100], paddingHorizontal: 10, paddingVertical: 2, borderRadius: radius.lg }}>
                    <Text noTranslate style={{ fontSize: 12, fontWeight: '700', color: colors.slate[700] }}>
                      {pageData.version || 'v1.0'}
                    </Text>
                  </View>
                  {pageData.requiresAcceptance ? (
                    <View style={[styles.pill, { backgroundColor: colors.indigo[50], borderColor: colors.indigo[200] }]}>
                      <Icon name="HiScale" size={14} color={colors.indigo[600]} />
                      <Text style={{ fontSize: 12, fontWeight: '700', color: colors.indigo[700] }}>Mandatory Legal Agreement</Text>
                    </View>
                  ) : null}
                </View>

                <Text style={{ fontSize: 24, lineHeight: 32, fontWeight: '800', color: colors.slate[900], letterSpacing: -0.4 }}>
                  {pageData.title}
                </Text>

                <View style={{ gap: 4, paddingTop: 4 }}>
                  <Text style={styles.meta}>
                    {'Effective date: '}
                    <Text noTranslate style={[styles.meta, { fontWeight: '700', color: colors.slate[700] }]}>
                      {pageData.updatedAt || currentYear}
                    </Text>
                  </Text>
                  <Text style={styles.meta}>
                    {'Published by: '}
                    <Text noTranslate style={[styles.meta, { fontWeight: '700', color: colors.slate[700] }]}>
                      {pageData.updatedBy || 'KroZenda Legal'}
                    </Text>
                  </Text>
                  <Text noTranslate style={[styles.meta, { color: colors.slate[500] }]}>
                    Route: /{pageData.slug || slug}
                  </Text>
                </View>
              </View>

              <PolicyContent content={pageData.content} />

              <View style={styles.docFoot}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Icon name="HiShieldCheck" size={20} color={colors.emerald[600]} />
                  <Text style={{ flex: 1, fontSize: 12, color: colors.slate[500] }}>
                    This document is officially published on the KroZenda Multi-Vendor Platform.
                  </Text>
                </View>
                <Pressable
                  onPress={() => router.push(AUTH_ROUTES.LOGIN)}
                  style={({ pressed }) => [styles.signIn, shadows.xs, { backgroundColor: pressed ? colors.blue[800] : colors.blue[700] }]}
                >
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#fff' }}>Return to Sign In</Text>
                </Pressable>
              </View>
            </>
          ) : (
            <View style={{ paddingVertical: 48, alignItems: 'center', gap: 12 }}>
              <Icon name="HiDocumentText" size={48} color={colors.slate[300]} />
              <Text style={{ fontSize: 16, fontWeight: '700', color: colors.slate[900] }}>Document Not Found</Text>
              <Text style={{ fontSize: 12, color: colors.slate[500], textAlign: 'center', maxWidth: 320 }}>
                The requested legal page could not be located. Please select from the documents on the left sidebar.
              </Text>
            </View>
          )}
        </View>
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  header: {
    height: 64,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: colors.slate[200],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconBtn: { padding: 8, borderRadius: radius.xl },
  outlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.slate[200],
    backgroundColor: '#fff',
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 8, borderRadius: radius.xl },
  navCard: { backgroundColor: '#fff', borderRadius: radius['2xl'], borderWidth: 1, borderColor: colors.slate[200], padding: 16 },
  navTitle: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, color: colors.slate[400], marginBottom: 12, paddingHorizontal: 8 },
  navItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 10, borderRadius: radius.xl },
  compliance: { marginTop: 24, paddingTop: 16, paddingHorizontal: 8, borderTopWidth: 1, borderTopColor: colors.slate[100], gap: 8 },
  mono: { fontSize: 11, color: colors.slate[600], fontFamily: 'monospace' },
  article: { backgroundColor: '#fff', borderRadius: radius['3xl'], borderWidth: 1, borderColor: colors.slate[200], padding: 24, gap: 24 },
  docHead: { borderBottomWidth: 1, borderBottomColor: 'rgba(226,232,240,0.8)', paddingBottom: 24, gap: 12 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 2, borderRadius: 9999, borderWidth: 1 },
  meta: { fontSize: 12, fontWeight: '500', color: colors.slate[400] },
  docFoot: {
    marginTop: 24,
    marginHorizontal: -24,
    marginBottom: -24,
    paddingHorizontal: 24,
    paddingVertical: 24,
    borderTopWidth: 1,
    borderTopColor: colors.slate[200],
    backgroundColor: 'rgba(248,250,252,0.7)',
    borderBottomLeftRadius: radius['3xl'],
    borderBottomRightRadius: radius['3xl'],
    gap: 16,
  },
  signIn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: radius.xl, alignItems: 'center' },
})
