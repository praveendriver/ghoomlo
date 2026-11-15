import { SiteFooter, SiteHeader } from "@/components/SiteHeader";
import { requireUser } from "@/lib/auth/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireUser();
  return (
    <>
      <SiteHeader signedIn />
      <main>{children}</main>
      <SiteFooter />
    </>
  );
}
