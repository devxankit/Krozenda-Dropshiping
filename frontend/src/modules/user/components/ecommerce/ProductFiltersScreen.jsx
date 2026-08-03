import React, { useState } from 'react'
import {
  HiArrowLeft,
  HiCheck,
  HiMagnifyingGlass,
  HiChevronRight,
  HiPlus,
} from 'react-icons/hi2'
import { useNavigate } from 'react-router-dom'
import { WebHeader } from '../../../../components/layout/WebHeader'
import { USER_ROUTES } from '../../../../config/routes'

export function ProductFiltersScreen({
  onBack = () => {},
  onApplyFilters = () => {},
}) {
  const navigate = useNavigate()
  const [selectedCategory, setSelectedCategory] = useState('Sports Shoes')
  const [brandSearch, setBrandSearch] = useState('')
  const [selectedBrands, setSelectedBrands] = useState(['Nike'])
  const [priceRange, setPriceRange] = useState(10000)
  const [selectedRating, setSelectedRating] = useState('4★ & above')

  const categories = [
    'Sports Shoes',
    'Casual Shoes',
    'Formal Shoes',
    'Sandals & Floaters',
  ]

  const brands = ['Nike', 'Adidas', 'Puma', 'Reebok', 'Skechers']
  const ratings = ['4★ & above', '3★ & above', '2★ & above', '1★ & above']

  const toggleBrand = (brand) => {
    setSelectedBrands((prev) =>
      prev.includes(brand) ? prev.filter((b) => b !== brand) : [...prev, brand]
    )
  }

  const resetFilters = () => {
    setSelectedCategory('Sports Shoes')
    setSelectedBrands(['Nike'])
    setPriceRange(10000)
    setSelectedRating('4★ & above')
  }

  const handleApply = () => {
    if (onApplyFilters) {
      onApplyFilters()
    } else {
      navigate(USER_ROUTES.ROOT + '/listing')
    }
  }

  const filteredBrands = brands.filter((b) =>
    b.toLowerCase().includes(brandSearch.toLowerCase())
  )

  return (
    <div className="w-full min-h-screen bg-slate-50 flex flex-col text-slate-800 font-sans">
      <div className="hidden md:block"><WebHeader /></div>

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 sm:px-6 py-4 md:py-8 space-y-6">
        {/* Header Bar */}
        <div className="bg-white p-4 md:p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button onClick={onBack} className="p-1.5 rounded-full hover:bg-slate-100 text-slate-700">
              <HiArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-base md:text-lg font-bold text-slate-900">Filters</h1>
          </div>
          <button
            onClick={resetFilters}
            className="text-xs font-bold text-blue-600 hover:underline"
          >
            Reset
          </button>
        </div>

        {/* Filters Body Box */}
        <div className="bg-white rounded-3xl border border-slate-200/80 p-5 md:p-6 shadow-xs space-y-6">
          {/* Section 1: Categories */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-slate-900">
              <span>Categories</span>
              <span className="text-slate-400 font-medium flex items-center space-x-0.5">
                <span>Shoes</span>
                <HiChevronRight className="w-3.5 h-3.5" />
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {categories.map((cat) => {
                const isSelected = selectedCategory === cat
                return (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-4 py-3 rounded-2xl border text-xs font-bold transition-all flex items-center justify-between ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50/70 text-blue-950 shadow-xs'
                        : 'border-slate-200/80 bg-white text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    <span>{cat}</span>
                    {isSelected && (
                      <div className="w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0 ml-1">
                        <HiCheck className="w-3 h-3 stroke-[3]" />
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Section 2: Brand */}
          <div className="space-y-3 pt-3 border-t border-slate-100">
            <h3 className="text-xs font-bold text-slate-900">Brand</h3>

            {/* Search Brand Input */}
            <div className="flex items-center bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-2.5">
              <HiMagnifyingGlass className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                type="text"
                value={brandSearch}
                onChange={(e) => setBrandSearch(e.target.value)}
                placeholder="Search brand"
                className="w-full px-2 bg-transparent text-xs font-medium text-slate-900 placeholder-slate-400 focus:outline-none"
              />
            </div>

            {/* Brand Checkboxes List */}
            <div className="space-y-2.5 pt-1">
              {filteredBrands.map((brand) => {
                const isChecked = selectedBrands.includes(brand)
                return (
                  <label
                    key={brand}
                    onClick={() => toggleBrand(brand)}
                    className="flex items-center space-x-3 text-xs font-bold text-slate-800 cursor-pointer select-none py-1"
                  >
                    <div
                      className={`w-5 h-5 rounded-lg border flex items-center justify-center transition-all ${
                        isChecked
                          ? 'bg-blue-600 border-blue-600 text-white'
                          : 'border-slate-300 bg-white hover:border-slate-400'
                      }`}
                    >
                      {isChecked && <HiCheck className="w-3.5 h-3.5 stroke-[3]" />}
                    </div>
                    <span>{brand}</span>
                  </label>
                )
              })}
            </div>

            <button className="text-xs font-bold text-blue-600 hover:underline flex items-center space-x-1 pt-1">
              <HiPlus className="w-3.5 h-3.5" />
              <span>View More</span>
            </button>
          </div>

          {/* Section 3: Price Range */}
          <div className="space-y-4 pt-3 border-t border-slate-100">
            <div className="flex items-center justify-between text-xs font-bold text-slate-900">
              <span>Price Range</span>
              <span className="text-slate-500 font-semibold">₹1,000 - ₹10,000+</span>
            </div>

            {/* Range Slider Track */}
            <div className="space-y-2">
              <input
                type="range"
                min="1000"
                max="10000"
                step="500"
                value={priceRange}
                onChange={(e) => setPriceRange(Number(e.target.value))}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />

              <div className="flex items-center justify-between gap-4 pt-2">
                <div className="flex-1 bg-white border border-slate-200 rounded-2xl py-2.5 px-4 text-center text-xs font-bold text-slate-800 shadow-xs">
                  ₹1,000
                </div>
                <div className="flex-1 bg-white border border-slate-200 rounded-2xl py-2.5 px-4 text-center text-xs font-bold text-slate-800 shadow-xs">
                  ₹{priceRange.toLocaleString('en-IN')}+
                </div>
              </div>
            </div>
          </div>

          {/* Section 4: Ratings */}
          <div className="space-y-3 pt-3 border-t border-slate-100">
            <h3 className="text-xs font-bold text-slate-900">Ratings</h3>

            <div className="grid grid-cols-2 gap-3">
              {ratings.map((rating) => {
                const isSelected = selectedRating === rating
                return (
                  <button
                    key={rating}
                    onClick={() => setSelectedRating(rating)}
                    className={`px-4 py-3 rounded-2xl border text-xs font-bold transition-all flex items-center justify-between ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50/70 text-blue-950 shadow-xs'
                        : 'border-slate-200/80 bg-white text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    <span>{rating}</span>
                    {isSelected && (
                      <div className="w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0 ml-1">
                        <HiCheck className="w-3 h-3 stroke-[3]" />
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Submit Action Button */}
          <div className="pt-4 border-t border-slate-100">
            <button
              onClick={handleApply}
              className="w-full bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white font-bold text-xs py-4 rounded-2xl shadow-md transition-all tracking-wide"
            >
              Show 842 Results
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}
