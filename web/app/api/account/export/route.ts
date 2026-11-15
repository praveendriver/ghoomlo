import { currentUser } from "@/lib/auth/session";
import { exportUserData } from "@/lib/data/users";

export async function GET(): Promise<Response> {
  const user = await currentUser();
  if (!user) return new Response("Sign in to download your data.", { status: 401 });
  const data = await exportUserData(user.id);
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": 'attachment; filename="ghoomlo-data.json"',
      "Cache-Control": "no-store",
    },
  });
}
