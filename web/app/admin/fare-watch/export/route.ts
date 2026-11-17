import { requireAdmin } from "@/lib/auth/admin";
import { csvRow } from "@/lib/csv";
import { findAlert, listSignups } from "@/lib/data/fare-watch";
import { matches } from "@/lib/fare-watch";
import { siteUrl } from "@/lib/site-url";

/** All sign-ups as a spreadsheet, or with ?alert=CODE the people to email for one alert, each with a personal link. */
export async function GET(request: Request): Promise<Response> {
  await requireAdmin();
  const code = new URL(request.url).searchParams.get("alert");
  const [signups, base] = await Promise.all([listSignups(), siteUrl()]);
  const stop = (token: string) => `${base}/fare-watch/unsubscribe?t=${encodeURIComponent(token)}`;

  let rows: string[];
  let filename = "fare-watch-signups.csv";
  if (code) {
    const alert = await findAlert(code);
    if (!alert) return new Response("No such alert.", { status: 404 });
    filename = `fare-alert-${code}-recipients.csv`;
    rows = [
      csvRow(["email", "personal_link", "stop_link"]),
      ...signups
        .filter((s) => matches(s, alert))
        .map((s) => csvRow([s.email, `${base}/go/${alert.code}?s=${encodeURIComponent(s.token)}`, stop(s.token)])),
    ];
  } else {
    rows = [
      csvRow(["email", "home_city", "school", "board", "breaks", "wishlist", "travellers", "signed_up", "stop_link"]),
      ...signups.map((s) =>
        csvRow([s.email, s.homeCity, s.school, s.board, s.breaks.join("; "), s.wishlist.join("; "), s.travellers, s.createdAt.toISOString().slice(0, 10), stop(s.token)]),
      ),
    ];
  }
  return new Response(rows.join("\n") + "\n", {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
