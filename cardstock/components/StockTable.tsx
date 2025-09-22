'use client'

import { useState, useMemo } from 'react'
import { Product, Retailer, ProductVariant, StoreAvailability, Store, InventorySnapshot } from '@prisma/client'

type ProductWithData = Product & {
  retailer: Retailer
  variants: (ProductVariant & {
    avail: (StoreAvailability & { store: Store })[]
    snapshots: InventorySnapshot[]
  })[]
}

interface StockTableProps {
  products: ProductWithData[]
}

type StockRow = {
  id: string
  productTitle: string
  retailer: string
  location: string
  storeName: string
  inStock: boolean
  price: number | null
  lastSeen: Date
  status: 'available' | 'out-of-stock' | 'preorder' | 'unknown'
  releaseDate?: Date
  url: string
}

export default function StockTable({ products }: StockTableProps) {
  const [filterRetailer, setFilterRetailer] = useState<string>('')
  const [filterStatus, setFilterStatus] = useState<string>('')
  const [filterLocation, setFilterLocation] = useState<string>('')
  const [sortBy, setSortBy] = useState<'product' | 'retailer' | 'location' | 'status' | 'price' | 'lastSeen'>('lastSeen')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  const stockRows = useMemo(() => {
    const rows: StockRow[] = []
    
    products.forEach(product => {
      let hasData = false
      
      product.variants.forEach(variant => {
        // Add store availability data
        variant.avail.forEach(avail => {
          hasData = true
          rows.push({
            id: `${variant.id}-${avail.storeId}`,
            productTitle: product.title,
            retailer: product.retailer.name,
            location: avail.store.state || 'Unknown',
            storeName: avail.store.name,
            inStock: avail.inStock,
            price: avail.price ? Number(avail.price) : null,
            lastSeen: avail.seenAt,
            status: avail.inStock ? 'available' : 'out-of-stock',
            url: product.url
          })
        })
        
        // Add online availability from snapshots if no store data
        if (variant.avail.length === 0 && variant.snapshots.length > 0) {
          hasData = true
          const latestSnapshot = variant.snapshots[0]
          rows.push({
            id: `${variant.id}-online`,
            productTitle: product.title,
            retailer: product.retailer.name,
            location: 'Online',
            storeName: 'Online Store',
            inStock: latestSnapshot.inStock,
            price: latestSnapshot.price ? Number(latestSnapshot.price) : null,
            lastSeen: latestSnapshot.seenAt,
            status: latestSnapshot.inStock ? 'available' : 'out-of-stock',
            url: product.url
          })
        }
      })
      
      // If no stock data exists, still show the product with unknown status
      if (!hasData && product.variants.length > 0) {
        const variant = product.variants[0]
        rows.push({
          id: `${variant.id}-unknown`,
          productTitle: product.title,
          retailer: product.retailer.name,
          location: 'Unknown',
          storeName: 'Not monitored yet',
          inStock: false,
          price: null,
          // Use a stable server-provided timestamp to avoid hydration mismatch
          lastSeen: product.createdAt,
          status: 'unknown',
          url: product.url
        })
      }
      
      // If no variants exist, still show the product
      if (product.variants.length === 0) {
        rows.push({
          id: `${product.id}-no-variant`,
          productTitle: product.title,
          retailer: product.retailer.name,
          location: 'Unknown',
          storeName: 'Not monitored yet',
          inStock: false,
          price: null,
          // Use a stable server-provided timestamp to avoid hydration mismatch
          lastSeen: product.createdAt,
          status: 'unknown',
          url: product.url
        })
      }
    })
    
    return rows
  }, [products])

  const filteredRows = useMemo(() => {
    let filtered = stockRows
    
    if (filterRetailer) {
      filtered = filtered.filter(row => row.retailer.toLowerCase().includes(filterRetailer.toLowerCase()))
    }
    
    if (filterStatus) {
      filtered = filtered.filter(row => row.status === filterStatus)
    }
    
    if (filterLocation) {
      filtered = filtered.filter(row => 
        row.location.toLowerCase().includes(filterLocation.toLowerCase()) ||
        row.storeName.toLowerCase().includes(filterLocation.toLowerCase())
      )
    }
    
    // Sort
    filtered.sort((a, b) => {
      let aVal: any, bVal: any
      
      switch (sortBy) {
        case 'product':
          aVal = a.productTitle.toLowerCase()
          bVal = b.productTitle.toLowerCase()
          break
        case 'retailer':
          aVal = a.retailer.toLowerCase()
          bVal = b.retailer.toLowerCase()
          break
        case 'location':
          aVal = a.location.toLowerCase()
          bVal = b.location.toLowerCase()
          break
        case 'status':
          aVal = a.status
          bVal = b.status
          break
        case 'price':
          aVal = a.price || 0
          bVal = b.price || 0
          break
        case 'lastSeen':
          aVal = a.lastSeen.getTime()
          bVal = b.lastSeen.getTime()
          break
        default:
          return 0
      }
      
      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1
      return 0
    })
    
    return filtered
  }, [stockRows, filterRetailer, filterStatus, filterLocation, sortBy, sortOrder])

  const retailers = [...new Set(stockRows.map(row => row.retailer))]
  const locations = [...new Set(stockRows.map(row => row.location))]
  
  const handleSort = (column: typeof sortBy) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(column)
      setSortOrder('asc')
    }
  }

  const getStatusBadge = (status: string, inStock: boolean) => {
    if (status === 'available' && inStock) {
      return <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">In Stock</span>
    }
    if (status === 'out-of-stock') {
      return <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded-full">Out of Stock</span>
    }
    if (status === 'preorder') {
      return <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full">Preorder</span>
    }
    if (status === 'unknown') {
      return <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">Not Monitored</span>
    }
    return <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded-full">Unknown</span>
  }

  const formatPrice = (price: number | null) => {
    if (!price) return '-'
    return `$${price.toFixed(2)}`
  }

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-AU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date)
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-4 p-4 bg-white rounded-lg border">
        <div className="flex-1 min-w-48">
          <label className="block text-sm font-medium text-gray-700 mb-1">Retailer</label>
          <select 
            value={filterRetailer} 
            onChange={(e) => setFilterRetailer(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
          >
            <option value="">All Retailers</option>
            {retailers.map(retailer => (
              <option key={retailer} value={retailer}>{retailer}</option>
            ))}
          </select>
        </div>
        
        <div className="flex-1 min-w-48">
          <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
          <select 
            value={filterStatus} 
            onChange={(e) => setFilterStatus(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
          >
            <option value="">All Status</option>
            <option value="available">In Stock</option>
            <option value="out-of-stock">Out of Stock</option>
            <option value="preorder">Preorder</option>
            <option value="unknown">Not Monitored</option>
          </select>
        </div>
        
        <div className="flex-1 min-w-48">
          <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
          <select 
            value={filterLocation} 
            onChange={(e) => setFilterLocation(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
          >
            <option value="">All Locations</option>
            {locations.map(location => (
              <option key={location} value={location}>{location}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('product')}
                >
                  Product {sortBy === 'product' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('retailer')}
                >
                  Retailer {sortBy === 'retailer' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('location')}
                >
                  Location {sortBy === 'location' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('status')}
                >
                  Status {sortBy === 'status' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('price')}
                >
                  Price {sortBy === 'price' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('lastSeen')}
                >
                  Last Updated {sortBy === 'lastSeen' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    No stock data found
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{row.productTitle}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{row.retailer}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{row.storeName}</div>
                      <div className="text-xs text-gray-500">{row.location}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(row.status, row.inStock)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{formatPrice(row.price)}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">{formatDate(row.lastSeen)}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <a 
                        href={row.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-900"
                      >
                        View
                      </a>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      <div className="text-sm text-gray-500 text-center">
        Showing {filteredRows.length} of {stockRows.length} stock entries
      </div>
    </div>
  )
}
