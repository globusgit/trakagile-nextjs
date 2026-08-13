import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    id: string;
    empId: string;
    role: string;
    orgId: string;
    isFirstLogin: boolean;
  }

  interface Session {
    user: {
      id: string;
      empId: string;
      role: string;
      orgId: string;
      isFirstLogin: boolean;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    empId: string;
    role: string;
    orgId: string;
    isFirstLogin: boolean;
  }
}