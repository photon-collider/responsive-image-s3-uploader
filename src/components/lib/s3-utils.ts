import {
  S3Client,
  PutObjectCommand,
  ListObjectsV2Command,
  ListBucketsCommand,
} from "@aws-sdk/client-s3";
import sharp from "sharp";

// Dynamic imports to ensure these modules are only loaded in server contexts
const fsPromises = () => import("fs/promises");
const pathModule = () => import("path");
const osModule = () => import("os");

// Load environment variables using standard AWS nomenclature
const s3Endpoint = import.meta.env.S3_ENDPOINT as string; // e.g., 'https://xxx.r2.cloudflarestorage.com'
const s3Region = import.meta.env.S3_REGION as string; // e.g., 'auto' for Cloudflare R2
const s3AccessKeyId = import.meta.env.S3_ACCESS_KEY_ID as string;
const s3SecretAccessKey = import.meta.env.S3_SECRET_ACCESS_KEY as string;
const s3BucketName = import.meta.env.S3_BUCKET_NAME as string;
const s3OriginalBucketName =
  import.meta.env.S3_ORIGINAL_BUCKET_NAME || ("original-images" as string);
const s3PublicUrl = import.meta.env.S3_PUBLIC_URL as string; // Public URL for accessing objects
// No need for original public URL as originals will be private

// Define responsive image sizes (by long edge)
const sizes = [
  { longEdge: 400, suffix: "400" },
  { longEdge: 600, suffix: "600" },
  { longEdge: 900, suffix: "900" },
  { longEdge: 1200, suffix: "1200" },
  { longEdge: 1800, suffix: "1800" },
];

// Define output formats
const formats = [
  { format: "jpeg", extension: "jpg", contentType: "image/jpeg" },
  //   { format: "avif", extension: "avif", contentType: "image/avif" },
];

// Create S3 client for any S3-compatible storage
const s3Client = new S3Client({
  endpoint: s3Endpoint,
  region: s3Region,
  credentials: {
    accessKeyId: s3AccessKeyId,
    secretAccessKey: s3SecretAccessKey,
  },
  // For some S3-compatible services, force path style might be needed
  forcePathStyle: true,
});

// Interface for upload results
export interface UploadResult {
  originalKey: string;
  originalBucket: string;
  responsiveUrls: {
    [key: string]: string; // size suffix -> URL
  };
  formatUrls: {
    [key: string]: {
      // format name
      [key: string]: string; // size suffix -> URL
    };
  };
  altText: string;
  folderName: string;
  bucketName: string;
}

/**
 * Fetches a list of all available buckets
 */
export async function listBuckets(): Promise<
  { name: string; creationDate?: Date }[]
> {
  try {
    const command = new ListBucketsCommand({});
    const response = await s3Client.send(command);

    if (!response.Buckets) {
      return [];
    }

    return response.Buckets.map((bucket) => ({
      name: bucket.Name || "",
      creationDate: bucket.CreationDate,
    }));
  } catch (error) {
    console.error("Error fetching buckets:", error);
    throw error;
  }
}

/**
 * Fetches top-level folders from the S3 bucket
 */
export async function getTopLevelFolders(
  bucketName?: string
): Promise<string[]> {
  try {
    const command = new ListObjectsV2Command({
      Bucket: bucketName || s3BucketName,
      Delimiter: "/",
    });

    const response = await s3Client.send(command);

    // Extract folder names from CommonPrefixes
    const folders: string[] = [];

    if (response.CommonPrefixes) {
      for (const prefix of response.CommonPrefixes) {
        if (prefix.Prefix) {
          // Remove trailing slash
          const folderName = prefix.Prefix.replace(/\/$/, "");
          folders.push(folderName);
        }
      }
    }

    return folders;
  } catch (error) {
    console.error("Error fetching folders:", error);
    throw error;
  }
}

/**
 * Process and upload an image to S3-compatible storage
 */
