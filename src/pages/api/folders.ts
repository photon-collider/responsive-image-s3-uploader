import type { APIRoute } from "astro";
import { getTopLevelFolders } from "@components/lib/s3-utils";

export const GET: APIRoute = async ({ request }) => {
  try {
    // Get bucket from query parameters if available
    const url = new URL(request.url);
    const bucketName = url.searchParams.get("bucket") || undefined;

    const folders = await getTopLevelFolders(bucketName);

    return new Response(
      JSON.stringify({
        success: true,
        folders,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("Error fetching folders:", error);

    return new Response(
      JSON.stringify({
        success: false,
        error: "Failed to fetch folders",
        details: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }
};
