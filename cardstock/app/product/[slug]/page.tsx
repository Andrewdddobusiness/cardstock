import { Metadata } from 'next'
import ProductDetail from '@/components/ProductDetail'
import { prisma } from '@/lib/db'

interface PageProps {
  params: Promise<{
    slug: string
  }>
}

// Map slugs to product search terms
const productMappings: Record<string, { searchTerms: string[], displayName: string }> = {
  'evolving-skies-booster-box': {
    searchTerms: ['evolving skies booster box', 'evolving skies booster', 'evolving skies'],
    displayName: 'Evolving Skies Booster Box'
  },
  'champions-path-elite-trainer-box': {
    searchTerms: ['champions path elite trainer box', 'champions path etb', 'champions path'],
    displayName: 'Champions Path Elite Trainer Box'
  },
  'shining-fates-elite-trainer-box': {
    searchTerms: ['shining fates elite trainer box', 'shining fates etb', 'shining fates'],
    displayName: 'Shining Fates Elite Trainer Box'
  },
  'hidden-fates-elite-trainer-box': {
    searchTerms: ['hidden fates elite trainer box', 'hidden fates etb', 'hidden fates'],
    displayName: 'Hidden Fates Elite Trainer Box'
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const mapping = productMappings[slug]
  
  if (!mapping) {
    return {
      title: 'Product Not Found',
    }
  }

  return {
    title: `${mapping.displayName} - Stock Tracker`,
    description: `Track stock availability for ${mapping.displayName} across multiple retailers`
  }
}

export default async function ProductPage({ params }: PageProps) {
  const { slug } = await params
  const mapping = productMappings[slug]
  
  if (!mapping) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Product Not Found</h1>
          <p className="text-gray-600">The product you're looking for doesn't exist.</p>
        </div>
      </div>
    )
  }

  // Fetch all products matching the search terms
  const products = await prisma.product.findMany({
    where: {
      OR: mapping.searchTerms.map(term => ({
        title: {
          contains: term,
          mode: 'insensitive' as const
        }
      }))
    },
    include: {
      retailer: true,
      variants: {
        include: {
          snapshots: {
            orderBy: { seenAt: 'desc' },
            take: 1
          },
          events: {
            orderBy: { occurredAt: 'desc' },
            take: 1
          }
        }
      }
    }
  })

  return <ProductDetail 
    productName={mapping.displayName} 
    products={products}
    slug={slug}
  />
}