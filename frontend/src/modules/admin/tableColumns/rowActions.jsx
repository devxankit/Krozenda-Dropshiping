import { RowActions } from '../components/data'

// Appends the per-row action menu to a column set. Kept here with the other
// column definitions so pages stay free of column shapes.
export function withRowActions(columns, buildItems) {
  return [
    ...columns,
    {
      key: '__actions',
      header: '',
      width: '3rem',
      align: 'right',
      render: (row) => <RowActions items={buildItems(row)} />,
    },
  ]
}
