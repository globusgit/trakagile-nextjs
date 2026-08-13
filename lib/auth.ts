import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import connectDB from "@/lib/mongoose";
import User from "@/models/User";

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,

  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        empId: { label: "Employee ID", type: "text" },
        password: { label: "Password", type: "password" },
      },

      async authorize(credentials) {
        await connectDB();

        const empId = credentials?.empId as string | undefined;
        const password = credentials?.password as string | undefined;

        if (!empId || !password) {
          return null;
        }

        const user = await User.findOne({ username: empId }).lean();

        if (!user) {
          return null;
        }

        if (user.status !== "Active") {
          return null;
        }

        const isValid = await bcrypt.compare(password, user.password);

        if (!isValid) {
          return null;
        }

        return {
          id: user._id.toString(),
          empId: user.username,
          role: user.role,
          orgId: user.orgId,
          isFirstLogin: user.isFirstLogin,
        };
      },
    }),
  ],

  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60,
  },

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.empId = user.empId;
        token.role = user.role;
        token.orgId = user.orgId;
        token.isFirstLogin = user.isFirstLogin;
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.empId = token.empId as string;
        session.user.role = token.role as string;
        session.user.orgId = token.orgId as string;
        session.user.isFirstLogin = token.isFirstLogin as boolean;
      }
      return session;
    },
  },

  pages: {
    signIn: "/",
  },

  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
});