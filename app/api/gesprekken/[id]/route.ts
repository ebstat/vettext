import { haalGesprekMetRegelsOp } from "@/lib/gesprekken";
import { verwijderGesprekken } from "@/lib/retentie";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const gesprek = await haalGesprekMetRegelsOp(id);
  if (!gesprek) {
    return Response.json({ error: "Gesprek niet gevonden" }, { status: 404 });
  }

  return Response.json(gesprek);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await verwijderGesprekken([id]);
  return new Response(null, { status: 204 });
}
