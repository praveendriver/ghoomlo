import { findAlert, recordClick } from "@/lib/data/fare-watch";

/** Tracked link: note the click, then send the person on to the booking site. */
export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }): Promise<Response> {
  const { code } = await params;
  const alert = await findAlert(code);
  if (!alert) return new Response("This link has expired.", { status: 404 });
  await recordClick(alert.id, new URL(request.url).searchParams.get("s"));
  return new Response(null, {
    status: 302,
    headers: { Location: alert.targetUrl, "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
  });
}
