import "server-only";
import { notFound } from "next/navigation";
import { currentUser } from "./session";
import type { CurrentUser } from "./session";

/**
 * Admins are signed-in users whose email is listed in ADMIN_EMAILS
 * (comma-separated). Everyone else gets a "not found" page, so the admin
 * area's existence is not advertised.
 */
export async function requireAdmin(): Promise<CurrentUser> {
  const user = await currentUser();
  const admins = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (!user || !admins.includes(user.email)) notFound();
  return user;
}
