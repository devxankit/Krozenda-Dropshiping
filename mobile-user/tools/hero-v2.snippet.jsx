// Vector illustration for the hero (right side): parcel box, delivery truck, phone with a shop UI,
// paper plane and map pins - drawn with react-native-svg, no raster assets.
function HeroIllustration({ width = 190 }) {
  const h = width * 0.86
  return (
    <Svg width={width} height={h} viewBox="0 0 190 164" pointerEvents="none">
      <Defs>
        <LinearGradient id="ilBox" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#fcd9a8" />
          <Stop offset="1" stopColor="#e7a867" />
        </LinearGradient>
        <LinearGradient id="ilTruck" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#8b5cf6" />
          <Stop offset="1" stopColor="#5b21b6" />
        </LinearGradient>
        <LinearGradient id="ilPhone" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#ffffff" />
          <Stop offset="1" stopColor="#e0e7ff" />
        </LinearGradient>
      </Defs>

      {/* soft ground glow */}
      <Ellipse cx="100" cy="150" rx="82" ry="9" fill="#1e1b4b" opacity="0.28" />

      {/* map pins */}
      <Path d="M150 18c-5 0-9 4-9 9 0 7 9 15 9 15s9-8 9-15c0-5-4-9-9-9z" fill="#c4b5fd" opacity="0.9" />
      <Circle cx="150" cy="27" r="3.2" fill="#fff" />
      <Path d="M112 52c-4 0-7 3-7 7 0 5 7 12 7 12s7-7 7-12c0-4-3-7-7-7z" fill="#a5b4fc" opacity="0.85" />
      <Circle cx="112" cy="59" r="2.4" fill="#fff" />

      {/* dotted route */}
      <Path d="M30 112 C 60 70, 90 96, 112 66" stroke="#c7d2fe" strokeWidth="1.6" strokeDasharray="3 5" fill="none" opacity="0.8" />

      {/* phone */}
      <Rect x="112" y="30" width="62" height="104" rx="11" fill="#312e81" />
      <Rect x="115.5" y="33.5" width="55" height="97" rx="8.5" fill="url(#ilPhone)" />
      <Rect x="132" y="36.5" width="23" height="4" rx="2" fill="#312e81" opacity="0.85" />
      <Circle cx="143" cy="52" r="8.5" fill="#6366f1" />
      <Path d="M138.5 49.5h1.8l1.3 6h5.6l1.1-4.4h-7.4" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Circle cx="141.8" cy="58" r="1" fill="#fff" />
      <Circle cx="146.8" cy="58" r="1" fill="#fff" />
      <Rect x="120" y="68" width="22" height="22" rx="6" fill="#ede9fe" />
      <Rect x="144" y="68" width="22" height="22" rx="6" fill="#fce7f3" />
      <Rect x="120" y="93" width="22" height="22" rx="6" fill="#dbeafe" />
      <Rect x="144" y="93" width="22" height="22" rx="6" fill="#fef3c7" />
      <Rect x="124" y="75" width="14" height="8" rx="3" fill="#8b5cf6" />
      <Circle cx="155" cy="79" r="5" fill="#ec4899" />
      <Rect x="124" y="100" width="14" height="8" rx="3" fill="#3b82f6" />
      <Rect x="148" y="100" width="14" height="8" rx="3" fill="#f59e0b" />

      {/* parcel box */}
      <Path d="M18 78 L58 64 L98 78 L98 118 L58 134 L18 118 Z" fill="url(#ilBox)" />
      <Path d="M18 78 L58 92 L98 78 L58 64 Z" fill="#fde9c9" />
      <Path d="M58 92 L58 134 L18 118 L18 78 Z" fill="#e0a05e" opacity="0.55" />
      <Path d="M48 70 L68 78 L68 96 L48 88 Z" fill="#fff" opacity="0.5" />
      <Rect x="30" y="98" width="20" height="13" rx="3" fill="#4f46e5" transform="rotate(14 40 104)" />
      <Path d="M36 107l3-6 3 3 3-5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" transform="rotate(14 40 104)" />

      {/* truck */}
      <Rect x="42" y="118" width="86" height="26" rx="5" fill="url(#ilTruck)" />
      <Path d="M128 124h14c3 0 5 1.6 6.6 4.2l5.4 8.8c.8 1.3 1.2 2.8 1.2 4.3V144h-27z" fill="#ede9fe" />
      <Path d="M133 128h9c1.6 0 2.8.7 3.6 2l3 5h-15.6z" fill="#7dd3fc" />
      <Rect x="42" y="141" width="106" height="4" rx="2" fill="#1e1b4b" opacity="0.5" />
      <Circle cx="66" cy="146" r="8" fill="#0f0a3c" />
      <Circle cx="66" cy="146" r="3.4" fill="#cbd5e1" />
      <Circle cx="132" cy="146" r="8" fill="#0f0a3c" />
      <Circle cx="132" cy="146" r="3.4" fill="#cbd5e1" />
      {/* speed lines */}
      <Path d="M8 124h22M2 132h26M10 140h20" stroke="#c7d2fe" strokeWidth="2" strokeLinecap="round" opacity="0.7" />

      {/* paper plane */}
      <G transform="translate(8 14) rotate(-14 30 20)">
        <Path d="M2 20 L58 2 L36 38 L28 24 Z" fill="#fff" />
        <Path d="M28 24 L58 2 L34 28 Z" fill="#c7d2fe" />
        <Path d="M28 24 L30 36 L36 38 Z" fill="#a5b4fc" />
      </G>
    </Svg>
  )
}

