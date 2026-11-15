import { redirect } from "next/navigation";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";
import { currentUser } from "@/lib/auth/session";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  if (await currentUser()) redirect("/trips");
  return (
    <>
      <SiteHeader signedIn={false} />
      <main style={{ maxWidth: 440, margin: "0 auto" }}>{children}</main>
      <SiteFooter />
    </>
  );
}
