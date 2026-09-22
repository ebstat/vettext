import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";

/**
 * Geeft de browser een kortlevend token om de opname rechtstreeks naar Vercel
 * Blob te uploaden — dit omzeilt de harde 4,5MB-limiet op de request-body van
 * een Vercel Function (multipart/form-data via deze route zelf zou daar bij
 * langere opnames overheen gaan).
 */
export async function POST(request: Request) {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => ({
        // webm is een containerformaat voor zowel audio als video; sommige browsers
        // labelen een audio-only MediaRecorder-opname toch als "video/webm". We nemen
        // hier alleen audio op, dus staan dat expliciet ook toe naast "audio/*".
        allowedContentTypes: ["audio/*", "video/webm"],
      }),
      onUploadCompleted: async () => {
        // Niet nodig: de client stuurt de blob-URL direct door naar POST
        // /api/gesprekken zodra de upload klaar is, dus we hoeven hier niet op
        // een callback van Vercel te wachten (die lokaal ook niet bereikbaar is).
      },
    });

    return Response.json(jsonResponse);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Onbekende fout";
    return Response.json({ error: message }, { status: 400 });
  }
}
