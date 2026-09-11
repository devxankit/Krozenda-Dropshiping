import { RowActions } from '../components/data'

// Appends the per-row action menu to a column set. Kept here with the other
// column definitions so pages stay free of column shapes.
export function withRowActions(columns, buildItems) {
  return [
    ...columns,
    {
      key: '__actions',
      header: '',
      width: '3.5rem',
      align: 'right',
      cellClassName: 'pr-4',
      headerClassName: 'pr-4',
      render: (row) => <RowActions items={buildItems(row)} />,
    },
  ]
}
