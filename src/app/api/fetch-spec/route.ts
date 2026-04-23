import {
  PublicSpecFetchError,
  isPublicSpecFetchError,
} from "@/features/openapi-diff/lib/public-spec-url";
import { fetchPublicSpecText } from "@/features/openapi-diff/lib/public-spec-fetch.server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
} as const;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { url?: unknown };

    if (typeof body.url !== "string") {
      throw new PublicSpecFetchError(
        "invalid-url",
        "A public http or https URL is required.",
        400,
      );
    }

    const result = await fetchPublicSpecText(body.url);

    return Response.json(
      {
        content: result.content,
        contentType: result.contentType,
        finalUrl: result.finalUrl,
        redirected: result.redirected,
      },
      {
        headers: NO_STORE_HEADERS,
        status: 200,
      },
    );
  } catch (error) {
    const failure = isPublicSpecFetchError(error)
      ? error
      : new PublicSpecFetchError(
          "fetch-failed",
          "The remote document could not be fetched.",
          502,
        );

    return Response.json(
      {
        code: failure.code,
        error: failure.message,
      },
      {
        headers: NO_STORE_HEADERS,
        status: failure.status,
      },
    );
  }
}
