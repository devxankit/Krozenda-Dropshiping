import { useState } from 'react'
import { Button, Input, Modal, Select, Switch } from '../../../../components/ui'
import { toast } from '../../stores/toastStore'

export function MarginRuleModal({ isOpen, onClose, onAddRule }) {
  const [formData, setFormData] = useState({
    ruleName: '',
    scope: 'category',
    targetName: '',
    commissionType: 'percentage',
    value: '15',
    manualOverrideAllowed: true,
  })

  function handleSubmit(e) {
    e.preventDefault()
    if (!formData.ruleName || !formData.targetName) {
      toast.error('Missing Required Fields', 'Please fill in rule name and target name.')
      return
    }

    const newRule = {
      id: `cm-rule-${Math.floor(100 + Math.random() * 900)}`,
      ruleName: formData.ruleName,
      scope: formData.scope,
      targetName: formData.targetName,
      commissionType: formData.commissionType,
      value: parseFloat(formData.value) || 15.0,
      manualOverrideAllowed: formData.manualOverrideAllowed,
      status: 'active',
    }

    onAddRule?.(newRule)
    toast.success(
      'Margin Rule Created',
      `Rule "${formData.ruleName}" was added to commission resolution hierarchy.`,
    )
    onClose()
    setFormData({
      ruleName: '',
      scope: 'category',
      targetName: '',
      commissionType: 'percentage',
      value: '15',
      manualOverrideAllowed: true,
    })
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add Dropship Margin Rule"
      description="Configure platform commission rates following resolution hierarchy (PRD §6.5): Product → Vendor → Category → Company → Default Minimum."
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} icon="add">
            Save rule
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="Rule Identifier / Name"
          placeholder="e.g. Footwear Category Preferred Margin"
          value={formData.ruleName}
          onChange={(e) => setFormData({ ...formData, ruleName: e.target.value })}
          required
        />

        <div className="grid gap-3 sm:grid-cols-2">
          <Select
            label="Resolution Scope"
            value={formData.scope}
            onChange={(e) => setFormData({ ...formData, scope: e.target.value })}
            options={[
              { value: 'product', label: 'Product-wise (Most Specific)' },
              { value: 'vendor', label: 'Vendor / Partner-wise' },
              { value: 'category', label: 'Category-wise' },
              { value: 'company', label: 'Company-wise' },
              { value: 'default', label: 'Minimum Default' },
            ]}
          />
          <Input
            label="Target Name / Category / SKU"
            placeholder="e.g. Footwear & Apparel"
            value={formData.targetName}
            onChange={(e) => setFormData({ ...formData, targetName: e.target.value })}
            required
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Select
            label="Commission Calculation Type"
            value={formData.commissionType}
            onChange={(e) => setFormData({ ...formData, commissionType: e.target.value })}
            options={[
              { value: 'percentage', label: 'Percentage (%)' },
              { value: 'fixed', label: 'Fixed Rupee Amount (₹)' },
            ]}
          />
          <Input
            label="Rate Value"
            type="number"
            placeholder="15"
            value={formData.value}
            onChange={(e) => setFormData({ ...formData, value: e.target.value })}
            required
          />
        </div>

        <div className="flex items-center justify-between rounded-md border border-border p-3">
          <div>
            <p className="text-xs font-semibold text-slate-900">Allow Manual Override</p>
            <p className="text-2xs text-ink-subtle">
              Admin can manually override calculated margin per product.
            </p>
          </div>
          <Switch
            checked={formData.manualOverrideAllowed}
            onChange={(val) => setFormData({ ...formData, manualOverrideAllowed: val })}
          />
        </div>
      </form>
    </Modal>
  )
}
