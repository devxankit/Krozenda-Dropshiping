// Semantic name -> react-icons mapping. Nothing outside this file should
// import from 'react-icons/*' directly — call <Icon name="..." /> instead,
// so swapping icon sets later is a one-file change.

import {
  FiHome,
  FiShoppingBag,
  FiPackage,
  FiUsers,
  FiSettings,
  FiLogOut,
  FiSearch,
  FiPlus,
  FiEdit2,
  FiTrash2,
  FiX,
  FiChevronDown,
  FiChevronRight,
  FiMenu,
  FiBell,
  FiCheck,
  FiAlertTriangle,
  FiInfo,
  FiUpload,
  FiDownload,
  FiCalendar,
  FiFilter,
  FiMoreVertical,
} from 'react-icons/fi'

const ICONS = Object.freeze({
  dashboard: FiHome,
  orders: FiShoppingBag,
  products: FiPackage,
  users: FiUsers,
  settings: FiSettings,
  logout: FiLogOut,
  search: FiSearch,
  add: FiPlus,
  edit: FiEdit2,
  delete: FiTrash2,
  close: FiX,
  chevronDown: FiChevronDown,
  chevronRight: FiChevronRight,
  menu: FiMenu,
  notifications: FiBell,
  success: FiCheck,
  warning: FiAlertTriangle,
  info: FiInfo,
  upload: FiUpload,
  download: FiDownload,
  calendar: FiCalendar,
  filter: FiFilter,
  more: FiMoreVertical,
})

export const ICON_NAMES = Object.freeze(Object.keys(ICONS))

export function Icon({ name, className = 'h-4 w-4', ...props }) {
  const Component = ICONS[name]

  if (!Component) {
    if (import.meta.env.DEV) {
      console.warn(`[Icon] Unknown icon name: "${name}". Add it to ICONS in components/ui/Icon.jsx.`)
    }
    return null
  }

  return <Component className={className} {...props} />
}
