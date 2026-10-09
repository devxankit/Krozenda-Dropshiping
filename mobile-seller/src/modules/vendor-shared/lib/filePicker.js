// Native replacement for <input type="file">. Each picker resolves to
// { uri, name, type } (the shape React Native's FormData uploads) or null when cancelled.
// `appendFile` is the equivalent of formData.append(field, file) on the web.
import * as DocumentPicker from 'expo-document-picker'
import * as ImagePicker from 'expo-image-picker'

const EXT_TYPES = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
}

function guessName(uri, fallback) {
  const last = String(uri || '').split('/').pop()
  return last && last.includes('.') ? last : fallback
}

function guessType(name, given) {
  if (given) return given
  const ext = String(name).split('.').pop().toLowerCase()
  return EXT_TYPES[ext] || 'application/octet-stream'
}

export async function pickImageFile() {
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9 })
  if (result.canceled || !result.assets?.length) return null
  const asset = result.assets[0]
  const name = asset.fileName || guessName(asset.uri, 'image.jpg')
  return { uri: asset.uri, name, type: guessType(name, asset.mimeType) }
}

// types: array of MIME types, e.g. ['application/pdf', 'image/*'].
export async function pickDocumentFile(types = ['application/pdf', 'image/*']) {
  const result = await DocumentPicker.getDocumentAsync({ type: types, copyToCacheDirectory: true, multiple: false })
  if (result.canceled || !result.assets?.length) return null
  const asset = result.assets[0]
  const name = asset.name || guessName(asset.uri, 'document')
  return { uri: asset.uri, name, type: guessType(name, asset.mimeType) }
}

export function appendFile(formData, field, file) {
  formData.append(field, { uri: file.uri, name: file.name, type: file.type })
}
