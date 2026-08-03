import React, { useState } from 'react'
import { HiArrowLeft, HiMagnifyingGlass, HiXMark, HiMicrophone } from 'react-icons/hi2'
import { WebHeader } from '../../../../components/layout/WebHeader'
import { BottomNavbar } from '../../../../components/layout/BottomNavbar'

export function SearchProductsScreen({ onBack = () => {}, onSelectSearch = () => {} }) {
  const [query, setQuery] = useState('Smartphone')
  const [recentSearches, setRecentSearches] = useState(['Smartphone', 'Headphones', 'Watch', 'Shoes'])

  const popularSearches = ['Smartphones', 'Wireless Earbuds', "Men's Shoes", 'Watches', 'Home Appliances']

  const clearRecent = () => setRecentSearches([])

  return (
    <div className="w-full min-h-screen bg-slate-50 flex flex-col justify-between text-slate-800 font-sans">
      <div className="hidden md:block">
        <WebHeader />
      </div>

      <div className="flex-1 pb-20 md:pb-12 max-w-3xl mx-auto w-full md:px-6 md:py-6">
        <div className="md:hidden">
          
        </div>

        <div className="px-4 py-3 bg-white border-b border-slate-200 flex items-center space-x-3 shadow-xs">
          <button onClick={onBack} className="p-1 rounded-full hover:bg-slate-100 text-slate-700 transition-colors">
            <HiArrowLeft className="w-5 h-5" />
          </button>

          <div className="flex-1 flex items-center bg-slate-100 border border-slate-200 rounded-xl px-3 py-2">
            <HiMagnifyingGlass className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search products..."
              className="w-full px-2 bg-transparent text-xs font-bold text-slate-900 focus:outline-none"
            />
            {query && (
              <button onClick={() => setQuery('')} className="text-slate-400 hover:text-slate-600">
                <HiXMark className="w-4 h-4" />
              </button>
            )}
            <HiMicrophone className="w-4 h-4 text-slate-400 ml-1" />
          </div>
        </div>

        <div className="p-4 space-y-4">
          {recentSearches.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Recent Searches
                </span>
                <button onClick={clearRecent} className="text-[10px] font-bold text-blue-600 hover:underline">
                  Clear All
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {recentSearches.map((term, idx) => (
                  <button
                    key={idx}
                    onClick={() => onSelectSearch(term)}
                    className="px-3.5 py-1.5 bg-white border border-slate-200 text-slate-700 rounded-full text-xs font-medium hover:bg-slate-100 transition-colors"
                  >
                    {term}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
              Popular Searches
            </span>
            <div className="bg-white rounded-2xl border border-slate-200/80 divide-y divide-slate-100 shadow-xs">
              {popularSearches.map((term, idx) => (
                <div
                  key={idx}
                  onClick={() => onSelectSearch(term)}
                  className="p-3.5 flex items-center justify-between text-xs font-semibold text-slate-800 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <div className="flex items-center space-x-2.5">
                    <HiMagnifyingGlass className="w-4 h-4 text-slate-400" />
                    <span>{term}</span>
                  </div>
                  <span className="text-slate-400 text-xs">↗</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50">
        <BottomNavbar activeTab="home" />
      </div>
    </div>
  )
}
