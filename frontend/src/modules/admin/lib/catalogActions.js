import { ADMIN_PERMISSIONS, REVIEW_STATUS } from '../constants'

// Row and bulk action sets for the products list. They live here rather than
// in the page because they are behaviour shared by the row menu and the bulk
// bar, and because a page carrying both was twice the size of a screen.

export const productRowActions = ({ open, setStatus, onDelete }) => (row) => [
  { label: 'Open', icon: 'externalLink', onSelect: () => open(row) },
  {
    label: 'Approve',
    icon: 'check',
    permission: ADMIN_PERMISSIONS.CATALOG_APPROVE,
    disabled: row.status === REVIEW_STATUS.APPROVED,
    onSelect: () => setStatus(row.id, REVIEW_STATUS.APPROVED),
  },
  {
    label: 'Unpublish',
    icon: 'hide',
    permission: ADMIN_PERMISSIONS.CATALOG_MANAGE,
    disabled: row.status === REVIEW_STATUS.DRAFT,
    onSelect: () => setStatus(row.id, REVIEW_STATUS.DRAFT),
  },
  {
    label: 'Delete listing',
    icon: 'delete',
    tone: 'danger',
    permission: ADMIN_PERMISSIONS.CATALOG_MANAGE,
    // A listing still holding stock would strand it.
    disabled: row.stock > 0,
    onSelect: () => onDelete(row),
  },
]

export const productBulkActions = ({ selectedKeys, setStatus, clearSelection }) => [
  {
    label: 'Approve',
    icon: 'approvals',
    onClick: () => {
      selectedKeys.forEach((id) => setStatus(id, REVIEW_STATUS.APPROVED))
      clearSelection()
    },
  },
  {
    label: 'Unpublish',
    icon: 'hide',
    tone: 'danger',
    onClick: () => {
      selectedKeys.forEach((id) => setStatus(id, REVIEW_STATUS.DRAFT))
      clearSelection()
    },
  },
]
