import { Product, Retailer, ProductVariant, InventorySnapshot, StoreAvailability, Store } from "@prisma/client";
import AvailabilityTable from "./AvailabilityTable";

interface ProductWithRelations extends Product {
  retailer: Retailer;
  variants: (ProductVariant & {
    snapshots: InventorySnapshot[];
    avail: (StoreAvailability & { store: Store })[];
  })[];
}

interface ProductCardProps {
  product: ProductWithRelations;
}

export default function ProductCard({ product }: ProductCardProps) {
  const variant = product.variants[0];
  const lastSnapshot = variant?.snapshots?.[0];
  const isInStock = lastSnapshot?.inStock || false;
  const price = lastSnapshot?.price?.toNumber() || null;
  
  return (
    <div className="rounded-xl border bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="text-sm text-neutral-500 mb-1">{product.retailer.name}</div>
          <a 
            href={product.url} 
            target="_blank" 
            rel="noopener noreferrer"
            className="font-medium hover:underline text-blue-600"
          >
            {product.title}
          </a>
          {price && (
            <p className="text-lg font-semibold mt-1">
              ${price.toFixed(2)}
            </p>
          )}
        </div>
        <div className={`text-sm px-2 py-1 rounded ${
          isInStock 
            ? 'bg-green-100 text-green-800' 
            : 'bg-neutral-100 text-neutral-700'
        }`}>
          {isInStock ? 'In stock' : 'Out of stock'}
        </div>
      </div>
      
      {variant && <AvailabilityTable availability={variant.avail} />}
    </div>
  );
}