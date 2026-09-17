import React from 'react'
import { HiArrowRight } from 'react-icons/hi2'
import { useNavigate } from 'react-router-dom'
import { USER_ROUTES, userPath } from '../../../../config/routes'
import { SmartImage } from '../../../../components/ui/SmartImage'

export function CategorySection({ onSelectCategory }) {
  const navigate = useNavigate()

  const categories = [
    {
      id: 'mobiles',
      name: 'Mobiles & Tablets',
      itemCount: '1,250+ Curated Products',
      image: '/images/cat_mobiles.jpg',
      badge: 'BESTSELLER',
      discount: 'Up to 40% OFF - New Tiers',
    },
    {
      id: 'laptops',
      name: 'Laptops & Workstations',
      itemCount: '1,250+ Curated Products',
      image: '/images/cat_laptops_new.jpg',
      badge: 'POPULAR',
      discount: 'Up to 40% OFF - New Tiers',
    },
    {
      id: 'watches',
      name: 'Smartwatches',
      itemCount: '1,120+ Curated Products',
      image: '/images/cat_watches_new.jpg',
      badge: 'TRENDING',
      discount: 'Max Savings 60% OFF',
    },
    {
      id: 'audio',
      name: 'Audio & Headphones',
      itemCount: '2,350+ Curated Products',
      image: '/images/boat_airdopes.png',
      badge: 'HOT',
      discount: 'Flash Sale: Up to 75% OFF',
    },
    {
      id: 'fashion',
      name: 'Fashion & Apparel',
      itemCount: '3,400+ Curated Products',
      image: '/images/cat_fashion.jpg',
      badge: 'NEW TIERS',
      discount: 'Max Savings 60% OFF',
    },
    {
      id: 'shoes',
      name: 'Shoes & Footwear',
      itemCount: '1,890+ Curated Products',
      image: '/images/cat_shoes.jpg',
      badge: 'TOP SELLER',
      discount: 'Max Savings 60% OFF',
    },
    {
      id: 'appliances',
      name: 'Home Appliances',
      itemCount: '1,250+ Curated Products',
      image: '/images/cat_appliances.jpg',
      badge: 'ESSENTIAL',
      discount: 'Upto 45% OFF',
    },
    {
      id: 'beauty',
      name: 'Beauty & Skincare',
      itemCount: '1,560+ Curated Products',
      image: '/images/cat_beauty.jpg',
      badge: 'POPULAR',
      discount: 'Upto 55% OFF',
    },
    {
      id: 'gaming',
      name: 'Gaming Consoles',
      itemCount: '940+ Curated Products',
      image: '/images/cat_gaming.jpg',
      badge: 'PRO TECH',
      discount: 'Upto 35% OFF',
    },
    {
      id: 'smartgadgets',
      name: 'Smart Gadgets',
      itemCount: '1,680+ Curated Products',
      image: '/images/cat_watches_new.jpg',
      badge: 'POPULAR',
      discount: 'Flash Sale: Up to 75% OFF',
    },
    {
      id: 'home',
      name: 'Home & Kitchen',
      itemCount: '2,100+ Curated Products',
      image: '/images/cat_appliances.jpg',
      badge: 'BULK READY',
      discount: 'Upto 40% OFF',
    },
    {
      id: 'all',
      name: 'Explore All Catalogs...',
      itemCount: '100k+ Catalog',
      isBrowseAll: true,
      badge: 'VIEW ALL',
      discount: 'All Direct Tiers',
      collageImages: [
        '/images/cat_mobiles.jpg',
        '/images/cat_watches_new.jpg',
        '/images/cat_shoes.jpg',
        '/images/boat_airdopes.png',
      ],
    },
  ]

  const handleClick = (cat) => {
    if (cat.id === 'all') {
      navigate(USER_ROUTES.CATEGORIES)
    } else if (onSelectCategory) {
      onSelectCategory(cat.id)
    } else {
      navigate(userPath.listing({ category: cat.id || cat._id }))
    }
  }

  return (
    <section className="w-full space-y-5 my-6">
      {/* Top Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Top Categories
            </h2>
            <span className="px-3 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-100 text-xs font-semibold tracking-wide">
              12+ Collections
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 font-normal">
            A premium catalog curated for high-margin dropshipping & bulk buying
          </p>
        </div>

        <button
          onClick={() => navigate(USER_ROUTES.CATEGORIES)}
          className="self-start sm:self-auto bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-semibold px-5 py-2.5 rounded-full shadow-xs hover:shadow transition-all flex items-center gap-1.5 shrink-0"
        >
          <span>View All Collections</span>
        </button>
      </div>

      {/* 6 Column Desktop Category Cards Grid - Pure White & Clean */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {categories.map((cat) => (
          <div
            key={cat.id}
            onClick={() => handleClick(cat)}
            className="bg-white rounded-2xl p-3.5 border border-slate-200/90 shadow-2xs hover:shadow-xl hover:border-blue-400 transition-all duration-300 flex flex-col justify-between group cursor-pointer relative"
          >
            {/* Top Badge (Single Pill Badge) */}
            <div className="flex items-center justify-between z-10 w-full mb-1">
              <span className="text-[9px] sm:text-[10px] font-extrabold tracking-wider text-slate-600 bg-slate-100 group-hover:bg-blue-600 group-hover:text-white px-2 py-0.5 rounded-md uppercase transition-colors">
                {cat.badge}
              </span>
            </div>

            {/* Product Image Area - Fitted edge-to-edge to card */}
            {cat.isBrowseAll ? (
              <div className="w-full aspect-[4/3] grid grid-cols-2 gap-1 p-1 bg-slate-50 rounded-xl overflow-hidden my-1 border border-slate-100">
                {cat.collageImages.map((imgUrl, idx) => (
                  <div
                    key={idx}
                    className="w-full h-full rounded-lg overflow-hidden flex items-center justify-center bg-white"
                  >
                    <SmartImage
                      src={imgUrl}
                      alt=""
                      sizes="80px"
                      ratio="1 / 1"
                      fit="cover"
                      className="h-full w-full"
                    />
                  </div>
                ))}
              </div>
            ) : (
              <SmartImage
                src={cat.image}
                alt={cat.name}
                sizes="(min-width: 1024px) 20vw, 45vw"
                ratio="4 / 3"
                fit="cover"
                className="my-1 w-full rounded-xl"
              />
            )}

            {/* Offer Tag Pill below Image */}
            <div className="w-full mt-1">
              <div className="w-full bg-slate-50 border border-slate-200/60 rounded-lg py-1 px-1.5 text-center group-hover:bg-blue-50 group-hover:border-blue-200 transition-colors">
                <span className="text-[10px] sm:text-[11px] font-bold text-slate-700 group-hover:text-blue-700 tracking-tight block truncate">
                  {cat.discount}
                </span>
              </div>
            </div>

            {/* Title & Product Count */}
            <div className="pt-2.5 space-y-0.5 text-left border-t border-slate-100 mt-2">
              <h3
                className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors truncate tracking-tight"
                title={cat.name}
              >
                {cat.name}
              </h3>

              <div className="flex items-center justify-between text-[11px] font-medium text-slate-500">
                <span className="truncate">{cat.itemCount}</span>
                <HiArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all shrink-0 ml-1" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
