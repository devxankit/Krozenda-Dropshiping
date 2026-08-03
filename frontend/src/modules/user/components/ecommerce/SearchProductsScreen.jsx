import React, { useState } from 'react'
import { HiArrowLeft, HiMagnifyingGlass, HiXMark, HiMicrophone, HiClock, HiSparkles } from 'react-icons/hi2'
import { WebHeader } from '../../../../components/layout/WebHeader'

export function SearchProductsScreen({ onBack = () => {}, onSelectSearch = () => {} }) {
  const [query, setQuery] = useState('Smartphone')
  const [recentSearches, setRecentSearches] = useState(['Smartphone', 'Headphones', 'Watch', 'Shoes'])
  const popularSearches = ['Smartphones', 'Wireless Earbuds', "Men's Shoes", 'Watches', 'Home Appliances', 'Power Banks']

  const clearRecent = () => setRecentSearches([])

  return (
    <div className="w-full min-h-screen bg-slate-50 flex flex-col text-slate-800 font-sans">
      <div className="hidden md:block"><WebHeader /></div>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-4 md:py-8 space-y-6">
        {/* Main Search Header Bar */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center space-x-4">
            <button onClick={onBack} className="p-2 rounded-full hover:bg-slate-100 text-slate-700">
              <HiArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex-1 relative max-w-3xl">
              <HiMagnifyingGlass className="w-5 h-5 text-slate-400 absolute left-4 top-3.5" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search 100,000+ products, brands, and suppliers..."
                className="w-full pl-12 pr-12 py-3 bg-slate-100 border border-slate-200 rounded-2xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition-all"
              />
              {query && (
                <button onClick={() => setQuery('')} className="absolute right-4 top-3.5 text-slate-400 hover:text-slate-600">
                  <HiXMark className="w-5 h-5" />
                </button>
              )}
            </div>
            <button
              onClick={() => onSelectSearch(query)}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-6 py-3 rounded-2xl shadow-md transition-colors"
            >
              Search
            </button>
          </div>
        </div>

        {/* 2 Column Split Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Recent Searches */}
          <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-black text-slate-900 flex items-center space-x-2">
                <HiClock className="w-4 h-4 text-slate-500" />
                <span>Recent Searches</span>
              </h3>
              {recentSearches.length > 0 && (
                <button onClick={clearRecent} className="text-xs font-bold text-blue-600 hover:underline">
                  Clear All
                </button>
              )}
            </div>

            <div className="flex flex-wrap gap-2.5">
              {recentSearches.map((term, idx) => (
                <button
                  key={idx}
                  onClick={() => onSelectSearch(term)}
                  className="px-4 py-2 bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-700 text-xs font-bold rounded-2xl border border-slate-200/80 transition-colors"
                >
                  {term}
                </button>
              ))}
            </div>
          </div>

          {/* Popular Searches */}
          <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-xs space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-sm font-black text-slate-900 flex items-center space-x-2">
                <HiSparkles className="w-4 h-4 text-amber-500" />
                <span>Trending Wholesale Categories</span>
              </h3>
            </div>

            <div className="flex flex-wrap gap-2.5">
              {popularSearches.map((term, idx) => (
                <button
                  key={idx}
                  onClick={() => onSelectSearch(term)}
                  className="px-4 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-bold rounded-2xl border border-amber-200 transition-colors"
                >
                  🔥 {term}
                </button>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
