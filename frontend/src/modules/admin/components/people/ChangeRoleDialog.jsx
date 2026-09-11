import { useState } from 'react'
import { Button, Modal, Select } from '../../../../components/ui'
import { useRoleListController } from '../../controllers/useRoleManagementController'

export function ChangeRoleDialog({ isOpen, ...props }) {
  if (!isOpen) return null
  return <ChangeRoleDialogBody {...props} />
}

function ChangeRoleDialogBody({ onClose, staff, onSubmit, isSubmitting }) {
  const roles = useRoleListController()
  const [roleId, setRoleId] = useState(staff?.roleId || '')

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={`Change role — ${staff?.name || ''}`}
      description="Their sidebar access changes to match whatever this role grants."
      size="sm"
      footer={
        <>
          <Button variant="secondary" size="control" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            size="control"
            isLoading={isSubmitting}
            disabled={!roleId}
            onClick={() => onSubmit({ id: staff.id, roleId })}
          >
            Save role
          </Button>
        </>
      }
    >
      <Select
        id="change-role"
        label="Role"
        placeholder={roles.isLoading ? 'Loading roles…' : 'Select a role'}
        options={roles.items.map((item) => ({ value: item.id, label: item.name }))}
        value={roleId}
        onChange={(event) => setRoleId(event.target.value)}
      />
    </Modal>
  )
}
