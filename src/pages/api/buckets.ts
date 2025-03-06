import type { APIRoute } from "astro";
import { listBuckets } from "@components/lib/s3-utils";

export const GET: APIRoute = async () => {
  try {
    const buckets = await listBuckets();

    return new Response(
      JSON.stringify({
        success: true,
        buckets,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("Error fetching buckets:", error);

    return new Response(
      JSON.stringify({
        success: false,
        error: "Failed to fetch buckets",
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
