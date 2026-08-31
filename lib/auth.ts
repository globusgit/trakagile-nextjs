import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";

import connectDB from "@/lib/mongoose";
import User from "@/models/User";
import Employee from "@/models/Employee";
import { organizationIdForCode } from "@/lib/organization";

/* =========================================================
   NEXTAUTH CONFIGURATION
========================================================= */

export const {
  handlers,
  auth,
  signIn,
  signOut,
} = NextAuth({
  trustHost: true,

  /* =======================================================
     AUTH PROVIDERS
  ======================================================= */

  providers: [
    Credentials({
      name: "Credentials",

      credentials: {
        empId: {
          label: "Employee ID",
          type: "text",
        },

        password: {
          label: "Password",
          type: "password",
        },
        organizationCode: {
          label: "Organization Code",
          type: "text",
        },
      },

      /* ===================================================
         LOGIN / AUTHORIZE
      =================================================== */

      async authorize(credentials) {
        try {
          await connectDB();

          const empId =
            credentials?.empId as
              | string
              | undefined;

          const password =
            credentials?.password as
              | string
              | undefined;
          const organizationCode = credentials?.organizationCode as string | undefined;

          /* -----------------------------------------------
             BASIC VALIDATION
          ----------------------------------------------- */

          if (
            !empId ||
            !password
          ) {
            console.warn(
              "[AUTH] Employee ID or password missing"
            );

            return null;
          }

          /* -----------------------------------------------
             FIND USER
          ----------------------------------------------- */

          const orgId = await organizationIdForCode(organizationCode);
          if (organizationCode && !orgId) return null;
          const candidates = await User.find({
            username: empId.trim(),
            ...(orgId ? { orgId } : {}),
          }).limit(2).lean();
          if (candidates.length !== 1) return null;
          const user = candidates[0];

          if (!user) {
            console.warn(
              `[AUTH] User not found: ${empId}`
            );

            return null;
          }

          /* -----------------------------------------------
             CHECK USER STATUS
          ----------------------------------------------- */

          if (
            user.status !==
            "Active"
          ) {
            console.warn(
              `[AUTH] User inactive: ${empId}`
            );

            return null;
          }

          /* -----------------------------------------------
             PASSWORD CHECK
          ----------------------------------------------- */

          if (!user.password) {
            console.warn(
              `[AUTH] Password missing for user: ${empId}`
            );

            return null;
          }

          const isValid =
            await bcrypt.compare(
              password,
              user.password
            );

          if (!isValid) {
            console.warn(
              `[AUTH] Invalid password: ${empId}`
            );

            return null;
          }

          /* -----------------------------------------------
             LOGIN SUCCESS
          ----------------------------------------------- */

          console.log(
            `[AUTH] Login successful: ${empId}`
          );

          const employee = await Employee.findOne({
            orgId: user.orgId,
            empId: user.username,
          }).select("designation isManager").lean();
          const resolvedRole = employee?.designation?.trim().toUpperCase() === "DIRECTOR"
            ? "DIRECTOR"
            : employee?.isManager && user.role === "USER"
              ? "MANAGER"
              : user.role;

          return {
            /*
             * MongoDB User Object ID
             */
            id:
              user._id.toString(),

            /*
             * Employee display name.
             *
             * Change employeeName below if your
             * User model uses another field,
             * for example:
             *
             * name
             * fullName
             * employee_name
             */
            name:
              user.employeeName ||
              user.name ||
              user.username,

            /*
             * Employee ID
             */
            empId:
              user.username,

            /*
             * Role
             */
            role:
              resolvedRole,

            /*
             * Organization
             */
            orgId:
              user.orgId,

            /*
             * First-login flag
             */
            isFirstLogin:
              Boolean(
                user.isFirstLogin
              ),
          };
        } catch (error) {
          console.error(
            "[AUTH] AUTHORIZE ERROR:",
            error
          );

          return null;
        }
      },
    }),
  ],

  /* =======================================================
     SESSION CONFIG
  ======================================================= */

  session: {
    strategy: "jwt",

    /*
     * 30 days
     */
    maxAge:
      30 *
      24 *
      60 *
      60,
  },

  /* =======================================================
     CALLBACKS
  ======================================================= */

  callbacks: {
    /* =====================================================
       JWT CALLBACK

       Runs when user logs in.
       Stores employee information in JWT.
    ===================================================== */

    async jwt({
      token,
      user,
    }) {
      if (user) {
        token.id =
          user.id;

        token.name =
          user.name;

        token.empId =
          user.empId;

        token.role =
          user.role;

        token.orgId =
          user.orgId;

        token.isFirstLogin =
          user.isFirstLogin;
      } else if (token.id && token.empId && token.orgId) {
        // Refresh authorization from the database so promotions to Manager,
        // Director or Admin appear without requiring a new browser login.
        await connectDB();
        const [activeUser, employee] = await Promise.all([
          User.findOne({ _id: token.id, username: token.empId, orgId: token.orgId, status: "Active" }).select("role").lean(),
          Employee.findOne({ empId: token.empId, orgId: token.orgId, status: "Active" }).select("designation isManager").lean(),
        ]);
        if (activeUser && employee) {
          token.role = employee.designation?.trim().toUpperCase() === "DIRECTOR"
            ? "DIRECTOR"
            : employee.isManager && activeUser.role === "USER"
              ? "MANAGER"
              : activeUser.role;
        }
      }

      return token;
    },

    /* =====================================================
       SESSION CALLBACK

       Copies JWT information into session.user
    ===================================================== */

    async session({
      session,
      token,
    }) {
      if (
        session.user
      ) {
        session.user.id =
          token.id as string;

        session.user.name =
          token.name as string;

        session.user.empId =
          token.empId as string;

        session.user.role =
          token.role as string;

        session.user.orgId =
          token.orgId as string;

        session.user.isFirstLogin =
          Boolean(
            token.isFirstLogin
          );
      }

      return session;
    },
  },

  /* =======================================================
     CUSTOM PAGES
  ======================================================= */

  pages: {
    signIn: "/",
  },

  /* =======================================================
     SECRET
  ======================================================= */

  secret:
    process.env
      .AUTH_SECRET ??
    process.env
      .NEXTAUTH_SECRET,
});
