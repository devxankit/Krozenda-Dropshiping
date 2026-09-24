import { useEffect, useState } from 'react'
import { HiArrowLeft, HiPlus, HiCheck, HiShieldCheck, HiChevronRight } from 'react-icons/hi2'
import { useNavigate } from 'react-router-dom'
import { WebHeader } from '../../../../components/layout/WebHeader'
import { BottomNavbar } from '../../../../components/layout/BottomNavbar'
import { useAddressesController } from '../../controllers/useAddressesController'
import { AddressFormModal } from '../profile/AddressFormModal'
import { useCheckoutStore } from '../../../../lib/checkoutStore'
import { USER_ROUTES } from '../../../../config/routes'
import { usePageMeta } from '../../../../lib/usePageMeta'
import { CheckoutStepper } from './CheckoutStepper'

export function SelectAddressScreen() {
  const navigate = useNavigate()
  const { addresses, isLoading, createAddress, isCreating } = useAddressesController()
  const selectedAddressId = useCheckoutStore((s) => s.selectedAddressId)
  const setSelectedAddressId = useCheckoutStore((s) => s.setSelectedAddressId)
  const [showAddForm, setShowAddForm] = useState(false)

  usePageMeta({ title: 'Delivery Address - Checkout', noindex: true })

  const onBack = () => navigate(USER_ROUTES.CART)
  const onSelectAddress = () => navigate(USER_ROUTES.CHECKOUT_SUMMARY)

  // Default to the buyer's default address the first time this screen sees a
  // real address list (e.g. arriving fresh from the cart).
  //
  // The second branch matters just as much: the id is persisted across a
  // WebView reload, so it can point at an address the buyer has since deleted
  // from another screen. Left alone, checkout would then send an id the server
  // rejects with "Delivery address not found" and no way to see why.
  useEffect(() => {
    if (isLoading || addresses.length === 0) return
    const stillExists = addresses.some((a) => a.id === selectedAddressId)
    if (!selectedAddressId || !stillExists) {
      const defaultAddress = addresses.find((a) => a.isDefault) || addresses[0]
      setSelectedAddressId(defaultAddress.id)
    }
  }, [addresses, isLoading, selectedAddressId, setSelectedAddressId])

  const selectedAddress = addresses.find((a) => a.id === selectedAddressId) || addresses[0]

  const handleCreate = async (values) => {
    const created = await createAddress(values)
    setSelectedAddressId(created.id)
  }

  return (
    <div className="w-full min-h-screen bg-slate-50 flex flex-col justify-between text-slate-800 font-sans">
      <div className="sticky top-0 z-50 hidden md:block"><WebHeader /></div>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-4 md:py-8 pb-28 md:pb-12 space-y-6">
        <CheckoutStepper current={1} />

        {/* 2-Column Split Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8 items-start">
          {/* Left Column: Address Selection */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
              <div className="flex items-center space-x-3">
                <button onClick={onBack} className="p-1.5 rounded-full hover:bg-slate-100 text-slate-700">
                  <HiArrowLeft className="w-5 h-5" />
                </button>
                <h1 className="text-base sm:text-xl font-black text-slate-900">Select Delivery Address</h1>
              </div>
              <button
                onClick={() => setShowAddForm(true)}
                className="bg-blue-50 text-blue-700 hover:bg-blue-100 px-3 py-2 rounded-xl text-xs font-bold flex items-center space-x-1 transition-colors"
              >
                <HiPlus className="w-4 h-4" />
                <span className="hidden sm:inline">Add New Address</span>
                <span className="sm:hidden">Add New</span>
              </button>
            </div>

            {isLoading ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-xs font-semibold text-slate-400">
                Loading your addresses...
              </div>
            ) : addresses.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-3">
                <p className="text-sm font-bold text-slate-900">No saved addresses yet</p>
                <button
                  onClick={() => setShowAddForm(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-colors"
                >
                  Add Your First Address
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {addresses.map((item) => {
                  const isSelected = selectedAddressId === item.id
                  return (
                    <div
                      key={item.id}
                      onClick={() => setSelectedAddressId(item.id)}
                      className={`p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer ${
                        isSelected
                          ? 'border-blue-600 bg-blue-50/40 ring-2 ring-blue-500/20 shadow-md'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2.5">
                          <div
                            className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                              isSelected ? 'border-blue-600 bg-blue-600' : 'border-slate-300'
                            }`}
                          >
                            {isSelected && <div className="w-2 h-2 bg-white rounded-full" />}
                          </div>
                          <span className="text-xs sm:text-sm font-bold text-slate-900 capitalize">{item.type}</span>
                          {item.isDefault && (
                            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 font-extrabold text-[9px] uppercase rounded-full">
                              Default
                            </span>
                          )}
                        </div>
                        {isSelected && <HiCheck className="w-5 h-5 text-blue-600 shrink-0" />}
                      </div>
                      <div className="pl-7 text-xs text-slate-600 space-y-1">
                        <p className="font-bold text-slate-900 text-xs sm:text-sm">{item.fullName}</p>
                        <p className="leading-relaxed">
                          {item.line1}
                          {item.line2 ? `, ${item.line2}` : ''}, {item.city}, {item.state} - {item.pincode}
                        </p>
                        <p className="font-semibold text-slate-700">{item.phone}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Right Column: Selected Shipping Summary & Action */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-6 shadow-md space-y-5 lg:sticky lg:top-24">
              <h3 className="text-sm sm:text-base font-black text-slate-900 border-b border-slate-100 pb-3">
                Selected Shipping Destination
              </h3>

              {selectedAddress ? (
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/60 space-y-2 text-xs">
                  <span className="text-[10px] font-extrabold text-blue-700 uppercase tracking-wider block">
                    {selectedAddress.type} Address
                  </span>
                  <p className="font-bold text-slate-900 text-xs sm:text-sm">{selectedAddress.fullName}</p>
                  <p className="text-slate-600 leading-relaxed">
                    {selectedAddress.line1}
                    {selectedAddress.line2 ? `, ${selectedAddress.line2}` : ''}, {selectedAddress.city}, {selectedAddress.state} - {selectedAddress.pincode}
                  </p>
                  <p className="font-semibold text-slate-800 pt-1">{selectedAddress.phone}</p>
                </div>
              ) : (
                <p className="text-xs text-slate-500">Select or add an address to continue.</p>
              )}

              <div className="bg-emerald-50 p-3.5 rounded-2xl border border-emerald-100 flex items-center space-x-2 text-[11px] font-semibold text-emerald-800">
                <HiShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>Pan-India Doorstep Delivery with Live Tracking</span>
              </div>

              <button
                onClick={() => selectedAddress && onSelectAddress(selectedAddress)}
                disabled={!selectedAddress}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 active:scale-[0.98] text-white font-bold py-4 px-4 rounded-2xl shadow-md transition-all text-xs tracking-wide flex items-center justify-center space-x-2"
              >
                <span>Deliver to this Address</span>
                <HiChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </main>

      <AddressFormModal
        open={showAddForm}
        onClose={() => setShowAddForm(false)}
        onSubmit={handleCreate}
        isSubmitting={isCreating}
      />

      {/* Mobile Bottom Navigation Bar */}
      <div className="fixed inset-x-0 bottom-0 z-50 md:hidden">
        <BottomNavbar />
      </div>
    </div>
  )
}
