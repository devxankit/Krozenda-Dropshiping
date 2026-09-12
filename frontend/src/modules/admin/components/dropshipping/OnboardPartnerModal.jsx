import { VendorFormDrawer } from '../people/VendorFormDrawer'

export function OnboardPartnerModal({ isOpen, onClose, onAddPartner }) {
  return (
    <VendorFormDrawer
      isOpen={isOpen}
      onClose={onClose}
      onSubmit={(newVendor) => onAddPartner?.(newVendor)}
    />
  )
}

