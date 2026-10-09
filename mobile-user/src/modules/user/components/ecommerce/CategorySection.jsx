import { Pressable, StyleSheet, View } from 'react-native'
import { useRouter } from 'expo-router'
import { Icon } from '../../../../components/ui/Icon'
import { SmartImage } from '../../../../components/ui/SmartImage'
import { Text } from '../../../../components/ui/Text'
import { USER_ROUTES, userPath } from '../../../../config/routes'
import { colors, radius, shadows } from '../../../../theme'

const CATEGORIES = [
  {
    id: 'mobiles',
    name: 'Mobiles & Tablets',
    itemCount: '1,250+ Curated Products',
    image: '/images/cat_mobiles.jpg',
    badge: 'BESTSELLER',
    discount: 'Up to 40% OFF - New Tiers',
  },
  {
    id: 'laptops',
    name: 'Laptops & Workstations',
    itemCount: '1,250+ Curated Products',
    image: '/images/cat_laptops_new.jpg',
    badge: 'POPULAR',
    discount: 'Up to 40% OFF - New Tiers',
  },
  {
    id: 'watches',
    name: 'Smartwatches',
    itemCount: '1,120+ Curated Products',
    image: '/images/cat_watches_new.jpg',
    badge: 'TRENDING',
    discount: 'Max Savings 60% OFF',
  },
  {
    id: 'audio',
    name: 'Audio & Headphones',
    itemCount: '2,350+ Curated Products',
    image: '/images/boat_airdopes.png',
    badge: 'HOT',
    discount: 'Flash Sale: Up to 75% OFF',
  },
  {
    id: 'fashion',
    name: 'Fashion & Apparel',
    itemCount: '3,400+ Curated Products',
    image: '/images/cat_fashion.jpg',
    badge: 'NEW TIERS',
    discount: 'Max Savings 60% OFF',
  },
  {
    id: 'shoes',
    name: 'Shoes & Footwear',
    itemCount: '1,890+ Curated Products',
    image: '/images/cat_shoes.jpg',
    badge: 'TOP SELLER',
    discount: 'Max Savings 60% OFF',
  },
  {
    id: 'appliances',
    name: 'Home Appliances',
    itemCount: '1,250+ Curated Products',
    image: '/images/cat_appliances.jpg',
    badge: 'ESSENTIAL',
    discount: 'Upto 45% OFF',
  },
  {
    id: 'beauty',
    name: 'Beauty & Skincare',
    itemCount: '1,560+ Curated Products',
    image: '/images/cat_beauty.jpg',
    badge: 'POPULAR',
    discount: 'Upto 55% OFF',
  },
  {
    id: 'gaming',
    name: 'Gaming Consoles',
    itemCount: '940+ Curated Products',
    image: '/images/cat_gaming.jpg',
    badge: 'PRO TECH',
    discount: 'Upto 35% OFF',
  },
  {
    id: 'smartgadgets',
    name: 'Smart Gadgets',
    itemCount: '1,680+ Curated Products',
    image: '/images/cat_watches_new.jpg',
    badge: 'POPULAR',
    discount: 'Flash Sale: Up to 75% OFF',
  },
  {
    id: 'home',
    name: 'Home & Kitchen',
    itemCount: '2,100+ Curated Products',
    image: '/images/cat_appliances.jpg',
    badge: 'BULK READY',
    discount: 'Upto 40% OFF',
  },
  {
    id: 'all',
    name: 'Explore All Catalogs...',
    itemCount: '100k+ Catalog',
    isBrowseAll: true,
    badge: 'VIEW ALL',
    discount: 'All Direct Tiers',
    collageImages: [
      '/images/cat_mobiles.jpg',
      '/images/cat_watches_new.jpg',
      '/images/cat_shoes.jpg',
      '/images/boat_airdopes.png',
    ],
  },
]

const ROWS = []
for (let i = 0; i < CATEGORIES.length; i += 2) ROWS.push(CATEGORIES.slice(i, i + 2))

