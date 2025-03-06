import type { APIRoute } from "astro";
import { uploadResponsiveImage } from "@components/lib/s3-utils";

export const POST: APIRoute = async ({ request }) => {
  try {
    const formData = await request.formData();

    // Extract form fields
    const imageFile = formData.get("image") as File;
    const folderName = formData.get("folderName") as string;
    const altText = formData.get("altText") as string;
    const bucketName = (formData.get("bucketName") as string) || undefined;

    // Validate inputs
    if (!imageFile || !folderName || !altText) {
      return new Response(
        JSON.stringify({
          error: "Missing required fields",
        }),
        { status: 400 }
      );
    }

    // Check file type
    if (!imageFile.type.startsWith("image/")) {
      return new Response(
        JSON.stringify({
          error: "File must be an image",
        }),
        { status: 400 }
      );
    }

    // Convert file to buffer
    const buffer = Buffer.from(await imageFile.arrayBuffer());

    // Upload to S3
    const result = await uploadResponsiveImage(
      buffer,
      imageFile.name,
      folderName.trim(),
      altText.trim(),
      bucketName
    );

    return new Response(
      JSON.stringify({
        success: true,
        data: result,
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error("Upload error:", error);

    return new Response(
      JSON.stringify({
        error: "Failed to upload image",
        details: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500 }
    );
  }
};
