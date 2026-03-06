import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "../config/env.js";

let s3Client;

function getClient() {
  if (s3Client) return s3Client;
  if (!env.s3Bucket || !env.s3Region) {
    throw new Error("S3 bucket/region not configured");
  }

  const endpoint = env.s3Endpoint;
  const forcePathStyle = env.s3ForcePathStyle;

  s3Client = new S3Client({
    region: env.s3Region,
    endpoint: endpoint || undefined,
    forcePathStyle: forcePathStyle || undefined,
    // Credentials picked from env/role by default
  });
  return s3Client;
}

export async function createPresignedUploadUrl({ key, contentType, expiresIn = 300 }) {
  const client = getClient();
  const command = new PutObjectCommand({
    Bucket: env.s3Bucket,
    Key: key,
    ContentType: contentType || "application/octet-stream",
    ACL: "public-read",
  });
  const url = await getSignedUrl(client, command, { expiresIn });
  return url;
}

export function publicFileUrl(key) {
  if (!env.s3Bucket || !env.s3Region) return null;

  // INFRA: CDN gap — Route image URLs through CloudFront when configured.
  // Set AWS_CLOUDFRONT_URL=https://d1234abcd.cloudfront.net to enable.
  // All existing image URLs will automatically serve from CDN with zero DB changes.
  if (env.cdnUrl) {
    return `${env.cdnUrl.replace(/\/$/, "")}/${key}`;
  }

  if (env.s3Endpoint) {
    // Custom endpoint (e.g., R2/MinIO)
    const base = env.s3Endpoint.replace(/\/$/, "");
    if (env.s3ForcePathStyle) {
      return `${base}/${env.s3Bucket}/${key}`;
    }
    return `${base}/${key}`;
  }

  return `https://${env.s3Bucket}.s3.${env.s3Region}.amazonaws.com/${key}`;
}

