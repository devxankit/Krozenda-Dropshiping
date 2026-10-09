// Native replacement for <input type="file" accept="image/*" multiple>. Resolves to an array of
// { uri, name, type } (the shape React Native's FormData uploads), [] when cancelled.
import * as ImagePicker from 'expo-image-picker'

const EXT_TYPES = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif' }

function nameOf(asset, index) {
  if (asset.fileName) return asset.fileName
  const last = String(asset.uri || '').split('/').pop()
  return last && last.includes('.') ? last : `photo-${Date.now()}-${index}.jpg`
}

function typeOf(name, given) {
  if (given) return given
  return EXT_TYPES[String(name).split('.').pop().toLowerCase()] || 'image/jpeg'
}

export async function pickImages({ multiple = true } = {}) {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: multiple,
    quality: 0.9,
  })
  if (result.canceled || !result.assets?.length) return []
  return result.assets.map((asset, index) => {
    const name = nameOf(asset, index)
    return { uri: asset.uri, name, type: typeOf(name, asset.mimeType) }
  })
}

export function appendImage(formData, field, file) {
  formData.append(field, { uri: file.uri, name: file.name, type: file.type })
}
