"use client";

import Link from "next/link";
import Image from "next/image";
import { signOut } from "next-auth/react";

interface NavbarProps {
  userEmail: string;
}

export default function Navbar({ userEmail }: NavbarProps) {
  return (
    <nav className="bg-white shadow-sm border-b">
      <div className="mx-auto max-w-6xl px-6 py-4">
        <div className="flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2">
            <Image src="/logo.svg" alt="Logo" width={32} height={32} />
            <span className="font-semibold">CardStock Sydney</span>
          </Link>
          
          <div className="flex items-center gap-4">
            <span className="text-sm text-neutral-600">{userEmail}</span>
            <button
              onClick={() => signOut({ callbackUrl: "/" })}
              className="text-sm px-3 py-1.5 rounded border border-neutral-300 hover:bg-neutral-100 transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}