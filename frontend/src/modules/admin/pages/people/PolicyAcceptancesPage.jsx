import { ExportMenu, ListScreen } from '../../components/data'
import { InlineAlert } from '../../components/feedback'
import { usePolicyAcceptanceController } from '../../controllers/usePeopleController'
import {
  POLICY_ACCEPTANCE_COLUMNS,
  POLICY_ACCEPTANCE_TABS,
} from '../../tableColumns/peopleColumns'
import { downloadTableCsv } from '../../lib/exportCsv'

// Acceptance is evidence: who agreed, to which VERSION, when, and from which
// IP. Publishing a new policy version supersedes every acceptance of the old
// one — which is what the "needs re-acceptance" tab surfaces.
export function PolicyAcceptancesPage() {
  const list = usePolicyAcceptanceController()
  const superseded = list.tabCounts.superseded || 0

  return (
    <ListScreen
      title="Policy acceptances"
      description="Who accepted which policy version, when, and from where."
      actions={<ExportMenu onExport={() => downloadTableCsv('policy-acceptances.csv', POLICY_ACCEPTANCE_COLUMNS, list.items)} />}
      banner={
        superseded > 0 && (
          <InlineAlert tone="warning" title={`${superseded} acceptances are against a superseded version`}>
            These parties agreed to an earlier version of the policy. They are prompted to
            re-accept on their next sign-in; until they do, the current version is not on record
            for them.
          </InlineAlert>
        )
      }
      controller={list}
      columns={POLICY_ACCEPTANCE_COLUMNS}
      tabs={POLICY_ACCEPTANCE_TABS}
      searchPlaceholder="Party, policy, version or IP…"
      itemLabel="acceptances"
      emptyIcon="file"
      emptyTitle="No acceptances recorded"
    />
  )
}
