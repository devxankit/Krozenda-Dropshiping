import { HiArrowLeft, HiArrowDownTray, HiPrinter } from 'react-icons/hi2'
import { useNavigate, useParams } from 'react-router-dom'
import { WebHeader } from '../../../../components/layout/WebHeader'
import { userPath } from '../../../../config/routes'
import { usePageMeta } from '../../../../lib/usePageMeta'
import { useOrderInvoiceController } from '../../controllers/useOrdersController'
import { OrderInvoices } from './TaxInvoiceDocument'

export function InvoicePreviewScreen() {
  const navigate = useNavigate()
  const { orderId } = useParams()
  const { invoice, isLoading, isError } = useOrderInvoiceController(orderId)

  usePageMeta({ title: 'Invoice Preview', noindex: true })

  const onBack = () => navigate(-1)
  const onDownload = (id) => navigate(userPath.order(id))

  if (isLoading) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-slate-50">
        <span className="text-xs font-semibold text-slate-400" role="status">Loading invoice…</span>
      </div>
    )
  }

  if (isError || !invoice) {
    return (
      <div className="w-full min-h-screen bg-slate-50 flex flex-col items-center justify-center text-center px-6 space-y-4">
        <h2 className="text-base font-bold text-slate-900">Invoice unavailable</h2>
        <button onClick={onBack} className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl">
          Back
        </button>
      </div>
    )
  }

  const handleDownload = () => {
    window.print()
    onDownload(orderId)
  }

  return (
    <div className="w-full min-h-screen bg-slate-50 flex flex-col justify-between text-slate-800 font-sans">
      <div className="hidden md:block print:hidden"><WebHeader /></div>

      <div className="flex-1 pb-24 md:pb-12 max-w-3xl mx-auto w-full md:px-6 md:py-6">
        <div className="px-4 py-3 bg-white border-b border-slate-200 flex items-center justify-between shadow-xs print:hidden">
          <div className="flex items-center space-x-3">
            <button onClick={onBack} className="p-1.5 rounded-full hover:bg-slate-100 text-slate-700 transition-colors">
              <HiArrowLeft className="w-5 h-5" />
            </button>
            <h2 className="text-base font-bold text-slate-900">Invoice Preview</h2>
          </div>
          <button onClick={() => window.print()} className="p-1.5 rounded-full hover:bg-slate-100 text-slate-700">
            <HiPrinter className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <OrderInvoices data={invoice} />
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-3 shadow-lg z-50 max-w-3xl mx-auto print:hidden">
        <button
          onClick={handleDownload}
          className="w-full bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white font-bold py-3.5 px-4 rounded-xl shadow-md transition-all text-xs tracking-wide flex items-center justify-center space-x-2"
        >
          <HiArrowDownTray className="w-4 h-4" />
          <span>Download PDF Invoice</span>
        </button>
      </div>

      <div className="md:hidden print:hidden" />
    </div>
  )
}
