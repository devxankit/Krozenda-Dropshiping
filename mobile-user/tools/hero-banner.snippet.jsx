// A floating glass bubble holding an icon - bobs gently (UI-thread native-driver loop).
function Bubble({ icon, size = 44, tint, left, top, delay = 0, amp = 7, duration = 2400, rotate = 0 }) {
  const v = useLoop(duration, { alternate: true, delay })
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.bubble,
        {
          width: size,
          height: size,
          borderRadius: size * 0.34,
          left: `${left}%`,
          top,
          transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -amp] }) }, { rotate: `${rotate}deg` }],
        },
      ]}
    >
      <View style={[StyleSheet.absoluteFill, { borderRadius: size * 0.34, backgroundColor: tint, opacity: 0.22 }]} />
      <Icon name={icon} size={size * 0.48} color="#fff" />
    </Animated.View>
  )
}

// Twinkling bokeh speck.
function Speck({ left, top, size = 4, delay = 0 }) {
  const v = useLoop(1800 + delay, { alternate: true, delay })
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: `${left}%`,
        top,
        width: size,
        height: size,
        borderRadius: size,
        backgroundColor: '#e0e7ff',
        opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.15, 0.95] }),
        transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1.3] }) }],
      }}
    />
  )
}

function HeroBanner() {
  const float = useLoop(2600, { alternate: true })
  const pulse = useLoop(2200, { alternate: true, delay: 300 })
  const [box, setBox] = useState({ width: 0, height: 0 })
  return (
    <View style={styles.hero} onLayout={(e) => setBox(e.nativeEvent.layout)}>
      <GradientFill colors={['#1e1b4b', '#3730a3', '#6d28d9']} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} />
      <Svg width={box.width} height={box.height} style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <RadialGradient id="heroOrbA" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#22d3ee" stopOpacity="0.5" />
            <Stop offset="1" stopColor="#22d3ee" stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="heroOrbB" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#f0abfc" stopOpacity="0.45" />
            <Stop offset="1" stopColor="#f0abfc" stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="heroOrbC" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#a5b4fc" stopOpacity="0.55" />
            <Stop offset="1" stopColor="#a5b4fc" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Circle cx={box.width * 0.9} cy={10} r={130} fill="url(#heroOrbA)" />
        <Circle cx={box.width * 0.05} cy={box.height * 0.7} r={120} fill="url(#heroOrbB)" />
        <Circle cx={box.width * 0.5} cy={92} r={110} fill="url(#heroOrbC)" />
      </Svg>

      <Speck left={8} top={22} size={5} delay={0} />
      <Speck left={22} top={118} size={3} delay={400} />
      <Speck left={78} top={30} size={4} delay={800} />
      <Speck left={90} top={104} size={3} delay={200} />
      <Speck left={60} top={16} size={3} delay={1000} />
      <Speck left={36} top={8} size={4} delay={600} />

      {/* Illustration stage: logo medallion with a ring of floating commerce bubbles */}
      <View style={styles.stage}>
        <Bubble icon="HiShoppingBag" tint="#fbbf24" left={8} top={22} size={50} delay={0} rotate={-8} />
        <Bubble icon="HiTruck" tint="#22d3ee" left={76} top={14} size={46} delay={500} rotate={7} amp={9} />
        <Bubble icon="HiBuildingStorefront" tint="#f472b6" left={80} top={86} size={42} delay={900} rotate={-6} />
        <Bubble icon="HiTag" tint="#34d399" left={6} top={92} size={38} delay={300} rotate={9} amp={6} />
        <Bubble icon="HiStar" tint="#fde047" left={26} top={2} size={30} delay={700} rotate={0} amp={5} />

        <Animated.View style={[styles.medalRing, { transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] }) }], opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0.15] }) }]} />
        <Animated.View
          style={[styles.heroLogo, { transform: [{ translateY: float.interpolate({ inputRange: [0, 1], outputRange: [0, -5] }) }] }]}
        >
          <Image source={LOGO} style={{ width: 58, height: 58 }} contentFit="contain" />
        </Animated.View>
      </View>

      {/* Glass card with the pitch */}
      <View style={styles.glass}>
        <Text style={styles.heroKicker}>WELCOME TO KROZENDA</Text>
        <Text style={styles.heroHeadline}>
          {'Factory-direct prices,\n'}
          <Text style={[styles.heroHeadline, { color: '#c7d2fe' }]}>delivered pan-India</Text>
        </Text>
        <View style={styles.heroChips}>
          {[
            { icon: 'HiBolt', label: '24-48hr dispatch' },
            { icon: 'HiShieldCheck', label: 'Secure orders' },
          ].map((c) => (
            <View key={c.label} style={styles.heroChip}>
              <Icon name={c.icon} size={13} color="#fde68a" />
              <Text style={styles.heroChipText}>{c.label}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Curved lip that melts the hero into the sheet below */}
      <View style={styles.heroLip} pointerEvents="none" />
    </View>
  )
}

