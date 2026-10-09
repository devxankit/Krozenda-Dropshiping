# kit-ui (A1): ui primitives + shared libs

Status key: Built = written + eslint clean; not run on a device/emulator (no Verified claims).

| Item | Web source | Native file | Status |
|---|---|---|---|
| Badge | ui/Badge.jsx | ui/Badge.jsx | Built, not tested |
| Card/Header/Body/Footer | ui/Card.jsx | ui/Card.jsx | Built, not tested |
| Checkbox (+indeterminate) | ui/Checkbox.jsx | ui/Checkbox.jsx | Built, not tested |
| EmptyState | ui/EmptyState.jsx | ui/EmptyState.jsx | Built, not tested |
| Select (sheet picker) | ui/Select.jsx | ui/Select.jsx (+OptionSheet) | Built, not tested |
| Switch | ui/Switch.jsx | ui/Switch.jsx | Built, not tested |
| Textarea | ui/Textarea.jsx | ui/Textarea.jsx | Built, not tested |
| Tabs, SegmentedControl | ui/Tabs.jsx | ui/Tabs.jsx | Built, not tested |
| Pagination | ui/Pagination.jsx | ui/Pagination.jsx | Built, not tested |
| Table | ui/Table.jsx | ui/Table.jsx | Built, not tested |
| Avatar | ui/Avatar.jsx | ui/Avatar.jsx | Built, not tested |
| RadioGroup, RadioCards | ui/Radio.jsx | ui/Radio.jsx | Built, not tested |
| PasswordInput | ui/PasswordInput.jsx | ui/PasswordInput.jsx | Built, not tested |
| Modal | ui/Modal.jsx | ui/Modal.jsx (uses Sheet variant=center) | Built, not tested |
| Tooltip | ui/Tooltip.jsx | ui/Tooltip.jsx (children only; hover-only on web) | Built |
| fieldStyles | ui/fieldStyles.jsx | ui/fieldStyles.jsx | Built |
| Button / Input reconciled with web | ui/Button.jsx, Input.jsx | existing files edited | Built, not tested |
| Icon: semantic names + ICON_NAMES | ui/Icon.jsx | ui/Icon.jsx, iconData.js regenerated (156) | Built |
| Barrel + onChange convention doc | ui/index.js | ui/index.js | Built |
| format.js | admin/lib/format.js | lib/format.js (manual en-IN grouping) | Built |
| exportCsv.js | admin/lib/exportCsv.js | lib/exportCsv.js (expo-file-system File/Paths + expo-sharing; downloadCsv/downloadTableCsv are async) | Built, not tested |
| useKeyboardOpen.js | lib/useKeyboardOpen.js | lib/useKeyboardOpen.js | Built |
| usePageMeta.js | lib/usePageMeta.js | lib/usePageMeta.js (no-op) | Built |

Unreachable on native: Tooltip popup, hover/focus rings, Modal `size` (all web sizes exceed phone width), Pagination numbered page buttons (`hidden sm:contents`), Toast component (native uses ToastHost).
