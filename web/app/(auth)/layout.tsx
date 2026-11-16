import Image from "next/image";
import { redirect } from "next/navigation";
import { Brand } from "@/components/SiteHeader";
import { currentUser } from "@/lib/auth/session";
import { PHOTOS } from "@/lib/photos";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  if (await currentUser()) redirect("/trips");
  return (
    <div className="auth">
      <aside className="auth-photo on-photo">
        <Image src={PHOTOS.hawaMahal} alt="" fill priority placeholder="blur" sizes="50vw" />
        <Brand />
        <blockquote>A plan that fits your family, and tells you what to check.</blockquote>
      </aside>
      <main className="auth-form">
        <div className="only-narrow">
          <Brand />
        </div>
        {children}
      </main>
    </div>
  );
}
