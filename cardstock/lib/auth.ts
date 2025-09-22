import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "./db";
import bcrypt from "bcryptjs";
import { z } from "zod";

const credsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        const parsed = credsSchema.safeParse(credentials);
        if (!parsed.success) return null;
        
        const user = await prisma.user.findUnique({ 
          where: { email: parsed.data.email }
        });
        if (!user) return null;
        
        const isValid = await bcrypt.compare(parsed.data.password, user.password);
        if (!isValid) return null;
        
        return { 
          id: user.id, 
          email: user.email, 
          roles: user.roles 
        };
      }
    })
  ],
  pages: { 
    signIn: "/login" 
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.roles = (user as any).roles;
      }
      return token;
    },
    async session({ session, token }) {
      if (token?.id) {
        (session as any).userId = token.id;
        (session as any).roles = token.roles ?? ["user"];
      }
      return session;
    }
  },
  secret: process.env.AUTH_SECRET,
};