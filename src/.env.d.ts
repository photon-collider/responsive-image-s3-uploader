/// <reference types="astro/client" />

interface ImportMetaEnv {
  /**
   * The endpoint URL for the S3-compatible storage service
   * Example: https://nyc3.digitaloceanspaces.com or https://xxx.r2.cloudflarestorage.com
   */
  readonly S3_ENDPOINT: string;

  /**
   * The region for the S3-compatible storage service
   * Example: us-east-1, nyc3, or 'auto' for Cloudflare R2
   */
  readonly S3_REGION: string;

  /**
   * The access key ID for the S3-compatible storage service
   */
  readonly S3_ACCESS_KEY_ID: string;

  /**
   * The secret access key for the S3-compatible storage service
   */
  readonly S3_SECRET_ACCESS_KEY: string;

  /**
   * The name of your bucket in the S3-compatible storage service
   */
  readonly S3_BUCKET_NAME: string;

  /**
   * The public URL base for accessing objects in your bucket
   * Example: https://your-bucket.nyc3.digitaloceanspaces.com or https://your-custom-domain.com
   */
  readonly S3_PUBLIC_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
