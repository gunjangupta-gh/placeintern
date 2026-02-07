/**
 * =============================================================================
 * MINIO TO MINIO MIGRATION SCRIPT
 * =============================================================================
 *
 * This script copies all objects (optionally filtered by prefix) from a source
 * MinIO (via SSH tunnel if needed) to a destination MinIO using S3 APIs.
 *
 * USAGE:
 *   npx ts-node scripts/migrate-minio-to-minio.ts
 *
 * OPTIONS (via environment variables):
 *   DRY_RUN=true             - Preview copy without uploading
 *   PREFIX=some/path/        - Only copy objects with this prefix
 *   SOURCE_MINIO_ENDPOINT    - e.g. http://127.0.0.1:9001 (plink tunnel)
 *   SOURCE_MINIO_BUCKET
 *   SOURCE_MINIO_ACCESS_KEY
 *   SOURCE_MINIO_SECRET_KEY
 *
 * DESTINATION uses:
 *   MINIO_ENDPOINT, MINIO_BUCKET, MINIO_ROOT_USER, MINIO_ROOT_PASSWORD
 * =============================================================================
 */

import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
  PutObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
} from '@aws-sdk/client-s3';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { Readable } from 'stream';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const CONFIG = {
  // Source MinIO
  SOURCE_ENDPOINT: process.env.SOURCE_MINIO_ENDPOINT || 'http://127.0.0.1:9000',
  SOURCE_BUCKET: process.env.SOURCE_MINIO_BUCKET || process.env.MINIO_BUCKET || 'cms-uploads',
  SOURCE_ACCESS_KEY: process.env.SOURCE_MINIO_ACCESS_KEY || process.env.MINIO_ROOT_USER || 'minioadmin',
  SOURCE_SECRET_KEY: process.env.SOURCE_MINIO_SECRET_KEY || process.env.MINIO_ROOT_PASSWORD || 'minioadmin123',
  SOURCE_REGION: process.env.SOURCE_MINIO_REGION || 'us-east-1',

  // Destination MinIO
  DEST_ENDPOINT: process.env.MINIO_ENDPOINT,
  DEST_BUCKET: process.env.MINIO_BUCKET || 'cms-uploads',
  DEST_ACCESS_KEY: process.env.MINIO_ROOT_USER || 'minioadmin',
  DEST_SECRET_KEY: process.env.MINIO_ROOT_PASSWORD || 'minioadmin123',
  DEST_REGION: process.env.MINIO_REGION || 'us-east-1',

  // Options
  DRY_RUN: process.env.DRY_RUN === 'true',
  PREFIX: process.env.PREFIX || '',
};

function createMinioClient(endpoint: string, accessKey: string, secretKey: string, region: string): S3Client {
  return new S3Client({
    endpoint,
    region,
    credentials: {
      accessKeyId: accessKey,
      secretAccessKey: secretKey,
    },
    forcePathStyle: true,
  });
}

async function ensureBucketExists(s3: S3Client, bucket: string): Promise<boolean> {
  try {
    await s3.send(new HeadBucketCommand({ Bucket: bucket }));
    return true;
  } catch (error: any) {
    if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
      await s3.send(new CreateBucketCommand({ Bucket: bucket }));
      return true;
    }
    throw error;
  }
}

async function listAllObjects(s3: S3Client, bucket: string, prefix: string) {
  let continuationToken: string | undefined;
  const keys: Array<{ key: string; size?: number }> = [];

  do {
    const response = await s3.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix || undefined,
        ContinuationToken: continuationToken,
      })
    );

    const contents = response.Contents || [];
    for (const item of contents) {
      if (item.Key) {
        keys.push({ key: item.Key, size: item.Size });
      }
    }

    continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
  } while (continuationToken);

  return keys;
}

async function copyObject(
  source: S3Client,
  dest: S3Client,
  sourceBucket: string,
  destBucket: string,
  key: string
) {
  const getResp = await source.send(
    new GetObjectCommand({
      Bucket: sourceBucket,
      Key: key,
    })
  );

  const body = getResp.Body as Readable;

  await dest.send(
    new PutObjectCommand({
      Bucket: destBucket,
      Key: key,
      Body: body,
      ContentType: getResp.ContentType,
      Metadata: getResp.Metadata,
    })
  );
}

async function main() {
  console.log('MINIO TO MINIO MIGRATION');
  console.log(`Source: ${CONFIG.SOURCE_ENDPOINT} / ${CONFIG.SOURCE_BUCKET}`);
  console.log(`Destination: ${CONFIG.DEST_ENDPOINT} / ${CONFIG.DEST_BUCKET}`);
  console.log(`DRY_RUN: ${CONFIG.DRY_RUN}`);
  console.log(`PREFIX: ${CONFIG.PREFIX || '(none)'}`);

  if (!CONFIG.DEST_ENDPOINT) {
    throw new Error('MINIO_ENDPOINT is not set for destination');
  }

  const sourceClient = createMinioClient(
    CONFIG.SOURCE_ENDPOINT,
    CONFIG.SOURCE_ACCESS_KEY,
    CONFIG.SOURCE_SECRET_KEY,
    CONFIG.SOURCE_REGION
  );

  const destClient = createMinioClient(
    CONFIG.DEST_ENDPOINT,
    CONFIG.DEST_ACCESS_KEY,
    CONFIG.DEST_SECRET_KEY,
    CONFIG.DEST_REGION
  );

  await ensureBucketExists(destClient, CONFIG.DEST_BUCKET);

  const objects = await listAllObjects(sourceClient, CONFIG.SOURCE_BUCKET, CONFIG.PREFIX);
  console.log(`Found ${objects.length} objects to copy`);

  let copied = 0;
  let errors = 0;

  for (const obj of objects) {
    try {
      if (CONFIG.DRY_RUN) {
        console.log(`[DRY_RUN] ${obj.key} (${((obj.size || 0) / 1024).toFixed(1)} KB)`);
        copied++;
        continue;
      }

      process.stdout.write(`Copying ${obj.key}... `);
      await copyObject(sourceClient, destClient, CONFIG.SOURCE_BUCKET, CONFIG.DEST_BUCKET, obj.key);
      console.log('OK');
      copied++;
    } catch (error: any) {
      console.log(`FAILED (${error.message})`);
      errors++;
    }
  }

  console.log('');
  console.log('MIGRATION SUMMARY');
  console.log(`Total: ${objects.length}`);
  console.log(`Copied: ${copied}`);
  console.log(`Errors: ${errors}`);
}

main().catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