export function CategorySection({ onSelectCategory }) {
  const router = useRouter()

  const handleClick = (cat) => {
    if (cat.id === 'all') {
      router.push(USER_ROUTES.CATEGORIES)
    } else if (onSelectCategory) {
      onSelectCategory(cat.id)
    } else {
      router.push(userPath.listing({ category: cat.id || cat._id }))
    }
  }

  return (
    <View style={styles.section}>
      {/* Top header row */}
      <View style={styles.header}>
        <View>
          <View style={styles.titleRow}>
            <Text style={styles.title}>Top Categories</Text>
            <View style={styles.countPill}>
              <Text style={styles.countPillText}>12+ Collections</Text>
            </View>
          </View>
          <Text style={styles.subtitle}>A premium catalog curated for high-margin dropshipping & bulk buying</Text>
        </View>

        <Pressable
          onPress={() => router.push(USER_ROUTES.CATEGORIES)}
          style={({ pressed }) => [styles.viewAll, shadows.xs, pressed && { backgroundColor: colors.blue[700] }]}
        >
          <Text style={styles.viewAllText}>View All Collections</Text>
        </Pressable>
      </View>

      {/* Category cards grid */}
      <View style={{ gap: 16 }}>
        {ROWS.map((row) => (
          <View key={row[0].id} style={{ flexDirection: 'row', gap: 16 }}>
            {row.map((cat) => (
              <Pressable
                key={cat.id}
                onPress={() => handleClick(cat)}
                style={({ pressed }) => [styles.card, shadows['2xs'], pressed && { borderColor: colors.blue[400] }]}
              >
                {({ pressed }) => (
                  <>
                    <View style={styles.badgeRow}>
                      <View style={[styles.badge, pressed && { backgroundColor: colors.blue[600] }]}>
                        <Text style={[styles.badgeText, pressed && { color: '#fff' }]}>{cat.badge}</Text>
                      </View>
                    </View>

                    {cat.isBrowseAll ? (
                      <View style={styles.collage}>
                        {[0, 2].map((start) => (
                          <View key={start} style={{ flex: 1, flexDirection: 'row', gap: 4 }}>
                            {cat.collageImages.slice(start, start + 2).map((imgUrl, idx) => (
                              <View key={idx} style={styles.collageCell}>
                                <SmartImage src={imgUrl} alt="" ratio="1 / 1" fit="cover" />
                              </View>
                            ))}
                          </View>
                        ))}
                      </View>
                    ) : (
                      <SmartImage
                        src={cat.image}
                        alt={cat.name}
                        ratio="4 / 3"
                        fit="cover"
                        style={{ marginVertical: 4, width: '100%', borderRadius: radius.xl }}
                      />
                    )}

                    <View style={{ marginTop: 4 }}>
                      <View style={[styles.offer, pressed && { backgroundColor: colors.blue[50], borderColor: colors.blue[200] }]}>
                        <Text numberOfLines={1} style={[styles.offerText, pressed && { color: colors.blue[700] }]}>
                          {cat.discount}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.titleBlock}>
                      <Text numberOfLines={1} style={[styles.name, pressed && { color: colors.blue[600] }]}>
                        {cat.name}
                      </Text>
                      <View style={styles.countRow}>
                        <Text numberOfLines={1} style={styles.count}>
                          {cat.itemCount}
                        </Text>
                        <Icon
                          name="HiArrowRight"
                          size={14}
                          color={pressed ? colors.blue[600] : colors.slate[400]}
                          style={{ marginLeft: 4 }}
                        />
                      </View>
                    </View>
                  </>
                )}
              </Pressable>
            ))}
          </View>
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  section: { width: '100%', gap: 20, marginVertical: 24 },
  header: { gap: 16 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { fontSize: 20, lineHeight: 28, fontWeight: '700', letterSpacing: -0.5, color: colors.slate[900] },
  countPill: {
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: colors.blue[100],
    backgroundColor: colors.blue[50],
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  countPillText: { fontSize: 12, lineHeight: 16, fontWeight: '600', letterSpacing: 0.3, color: colors.blue[700] },
  subtitle: { fontSize: 12, lineHeight: 16, fontWeight: '400', color: colors.slate[500], marginTop: 4 },
  viewAll: {
    alignSelf: 'flex-start',
    borderRadius: 9999,
    backgroundColor: colors.blue[600],
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  viewAllText: { fontSize: 12, lineHeight: 16, fontWeight: '600', color: '#fff' },
  card: {
    flex: 1,
    justifyContent: 'space-between',
    borderRadius: radius['2xl'],
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.9)',
    backgroundColor: '#fff',
    padding: 14,
  },
  badgeRow: { flexDirection: 'row', alignItems: 'center', width: '100%', marginBottom: 4 },
  badge: { borderRadius: radius.md, backgroundColor: colors.slate[100], paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { fontSize: 9, lineHeight: 16, fontWeight: '800', letterSpacing: 0.45, color: colors.slate[600], textTransform: 'uppercase' },
  collage: {
    width: '100%',
    aspectRatio: 4 / 3,
    gap: 4,
    padding: 4,
    marginVertical: 4,
    overflow: 'hidden',
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.slate[100],
    backgroundColor: colors.slate[50],
  },
  collageCell: { flex: 1, overflow: 'hidden', borderRadius: radius.lg, backgroundColor: '#fff' },
  offer: {
    width: '100%',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.6)',
    backgroundColor: colors.slate[50],
    paddingVertical: 4,
    paddingHorizontal: 6,
    alignItems: 'center',
  },
  offerText: { fontSize: 10, lineHeight: 16, fontWeight: '700', letterSpacing: -0.25, color: colors.slate[700] },
  titleBlock: {
    marginTop: 8,
    paddingTop: 10,
    gap: 2,
    borderTopWidth: 1,
    borderTopColor: colors.slate[100],
  },
  name: { fontSize: 12, lineHeight: 16, fontWeight: '700', letterSpacing: -0.3, color: colors.slate[900] },
  countRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  count: { flex: 1, fontSize: 11, lineHeight: 16, fontWeight: '500', color: colors.slate[500] },
})
