import { StoreAvailability, Store } from "@prisma/client";

interface AvailabilityTableProps {
  availability: (StoreAvailability & { store: Store })[];
}

export default function AvailabilityTable({ availability }: AvailabilityTableProps) {
  if (!availability || availability.length === 0) {
    return (
      <div className="text-sm text-neutral-500 py-4 text-center border-t">
        No per-store data available yet
      </div>
    );
  }
  
  return (
    <div className="mt-4 border-t pt-4">
      <h3 className="text-sm font-medium mb-2">Store Availability</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-neutral-500">
            <tr>
              <th className="py-1 pr-3">Store</th>
              <th className="py-1 px-3">Suburb</th>
              <th className="py-1 px-3">State</th>
              <th className="py-1 pl-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {availability.map((avail) => (
              <tr key={avail.id} className="border-t">
                <td className="py-2 pr-3 font-medium">{avail.store.name}</td>
                <td className="py-2 px-3">{avail.store.suburb || "-"}</td>
                <td className="py-2 px-3">{avail.store.state || "-"}</td>
                <td className="py-2 pl-3">
                  <span className={`inline-block px-2 py-0.5 rounded text-xs ${
                    avail.inStock 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-neutral-100 text-neutral-700'
                  }`}>
                    {avail.inStock ? 'In stock' : 'Out of stock'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}