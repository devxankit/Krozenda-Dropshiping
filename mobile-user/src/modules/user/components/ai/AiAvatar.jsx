import { useState } from 'react'
import { View } from 'react-native'
import { Image } from 'expo-image'
import { resolveImageSource } from '../../../../components/ui/SmartImage'
import { AiSparkIcon } from './AiSparkIcon'

const AVATAR = resolveImageSource('/images/ai_assistant_avatar.jpg')

// The round 3D avatar (object-cover, scale-[1.14]) on a slate-900 disc; falls back to the spark icon
// when the image fails (the web's onError swap).
export function AiAvatar({ size, iconSize, style }) {
  const [failed, setFailed] = useState(false)
  return (
    <View
      style={[
        { width: size, height: size, borderRadius: size / 2, overflow: 'hidden', backgroundColor: '#0f172a', alignItems: 'center', justifyContent: 'center' },
        style,
      ]}
    >
      {failed ? (
        <AiSparkIcon size={iconSize} color="#fff" accent="#38BDF8" />
      ) : (
        <Image
          source={AVATAR}
          contentFit="cover"
          style={{ width: size, height: size, transform: [{ scale: 1.14 }] }}
          onError={() => setFailed(true)}
        />
      )}
    </View>
  )
}
