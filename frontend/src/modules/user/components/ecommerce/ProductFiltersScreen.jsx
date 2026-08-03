import React, { useState } from 'react'
import { HiArrowLeft, HiCheck, HiXMark } from 'react-icons/hi2'
import { BottomNavbar } from '../../../../components/layout/BottomNavbar'
import { WebHeader } from '../../../../components/layout/WebHeader'

export function ProductFiltersScreen({
  onBack = () => {},
  onApplyFilters = () => {},
}) {
  const [selectedCategory, setSelectedCategory] = useState('Sports Shoes')
  const [selectedBrands, setSelectedBrands] = useState(['Nike', 'Adidas'])
  const [priceRange, setPriceRange] = useState(5000)
  const [minRating, setMinRating] = useState(4)

  const categories = [
    'Sports Shoes',
    'Casual Shoes',
    'Formal Shoes',
    'Sandals & Floaters',
    'Flip Flops',
  ]

  const brands = ['Nike', 'Adidas', 'Puma', 'Reebok', 'Skechers', 'Woodland']

  const toggleBrand = (brand) => {
    setSelectedBrands((prev) =>
      prev.includes(brand) ? prev.filter((b) => b !== brand) : [...prev, brand]
    )
  }

  const resetFilters = () => {
    setSelectedCategory('Sports Shoes')
    setSelectedBrands([])
    setPriceRange(10000)
    setMinRating(0)
  }

  return (
    <div className="w-full min-h-screen bg-slate-50 flex flex-col justify-between text-slate-800 font-sans">
      {/* DESKTOP WEB HEADER */}
      <div className="hidden md:block">
        <WebHeader />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 pb-24 md:pb-12 max-w-2xl mx-auto w-full md:px-6 md:py-6">
        
        <div className="md:hidden">
          
        </div>

        {/* Top Header */}
        <div className="px-4 py-3 bg-white border-b border-slate-200 flex items-center justify-between shadow-xs">
          <div className="flex items-center space-x-3">
            <button
              onClick={onBack}
              className="p-1.5 rounded-full hover:bg-slate-100 text-slate-700 transition-colors"
            >
              <HiArrowLeft className="w-5 h-5" />
            </button>
            <h2 className="text-base font-bold text-slate-900">Filters</h2>
          </div>
          <button
            onClick={resetFilters}
            className="text-xs font-bold text-blue-600 hover:underline"
          >
            Reset All
          </button>
        </div>

        {/* Filters Body */}
        <div className="p-4 space-y-5">
          {/* Category Filter */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Category
            </h3>

            <div className="flex flex-wrap gap-2">
              {categories.map((cat, idx) => {
                const isSelected = selectedCategory === cat
                return (
                  <button
                    key={idx}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      isSelected
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {cat}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Brand Checklist */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Brand
            </h3>

            <div className="bg-white rounded-2xl border border-slate-200/80 p-3 shadow-xs divide-y divide-slate-100">
              {brands.map((brand, idx) => {
                const isChecked = selectedBrands.includes(brand)
                return (
                  <div
                    key={idx}
                    onClick={() => toggleBrand(brand)}
                    className="py-2.5 flex items-center justify-between cursor-pointer hover:bg-slate-50 px-1 rounded-lg transition-colors"
                  >
                    <span className="text-xs font-semibold text-slate-800">{brand}</span>
                    <div
                      className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                        isChecked
                          ? 'bg-blue-600 border-blue-600 text-white'
                          : 'border-slate-300 bg-white'
                      }`}
                    >
                      {isChecked && <HiCheck className="w-3 h-3 stroke-[3]" />}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Price Range Slider */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Price Range
              </h3>
              <span className="text-xs font-black text-blue-600">
                Up to ₹{priceRange.toLocaleString('en-IN')}
              </span>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs space-y-2">
              <input
                type="range"
                min={500}
                max={20000}
                step={500}
                value={priceRange}
                onChange={(e) => setPriceRange(Number(e.target.value))}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
              <div className="flex justify-between text-[10px] font-semibold text-slate-400">
                <span>₹500</span>
                <span>₹20,000+</span>
              </div>
            </div>
          </div>

          {/* Customer Ratings Filter */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Customer Rating
            </h3>

            <div className="grid grid-cols-4 gap-2">
              {[4, 3, 2, 1].map((rating) => {
                const isSelected = minRating === rating
                return (
                  <button
                    key={rating}
                    onClick={() => setMinRating(rating)}
                    className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                      isSelected
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {rating}★ & above
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Sticky Bottom Apply Button Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-3 shadow-lg z-50 max-w-2xl mx-auto">
        <button
          onClick={onApplyFilters}
          className="w-full bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white font-bold py-3.5 px-4 rounded-xl shadow-md transition-all text-xs tracking-wide"
        >
          Show 842 Results
        </button>
      </div>
    </div>
  )
}
