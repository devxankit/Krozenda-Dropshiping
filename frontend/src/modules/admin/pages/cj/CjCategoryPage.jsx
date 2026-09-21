import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Icon, Input } from '../../../../components/ui'
import { ADMIN_ROUTES } from '../../../../config/routes'
import { PageBody, PageHeader } from '../../components/shell'
import { ErrorState, PageSkeleton, NoData } from '../../components/feedback'
import { SectionCard } from '../../components/display'
import { useCjCategoriesController } from '../../controllers/useCjController'
import { flattenCjCategories } from '../../tableColumns/cjColumns'

// CJ's own category taxonomy — the FULL tree (14 top-level groups, ~580 leaf
// categories on a live account), not just the ones something has already
// been onboarded into. Browsing this is how an admin finds what to onboard
// next; onboarding itself still only happens from the "Onboard Products"
// screen, which every card here links into pre-filtered.
function leafLink(leaf) {
  return `${ADMIN_ROUTES.CJ_CATALOGUE}?categoryId=${encodeURIComponent(leaf.categoryId)}`
}

function LeafCard({ leaf }) {
  // flattenCjCategories's label is "First > Second > Leaf" — the leaf name
  // alone is the title, the rest is breadcrumb context.
  const parts = leaf.label.split(' > ')
  const title = parts[parts.length - 1]
  const breadcrumb = parts.slice(0, -1).join(' > ')

  return (
    <Link
      to={leafLink(leaf)}
      title={leaf.label}
      className="group flex flex-col gap-0.5 rounded-lg border border-border bg-surface px-3 py-2.5 transition-all hover:border-brand-300 hover:shadow-sm"
    >
      <span className="truncate text-xs font-semibold text-slate-900 group-hover:text-brand-700">{title}</span>
      {breadcrumb && <span className="truncate text-2xs text-ink-muted">{breadcrumb}</span>}
    </Link>
  )
}

export function CjCategoryPage() {
  const { data: categoryTree, isLoading, error } = useCjCategoriesController()
  const [query, setQuery] = useState('')
  const [openFirstId, setOpenFirstId] = useState(null)

  const allLeaves = useMemo(() => flattenCjCategories(categoryTree), [categoryTree])

  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return null
    return allLeaves.filter((leaf) => leaf.label.toLowerCase().includes(q))
  }, [allLeaves, query])

  return (
    <PageBody>
      <PageHeader
        title="CJ Category"
        description="CJ Dropshipping's full category taxonomy — every category CJ offers, not just the ones you've already onboarded from. Open one to browse and onboard its products."
      />

      <SectionCard title="Browse categories">
        <div className="space-y-4 p-4">
          <Input
            id="cjCategorySearch"
            placeholder="Search categories (e.g. “sneakers”, “kitchen”)"
            size="control"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            containerClassName="max-w-sm"
          />

          {error ? (
            <ErrorState error={error} />
          ) : isLoading ? (
            <PageSkeleton rows={3} />
          ) : (categoryTree || []).length === 0 ? (
            <NoData
              message="No categories available"
              hint="Connect a CJ account in Settings to load the category tree."
            />
          ) : searchResults ? (
            searchResults.length === 0 ? (
              <NoData message={`No category matches “${query}”`} />
            ) : (
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {searchResults.map((leaf) => (
                  <LeafCard key={leaf.value} leaf={leaf} />
                ))}
              </div>
            )
          ) : (
            <div className="space-y-2">
              {(categoryTree || []).map((first) => {
                const isOpen = openFirstId === first.categoryFirstId
                const leafCount = (first.categoryFirstList || []).reduce(
                  (sum, second) => sum + (second.categorySecondList || []).length,
                  0,
                )
                return (
                  <div key={first.categoryFirstId} className="rounded-xl border border-border bg-surface">
                    <button
                      type="button"
                      onClick={() => setOpenFirstId(isOpen ? null : first.categoryFirstId)}
                      className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                    >
                      <span className="flex items-center gap-2.5">
                        <Icon name="catalog" className="h-4 w-4 text-brand-600" />
                        <span className="text-sm font-semibold text-slate-900">{first.categoryFirstName}</span>
                        <span className="text-2xs text-ink-muted">
                          {leafCount} categor{leafCount === 1 ? 'y' : 'ies'}
                        </span>
                      </span>
                      <Icon
                        name="chevronRight"
                        className={`h-4 w-4 text-ink-faint transition-transform ${isOpen ? 'rotate-90' : ''}`}
                      />
                    </button>

                    {isOpen && (
                      <div className="space-y-3 border-t border-border-subtle px-4 py-3">
                        {(first.categoryFirstList || []).map((second) => (
                          <div key={second.categorySecondId} className="space-y-2">
                            <p className="text-2xs font-semibold uppercase tracking-wide text-ink-subtle">
                              {second.categorySecondName}
                            </p>
                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                              {(second.categorySecondList || []).map((leaf) => (
                                <Link
                                  key={leaf.categoryId}
                                  to={`${ADMIN_ROUTES.CJ_CATALOGUE}?categoryId=${encodeURIComponent(leaf.categoryId)}`}
                                  className="truncate rounded-lg border border-border-subtle bg-surface-muted px-3 py-2 text-xs font-medium text-slate-700 transition-colors hover:border-brand-300 hover:bg-brand-50/60 hover:text-brand-700"
                                  title={leaf.categoryName}
                                >
                                  {leaf.categoryName}
                                </Link>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </SectionCard>
    </PageBody>
  )
}

export default CjCategoryPage
