import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import MainLayoutClient from "./MainLayoutClient";

export default async function Layout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id || !session.user.empId || !session.user.orgId) redirect("/");
  return <MainLayoutClient>{children}</MainLayoutClient>;
}
