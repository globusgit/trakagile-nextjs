import {
  DefaultSession,
  DefaultUser,
} from "next-auth";

import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface User extends DefaultUser {
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

export {};