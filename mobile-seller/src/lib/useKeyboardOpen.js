import { useEffect, useState } from 'react'
import { Keyboard, Platform } from 'react-native'

// Is the on-screen keyboard up? (Native counterpart of lib/useKeyboardOpen.js.)
export function useKeyboardOpen() {
  const [isOpen, setIsOpen] = useState(Keyboard.isVisible?.() ?? false)
  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setIsOpen(true))
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setIsOpen(false))
    return () => {
      show.remove()
      hide.remove()
    }
  }, [])
  return isOpen
}
