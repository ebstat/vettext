import { verwijderVerlopenGesprekken } from "@/lib/retentie";

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return new Response("Unauthorized", { status: 401 });
    }
  }

  const dagen = Number(process.env.RETENTIE_DAGEN ?? 30);
  const aantalVerwijderd = await verwijderVerlopenGesprekken(dagen);

  return Response.json({ verwijderd: aantalVerwijderd });
}