function HeroBanner({ level = 3 }) {
  const float = useLoop(3200, { alternate: true })
  const [box, setBox] = useState({ width: 0, height: 0 })
  return (
    <View style={[styles.hero, level < 3 && { paddingTop: 16, paddingBottom: 40 }]} onLayout={(e) => setBox(e.nativeEvent.layout)}>
      <GradientFill colors={['#4338ca', '#6d28d9', '#7c3aed']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
      <Svg width={box.width} height={box.height} style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <RadialGradient id="heroOrbA" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#22d3ee" stopOpacity="0.4" />
            <Stop offset="1" stopColor="#22d3ee" stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="heroOrbB" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#f0abfc" stopOpacity="0.4" />
            <Stop offset="1" stopColor="#f0abfc" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Circle cx={box.width * 0.05} cy={box.height * 0.1} r={110} fill="url(#heroOrbA)" />
        <Circle cx={box.width * 0.78} cy={box.height * 0.55} r={130} fill="url(#heroOrbB)" />
      </Svg>

      <Speck left={46} top={20} size={4} delay={0} />
      <Speck left={8} top={150} size={3} delay={500} />
      <Speck left={60} top={120} size={3} delay={900} />

      {level >= 2 ? (
        <Animated.View
          pointerEvents="none"
          style={[styles.heroArt, { transform: [{ translateY: float.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }) }] }]}
        >
          <HeroIllustration width={level >= 3 ? 190 : 150} />
        </Animated.View>
      ) : null}

      <View style={styles.heroCopy}>
        <Text style={styles.heroKicker}>WELCOME TO KROZENDA</Text>
        <Text style={styles.heroHeadline}>
          {'Factory-direct prices,\n'}
          <Text style={[styles.heroHeadline, { color: '#ddd6fe' }]}>delivered pan-India</Text>
        </Text>
        {level >= 2 ? (
          <View style={styles.heroChips}>
            {[
              { icon: 'HiBolt', label: '24-48 hr dispatch' },
              { icon: 'HiShieldCheck', label: 'Secure orders' },
            ].map((c) => (
              <View key={c.label} style={styles.heroChip}>
                <Icon name={c.icon} size={14} color="#fde68a" />
                <Text style={styles.heroChipText}>{c.label}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </View>
  )
}

// Soft lavender waves at the very bottom of the page (decoration only).
function BottomWave() {
  const { width } = useWindowDimensions()
  return (
    <Svg width={width} height={70} viewBox="0 0 400 70" preserveAspectRatio="none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }} pointerEvents="none">
      <Path d="M0 38 C 90 8, 170 64, 270 30 S 380 10, 400 22 L400 70 L0 70 Z" fill="#c7d2fe" opacity="0.32" />
      <Path d="M0 50 C 110 24, 200 70, 300 42 S 380 34, 400 40 L400 70 L0 70 Z" fill="#ddd6fe" opacity="0.5" />
    </Svg>
  )
}

