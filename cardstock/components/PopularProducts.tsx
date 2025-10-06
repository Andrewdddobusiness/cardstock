'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

interface PopularProduct {
  slug: string
  name: string
  imageUrl?: string
  description?: string
  priceRange?: string
}

// Define popular Pokemon boxes
const popularBoxes: PopularProduct[] = [
  {
    slug: 'evolving-skies-booster-box',
    name: 'Evolving Skies Booster Box',
    description: 'One of the most sought-after modern sets',
    priceRange: '$350-450',
    imageUrl: 'https://images.pokemontcg.io/swsh7/logo.png'
  },
  {
    slug: 'champions-path-elite-trainer-box',
    name: 'Champions Path Elite Trainer Box',
    description: 'Features Charizard V and Rainbow Charizard VMAX',
    priceRange: '$140-180',
    imageUrl: 'https://images.pokemontcg.io/swsh35/logo.png'
  },
  {
    slug: 'shining-fates-elite-trainer-box',
    name: 'Shining Fates Elite Trainer Box',
    description: 'Popular shiny vault collection',
    priceRange: '$120-150',
    imageUrl: 'https://images.pokemontcg.io/swsh45/logo.png'
  },
  {
    slug: 'hidden-fates-elite-trainer-box',
    name: 'Hidden Fates Elite Trainer Box',
    description: 'Highly collectible with shiny vault cards',
    priceRange: '$200-250',
    imageUrl: 'https://images.pokemontcg.io/sm115/logo.png'
  }
]

interface StockSummary {
  inStock: number
  outOfStock: number
  preorder: number
  total: number
}

export default function PopularProducts() {
  const [stockSummaries, setStockSummaries] = useState<Record<string, StockSummary>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchStockSummaries()
  }, [])

  const fetchStockSummaries = async () => {
    try {
      const response = await fetch('/api/products/popular')
      if (!response.ok) throw new Error('Failed to fetch summaries')
      
      const data = await response.json()
      setStockSummaries(data)
    } catch (error) {
      console.error('Failed to fetch stock summaries:', error)
      
      // Fallback to empty summaries
      const emptySummaries: Record<string, StockSummary> = {}
      popularBoxes.forEach(box => {
        emptySummaries[box.slug] = {
          inStock: 0,
          outOfStock: 0,
          preorder: 0,
          total: 0
        }
      })
      setStockSummaries(emptySummaries)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">Popular Pokemon Boxes</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {popularBoxes.map((product) => {
          const summary = stockSummaries[product.slug] || { inStock: 0, outOfStock: 0, preorder: 0, total: 0 }
          
          return (
            <Link
              key={product.slug}
              href={`/product/${product.slug}`}
              className="block group"
            >
              <div className="border rounded-lg p-4 hover:shadow-md transition-shadow duration-200 h-full flex flex-col">
                {/* Product Image Placeholder */}
                <div className="w-full h-32 bg-gray-100 rounded-md mb-3 flex items-center justify-center overflow-hidden">
                  {product.imageUrl ? (
                    <img 
                      src={product.imageUrl} 
                      alt={product.name}
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <div className="text-gray-400 text-sm">No Image</div>
                  )}
                </div>

                {/* Product Info */}
                <h3 className="font-medium text-gray-900 group-hover:text-blue-600 mb-1 line-clamp-2">
                  {product.name}
                </h3>
                
                {product.description && (
                  <p className="text-sm text-gray-500 mb-2 line-clamp-2">
                    {product.description}
                  </p>
                )}

                {product.priceRange && (
                  <p className="text-sm font-medium text-gray-700 mb-3">
                    {product.priceRange}
                  </p>
                )}

                {/* Stock Summary */}
                <div className="mt-auto">
                  {loading ? (
                    <div className="text-sm text-gray-500">Loading...</div>
                  ) : (
                    <div className="flex items-center gap-2 text-xs">
                      {summary.inStock > 0 && (
                        <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full">
                          {summary.inStock} in stock
                        </span>
                      )}
                      {summary.preorder > 0 && (
                        <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full">
                          {summary.preorder} preorder
                        </span>
                      )}
                      {summary.inStock === 0 && summary.preorder === 0 && (
                        <span className="px-2 py-1 bg-red-100 text-red-800 rounded-full">
                          Out of stock
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}