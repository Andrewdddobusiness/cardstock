'use client'

import Link from 'next/link'
import { Product, Retailer, ProductVariant, InventorySnapshot, StockEvent } from '@prisma/client'
import { ArrowLeftIcon, ExternalLinkIcon, CheckCircleIcon, XCircleIcon, ClockIcon } from '@heroicons/react/24/outline'

type ProductWithData = Product & {
  retailer: Retailer
  variants: (ProductVariant & {
    snapshots: InventorySnapshot[]
    events: StockEvent[]
  })[]
}

interface ProductDetailProps {
  productName: string
  products: ProductWithData[]
  slug: string
}

interface GroupedProduct {
  product: ProductWithData
  status: 'in-stock' | 'out-of-stock' | 'preorder'
  price: number | null
  lastUpdated: Date
}

// Retailer logos/icons mapping
const retailerLogos: Record<string, string> = {
  'EB Games': '🎮',
  'Big W': '🛒',
  'Kmart': '🏪',
  'Collectible Madness': '🎴',
  // Add more as needed
}

export default function ProductDetail({ productName, products, slug }: ProductDetailProps) {
  // Group products by status
  const groupedProducts = products.map(product => {
    const variant = product.variants[0]
    if (!variant) return null

    const latestSnapshot = variant.snapshots[0]
    const latestEvent = variant.events[0]
    
    // Determine status
    let status: 'in-stock' | 'out-of-stock' | 'preorder' = 'out-of-stock'
    
    if (latestEvent?.details && typeof latestEvent.details === 'object' && 'cur' in latestEvent.details) {
      const curDetails = (latestEvent.details as any).cur
      if (curDetails?.isPreorder) {
        status = 'preorder'
      } else if (latestSnapshot?.inStock) {
        status = 'in-stock'
      }
    } else if (latestSnapshot?.inStock) {
      status = 'in-stock'
    }

    return {
      product,
      status,
      price: latestSnapshot?.price ? Number(latestSnapshot.price) : null,
      lastUpdated: latestSnapshot?.seenAt || product.createdAt
    } as GroupedProduct
  }).filter(Boolean) as GroupedProduct[]

  const inStockProducts = groupedProducts.filter(p => p.status === 'in-stock')
  const preorderProducts = groupedProducts.filter(p => p.status === 'preorder')
  const outOfStockProducts = groupedProducts.filter(p => p.status === 'out-of-stock')

  const formatPrice = (price: number | null) => {
    if (!price) return 'Price N/A'
    return `$${price.toFixed(2)}`
  }

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-AU', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date)
  }

  const ProductCard = ({ item, disabled = false }: { item: GroupedProduct, disabled?: boolean }) => (
    <a
      href={item.product.url}
      target="_blank"
      rel="noopener noreferrer"
      className={`block p-4 border rounded-lg transition-all ${
        disabled 
          ? 'bg-gray-50 border-gray-200 opacity-60 cursor-not-allowed' 
          : 'bg-white hover:shadow-md border-gray-300 hover:border-blue-400'
      }`}
      onClick={disabled ? (e) => e.preventDefault() : undefined}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-3">
          <div className="text-2xl">
            {retailerLogos[item.product.retailer.name] || '🏬'}
          </div>
          <div>
            <h3 className="font-medium text-gray-900">{item.product.retailer.name}</h3>
            <p className="text-sm text-gray-600 mt-1 line-clamp-2">{item.product.title}</p>
            <div className="flex items-center gap-4 mt-2">
              <span className={`font-semibold ${disabled ? 'text-gray-500' : 'text-gray-900'}`}>
                {formatPrice(item.price)}
              </span>
              <span className="text-xs text-gray-500">
                Updated {formatDate(item.lastUpdated)}
              </span>
            </div>
          </div>
        </div>
        {!disabled && <ExternalLinkIcon className="h-5 w-5 text-gray-400" />}
      </div>
    </a>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Link 
            href="/"
            className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 mb-4"
          >
            <ArrowLeftIcon className="h-4 w-4 mr-1" />
            Back to Dashboard
          </Link>
          
          <h1 className="text-3xl font-bold text-gray-900">{productName}</h1>
          <p className="mt-2 text-gray-600">
            Track availability across {products.length} retailer{products.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* In Stock Section */}
        {inStockProducts.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center mb-4">
              <CheckCircleIcon className="h-6 w-6 text-green-500 mr-2" />
              <h2 className="text-xl font-semibold text-gray-900">In Stock ({inStockProducts.length})</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {inStockProducts.map((item) => (
                <ProductCard key={item.product.id} item={item} />
              ))}
            </div>
          </div>
        )}

        {/* Preorder Section */}
        {preorderProducts.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center mb-4">
              <ClockIcon className="h-6 w-6 text-yellow-500 mr-2" />
              <h2 className="text-xl font-semibold text-gray-900">Preorder ({preorderProducts.length})</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {preorderProducts.map((item) => (
                <ProductCard key={item.product.id} item={item} />
              ))}
            </div>
          </div>
        )}

        {/* Out of Stock Section */}
        {outOfStockProducts.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center mb-4">
              <XCircleIcon className="h-6 w-6 text-gray-400 mr-2" />
              <h2 className="text-xl font-semibold text-gray-500">Out of Stock ({outOfStockProducts.length})</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 opacity-60">
              {outOfStockProducts.map((item) => (
                <ProductCard key={item.product.id} item={item} disabled />
              ))}
            </div>
          </div>
        )}

        {/* No products found */}
        {products.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">No retailers found for this product.</p>
          </div>
        )}
      </div>
    </div>
  )
}