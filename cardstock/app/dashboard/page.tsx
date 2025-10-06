import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Navbar from "@/components/Navbar";
import StockTable from "@/components/StockTable";
import PopularProducts from "@/components/PopularProducts";
import { serializeProductFast } from "@/lib/serializer";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  // Fetch all products with related data (no date filter so pending items appear)
  // TEMPORARILY excluding BigW items until scraping is fixed
  const products = await (prisma.product as any).findMany({
    where: {
      retailer: {
        name: {
          not: "BIG W"
        }
      }
    },
    include: {
      retailer: true,
      variants: {
        include: {
          avail: { 
            include: { store: true },
            orderBy: [
              { store: { state: "asc" } },
              { store: { suburb: "asc" } },
              { store: { name: "asc" } }
            ]
          },
          snapshots: { 
            orderBy: { id: "desc" }, 
            take: 1 
          },
          events: {
            orderBy: { id: "desc" },
            take: 1
          }
        }
      }
    },
    orderBy: {
      createdAt: 'asc'
    }
  });

  // Serialize products to handle Decimal values
  const serializedProducts = serializeProductFast(products);

  // Debug: Log what retailers we found
  const retailers = [...new Set(products.map(p => p.retailer.name))];
  console.log('Dashboard retailers after filter:', retailers);
  console.log('Total products after filter:', products.length);

  return (
    <div className="min-h-screen bg-neutral-50">
      <Navbar userEmail={session.user?.email || ""} />
      
      <main className="mx-auto max-w-full xl:max-w-[1400px] p-6">
        <h1 className="text-2xl font-semibold mb-6">Stock Dashboard</h1>
        
        {/* Popular Products Section */}
        <PopularProducts />
        
        {/* Stock Table Section */}
        <div className="mt-6">
          <h2 className="text-xl font-semibold mb-4">All Products</h2>
          {serializedProducts.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-neutral-600">No products being tracked yet.</p>
            </div>
          ) : (
            <StockTable products={serializedProducts} />
          )}
        </div>
      </main>
    </div>
  );
}
