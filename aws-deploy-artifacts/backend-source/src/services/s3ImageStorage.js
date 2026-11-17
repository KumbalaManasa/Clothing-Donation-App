const crypto = require('crypto');
const { PutObjectCommand, S3Client } = require('@aws-sdk/client-s3');
const { parseImageDataUri } = require('./localImageStorage');

const s3 = new S3Client({ region: process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION });

function getImageBaseUrl() {
  const baseUrl = process.env.S3_PUBLIC_BASE_URL;
  if (!baseUrl) {
    throw new Error('S3_PUBLIC_BASE_URL must be set to the HTTPS CloudFront domain for S3 uploads');
  }

  let parsed;
  try {
    parsed = new URL(baseUrl);
  } catch {
    throw new Error('S3_PUBLIC_BASE_URL must be a valid HTTPS URL');
  }
  if (parsed.protocol !== 'https:' || parsed.search || parsed.hash) {
    throw new Error('S3_PUBLIC_BASE_URL must be an HTTPS origin or path without query or hash');
  }

  return parsed.toString().replace(/\/$/, '');
}

async function uploadImage(dataUri) {
  const bucket = process.env.S3_BUCKET_NAME;
  if (!bucket) throw new Error('S3_BUCKET_NAME must be set when IMAGE_STORAGE_DRIVER=s3');

  const imageBaseUrl = getImageBaseUrl();
  const { buffer, mimeType, ext } = parseImageDataUri(dataUri);
  const key = `uploads/${crypto.randomUUID()}.${ext}`;

  await s3.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: buffer,
    ContentType: mimeType,
    CacheControl: 'public, max-age=31536000, immutable',
    ServerSideEncryption: 'AES256',
  }));

  const encodedKey = key.split('/').map(encodeURIComponent).join('/');
  return `${imageBaseUrl}/${encodedKey}`;
}

module.exports = { uploadImage };
