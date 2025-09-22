import Link from "next/link";
import Image from "next/image";

export default function Landing() {
  return (
    <main className="mx-auto max-w-5xl p-8">
      <nav className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Image src="/logo.svg" alt="Logo" width={32} height={32} className="h-8 w-8" />
          <span className="font-semibold">CardStock Sydney</span>
        </div>
        <div className="space-x-3">
          <Link 
            href="/login" 
            className="px-3 py-1.5 rounded bg-neutral-900 text-white hover:bg-neutral-800 transition-colors"
          >
            Login
          </Link>
          <Link 
            href="/register" 
            className="px-3 py-1.5 rounded border border-neutral-900 hover:bg-neutral-100 transition-colors"
          >
            Register
          </Link>
        </div>
      </nav>
      
      <section className="mt-16 grid md:grid-cols-2 gap-10">
        <div>
          <h1 className="text-4xl font-bold leading-tight">
            Track Pokémon box stock across Kmart, BIG W, and EB Games.
          </h1>
          <p className="mt-4 text-neutral-700">
            Simple dashboard. Sydney-focused store availability. No fluff.
          </p>
          <div className="mt-6">
            <Link 
              href="/register" 
              className="inline-block px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 transition-colors"
            >
              Get Started
            </Link>
          </div>
        </div>
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <div className="h-56 bg-neutral-100 rounded flex items-center justify-center">
            <span className="text-neutral-500">Stock Dashboard Preview</span>
          </div>
          <p className="mt-2 text-sm text-neutral-500">
            Preview: Real-time availability dashboard
          </p>
        </div>
      </section>
    </main>
  );
}