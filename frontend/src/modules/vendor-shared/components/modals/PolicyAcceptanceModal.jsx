import { useEffect, useRef, useState } from 'react'
import { HiCheckCircle, HiOutlineArrowDown } from 'react-icons/hi2'
import { Modal } from '../../../../components/ui'
import { PolicyContent } from '../../../../components/common/PolicyContent'
import { useSellerPoliciesController } from '../../controllers/useVendorController'

// Shows every mandatory CMS policy one after another in a single scroll.
// Accept stays disabled until the seller has scrolled past the last one; it
// then accepts them all at once and onAccepted fires with the versions
// agreed to.
//
// The documents scroll with the modal body itself, so "read to the end" is an
// end-of-documents marker coming into view rather than a scrollTop check on a
// container we don't own.
//
// Mount it only while open (the parent renders it conditionally), so every
// opening starts again with nothing read.
export function PolicyAcceptanceModal({ onClose, onAccepted }) {
  const policies = useSellerPoliciesController()

  const [reachedEnd, setReachedEnd] = useState(false)
  const sectionRefs = useRef({})
  const endRef = useRef(null)

  const docs = policies.data || []

  // Policies short enough to fit without scrolling are "read" as soon as they
  // render.
  useEffect(() => {
    const end = endRef.current
    if (!end) return undefined
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setReachedEnd(true)
    })
    observer.observe(end)
    return () => observer.disconnect()
  }, [docs.length])

  function handleAccept() {
    onAccepted(docs.map(({ slug, title, version }) => ({ slug, title, version })))
  }

  function jumpTo(slug) {
    sectionRefs.current[slug]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const footer = docs.length ? (
    <>
      <button
        type="button"
        onClick={onClose}
        className="py-2 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold"
      >
        Cancel
      </button>
      <button
        type="button"
        onClick={handleAccept}
        disabled={!reachedEnd}
        title={reachedEnd ? undefined : 'Scroll to the end of the policies to accept'}
        className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-xl text-xs disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {docs.length > 1 ? `I Accept All ${docs.length} & Continue` : 'I Accept & Continue'}
      </button>
    </>
  ) : null

  return (
    <Modal
      isOpen
      onClose={onClose}
      size="xl"
      closeOnOverlayClick={false}
      title="Seller Policies & Agreements"
      description="Please read all the documents below to the end and accept them to continue your registration."
      footer={footer}
    >
      {policies.isLoading && <p className="py-10 text-center text-xs text-slate-500">Loading policies…</p>}

      {policies.isError && (
        <div className="py-10 text-center space-y-3">
          <p className="text-xs text-red-600">Could not load the policies. Please check your connection.</p>
          <button
            type="button"
            onClick={() => policies.refetch()}
            className="py-2 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold"
          >
            Try again
          </button>
        </div>
      )}

      {policies.isSuccess && docs.length === 0 && (
        <div className="py-10 text-center space-y-3">
          <p className="text-xs text-slate-600">There are no policies to accept right now.</p>
          <button
            type="button"
            onClick={() => onAccepted([])}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-xl text-xs"
          >
            Continue
          </button>
        </div>
      )}

      {docs.length > 0 && (
        <div className="space-y-4">
          {/* Quick links to each document */}
          <ol className="flex flex-wrap gap-1.5">
            {docs.map((doc) => (
              <li key={doc.slug}>
                <button
                  type="button"
                  onClick={() => jumpTo(doc.slug)}
                  className="rounded-lg border border-blue-200 bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-700 hover:bg-blue-100"
                >
                  {doc.title}
                </button>
              </li>
            ))}
          </ol>

          <p
            className={`flex items-center gap-1.5 text-[11px] font-semibold ${
              reachedEnd ? 'text-emerald-600' : 'text-amber-600'
            }`}
          >
            {reachedEnd ? (
              <>
                <HiCheckCircle className="h-4 w-4" /> You have read all the documents. You can accept them now.
              </>
            ) : (
              <>
                <HiOutlineArrowDown className="h-4 w-4" /> Scroll to the end of all the documents to enable “I Accept”.
              </>
            )}
          </p>

          {docs.map((doc) => (
            <section
              key={doc.slug}
              ref={(el) => {
                sectionRefs.current[doc.slug] = el
              }}
              className="scroll-mt-2 space-y-2"
            >
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="text-sm font-bold text-slate-900">{doc.title}</h3>
                <span className="shrink-0 text-[11px] text-slate-500">
                  {doc.version}
                  {doc.updatedAt ? ` · Updated ${doc.updatedAt}` : ''}
                </span>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3">
                <PolicyContent content={doc.content} />
              </div>
            </section>
          ))}

          <div ref={endRef} aria-hidden="true" className="h-px" />
        </div>
      )}
    </Modal>
  )
}
