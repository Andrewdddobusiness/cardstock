import AuthForm from "@/components/AuthForm";
import Link from "next/link";
import Image from "next/image";

export default function LoginPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8">
      <div className="w-full max-w-sm">
        <Link href="/" className="flex items-center justify-center gap-2 mb-8">
          <Image src="/logo.svg" alt="Logo" width={40} height={40} />
          <span className="text-xl font-semibold">CardStock Sydney</span>
        </Link>
        
        <h1 className="text-2xl font-bold text-center mb-8">Welcome back</h1>
        
        <AuthForm mode="login" />
      </div>
    </main>
  );
}