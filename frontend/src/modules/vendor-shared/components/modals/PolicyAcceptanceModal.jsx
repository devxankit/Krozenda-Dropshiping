import { useCallback, useEffect, useRef, useState } from 'react'
import { HiCheckCircle, HiOutlineArrowDown } from 'react-icons/hi2'
import { Modal } from '../../../../components/ui'
import { PolicyContent } from '../../../../components/common/PolicyContent'
import { useSellerPoliciesController } from '../../controllers/useVendorController'

// How close to the bottom counts as "read to the end". A few pixels of slack
// so sub-pixel rounding on zoomed screens can never strand the button.
const END_SLACK_PX = 24

// Walks the seller through every mandatory CMS policy, one at a time. Accept
// stays disabled until the document has been scrolled to its end; only after
// the last one is accepted does onAccepted fire with the versions agreed to.
//
// Mount it only while open (the parent renders it conditionally), so every
// opening starts again from the first document with nothing accepted.
export function PolicyAcceptanceModal({ onClose, onAccepted }) {
  const policies = useSellerPoliciesController()

  const [index, setIndex] = useState(0)
  // Highest document index scrolled to its end; -1 = none yet.
  const [readIndex, setReadIndex] = useState(-1)
  const [accepted, setAccepted] = useState([])
  const scrollRef = useRef(null)

  const docs = policies.data || []
  const current = docs[index]
  const isLast = index === docs.length - 1
  const reachedEnd = readIndex >= index

  const checkEnd = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - END_SLACK_PX) {
      setReadIndex((prev) => Math.max(prev, index))
    }
  }, [index])

  // New document: back to the top, and re-check — a policy short enough to
  // fit without scrolling is already "read to the end".
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = 0
    const frame = requestAnimationFrame(checkEnd)
    return () => cancelAnimationFrame(frame)
  }, [current?.slug, checkEnd])

  function handleAccept() {
    const next = [...accepted, { slug: current.slug, title: current.title, version: current.version }]
    if (isLast) {
      onAccepted(next)
      return
    }
    setAccepted(next)
    setIndex(index + 1)
  }

  const footer = current ? (
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
        title={reachedEnd ? undefined : 'Scroll to the end of the document to accept'}
        className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-xl text-xs disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLast ? 'I Accept & Continue' : `I Accept — Next (${index + 2}/${docs.length})`}
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
      description="Please read each document to the end and accept it to continue your registration."
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

      {current && (
        <div className="space-y-3">
          {/* Progress across every document */}
          <ol className="flex flex-wrap gap-1.5">
            {docs.map((doc, i) => {
              const done = i < index
              const active = i === index
              return (
                <li
                  key={doc.slug}
                  className={`flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-semibold ${
                    done
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                      : active
                        ? 'border-blue-200 bg-blue-50 text-blue-700'
                        : 'border-slate-200 bg-white text-slate-400'
                  }`}
                >
                  {done && <HiCheckCircle className="h-3.5 w-3.5" />}
                  {doc.title}
                </li>
              )
            })}
          </ol>

          <div className="flex items-baseline justify-between gap-3">
            <h3 className="text-sm font-bold text-slate-900">{current.title}</h3>
            <span className="shrink-0 text-[11px] text-slate-500">
              {current.version}
              {current.updatedAt ? ` · Updated ${current.updatedAt}` : ''}
            </span>
          </div>

          <div
            ref={scrollRef}
            onScroll={checkEnd}
            className="h-[45vh] overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3"
          >
            <PolicyContent content={current.content} />
          </div>

          <p
            className={`flex items-center gap-1.5 text-[11px] font-semibold ${
              reachedEnd ? 'text-emerald-600' : 'text-amber-600'
            }`}
          >
            {reachedEnd ? (
              <>
                <HiCheckCircle className="h-4 w-4" /> You have read this document. You can accept it now.
              </>
            ) : (
              <>
                <HiOutlineArrowDown className="h-4 w-4" /> Scroll to the end of the document to enable “I Accept”.
              </>
            )}
          </p>
        </div>
      )}
    </Modal>
  )
}