export async function uploadResponsiveImage(
  imageBuffer: Buffer,
  originalFilename: string,
  folderName: string,
  altText: string,
  bucketName?: string
): Promise<UploadResult> {
  // Create a temporary directory
  const { default: fs } = await fsPromises();
  const { default: path } = await pathModule();
  const { default: os } = await osModule();
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "image-upload-"));

  try {
    // Get file extension and generate filename
    const fileExt = path.extname(originalFilename).toLowerCase();
    const baseFilename = path.basename(originalFilename, fileExt);
    const uniqueFilename = baseFilename;

    // Upload original image unchanged to a separate bucket (private access)
    const originalKey = `${folderName}/${uniqueFilename}-original${fileExt}`;
    await s3Client.send(
      new PutObjectCommand({
        Bucket: s3OriginalBucketName,
        Key: originalKey,
        Body: imageBuffer,
        ContentType: `image/${fileExt.substring(1)}`,
        // No ACL specified, defaults to private
      })
    );

    // Get image metadata to determine orientation
    const metadata = await sharp(imageBuffer).metadata();
    const width = metadata.width || 0;
    const height = metadata.height || 0;
    const isPortrait = height > width;

    // Create responsive versions in original format
    const responsiveUrls: { [key: string]: string } = {};

    // Add standard responsive versions in original format (usually JPEG)
    for (const size of sizes) {
      // Resize based on the long edge while maintaining aspect ratio
      const resizeOptions = isPortrait
        ? { height: size.longEdge, fit: "inside" as const }
        : { width: size.longEdge, fit: "inside" as const };

      const resizedBuffer = await sharp(imageBuffer)
        .resize(resizeOptions)
        .toBuffer();

      const responsiveKey = `${folderName}/${uniqueFilename}-${size.suffix}${fileExt}`;

      await s3Client.send(
        new PutObjectCommand({
          Bucket: bucketName || s3BucketName,
          Key: responsiveKey,
          Body: resizedBuffer,
          ContentType: `image/${fileExt.substring(1)}`,
          ACL: "public-read",
        })
      );

      responsiveUrls[size.suffix] = `${s3PublicUrl}/${responsiveKey}`;
    }

    // Process and upload in different formats
    const formatUrls: { [format: string]: { [size: string]: string } } = {};

    for (const formatInfo of formats) {
      formatUrls[formatInfo.format] = {};

      // For each format, create all defined sizes
      for (const size of sizes) {
        // Resize based on the long edge while maintaining aspect ratio
        const resizeOptions = isPortrait
          ? { height: size.longEdge, fit: "inside" as const }
          : { width: size.longEdge, fit: "inside" as const };

        // Convert to the target format
        const convertedBuffer = await sharp(imageBuffer)
          .resize(resizeOptions)
          .toFormat(formatInfo.format as keyof sharp.FormatEnum)
          .toBuffer();

        const formatKey = `${folderName}/${uniqueFilename}-${size.suffix}.${formatInfo.extension}`;

        await s3Client.send(
          new PutObjectCommand({
            Bucket: bucketName || s3BucketName,
            Key: formatKey,
            Body: convertedBuffer,
            ContentType: formatInfo.contentType,
            ACL: "public-read",
          })
        );

        formatUrls[formatInfo.format][
          size.suffix
        ] = `${s3PublicUrl}/${formatKey}`;
      }
    }

    // Save alt text to a file with _alt.txt suffix
    const altTextKey = `${folderName}/${uniqueFilename}_alt.txt`;
    await s3Client.send(
      new PutObjectCommand({
        Bucket: bucketName || s3BucketName,
        Key: altTextKey,
        Body: altText,
        ContentType: "text/plain",
        ACL: "public-read",
      })
    );

    return {
      originalKey: originalKey,
      originalBucket: s3OriginalBucketName,
      responsiveUrls,
      formatUrls,
      altText,
      folderName,
      bucketName: bucketName || s3BucketName,
    };
  } finally {
    // Clean up temporary directory
    const { default: fs } = await fsPromises();
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}
