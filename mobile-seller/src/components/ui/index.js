// Barrel for the seller app's UI primitives (same names and props as frontend/src/components/ui).
//
// FORM EVENT CONVENTION - keeps ported web screens mechanical:
//   The web does `onChange={(e) => setX(e.target.value)}` / `(e) => setOn(e.target.checked)`.
//   Input, Textarea, PasswordInput and Select call `onChange({ target: { value } })` (Select's value is
//   a string, like a DOM <select>); Checkbox and Switch call `onChange({ target: { checked } })`.
//   They ALSO accept the React Native style: `onChangeText(value)` (Input/Textarea/PasswordInput/Select)
//   and `onValueChange(valueOrBool)` (Select/Checkbox/Switch). Use either; both fire if both are passed.
//   Input `type` ("number" | "tel" | "email" | "url" | "password") sets the keyboard. `value` may be a
//   number. RadioGroup/RadioCards/Tabs call `onChange(value|id)` exactly as on the web. Button accepts
//   `onClick` as an alias of `onPress`. Style overrides use `style` / `containerStyle` (never className).
export { Button } from './Button'
export { Input } from './Input'
export { PasswordInput } from './PasswordInput'
export { Textarea } from './Textarea'
export { Select } from './Select'
export { Checkbox } from './Checkbox'
export { RadioGroup, RadioCards } from './Radio'
export { Switch } from './Switch'
export { Modal } from './Modal'
export { Table } from './Table'
export { Badge } from './Badge'
export { Avatar } from './Avatar'
export { Card, CardHeader, CardBody, CardFooter } from './Card'
export { Tabs, SegmentedControl } from './Tabs'
export { Tooltip } from './Tooltip'
export { Pagination } from './Pagination'
export { Skeleton } from './Skeleton'
export { EmptyState } from './EmptyState'
export { Icon, ICON_NAMES } from './Icon'
export { Text } from './Text'
export { Sheet } from './Sheet'
export { SmartImage, DEFAULT_PRODUCT_IMAGE, resolveImageSource, pickFromSrcSet } from './SmartImage'
export { AsyncBoundary, ErrorState, EmptyResult, ProductGridSkeleton, ListSkeleton } from './AsyncBoundary'
export { ToastHost } from './ToastHost'
