import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Navbar from "@/components/Navbar";
import StockTable from "@/components/StockTable";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const products = await (prisma.product as any).findMany({
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
          }
        }
      }
    }
  });

  return (
    <div className="min-h-screen bg-neutral-50">
      <Navbar userEmail={session.user?.email || ""} />
      
      <main className="mx-auto max-w-6xl p-6">
        <h1 className="text-2xl font-semibold mb-6">Stock Dashboard</h1>
        
        {products.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-neutral-600">No products being tracked yet.</p>
          </div>
        ) : (
          <StockTable products={products} />
        )}
        
        <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h2 className="font-semibold text-blue-900 mb-2">Stock Monitoring</h2>
          <p className="text-sm text-blue-800">
            Stock data updates automatically via monitoring. Use filters to find specific products or locations.
            Green badges indicate in-stock items, red indicates out-of-stock. Click "View" to go to the product page.
          </p>
        </div>
      </main>
    </div>
  );
}