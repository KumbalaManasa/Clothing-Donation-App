const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Task 13A — local-filesystem image storage driver. Selected via
// src/services/imageStorage.js's IMAGE_STORAGE_DRIVER seam so routes never
// import this file directly. Accepts the same `data:<mime>;base64,<data>`
// URIs the frontend already sends to the Cloudinary driver (CreateListingForm
// / DistributeForm read files via FileReader.readAsDataURL) — no frontend
// request shape changed.
const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads');
const MAX_BYTES = 5 * 1024 * 1024; // 5MB — generous for a phone photo, small enough to bound disk usage.

const ALLOWED_MIME_EXT = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

class ImageValidationError extends Error {}

function parseImageDataUri(dataUri) {
  if (typeof dataUri !== 'string') {
    throw new ImageValidationError('photo must be a base64 data URI string');
  }

  const match = /^data:([^;]+);base64,(.+)$/s.exec(dataUri);
  if (!match) {
    throw new ImageValidationError('photo must be a data URI in the form data:<mime>;base64,<data>');
  }

  const [, mimeType, base64Data] = match;
  const ext = ALLOWED_MIME_EXT[mimeType.toLowerCase()];
  if (!ext) {
    throw new ImageValidationError(`Unsupported image type '${mimeType}'`);
  }

  const buffer = Buffer.from(base64Data, 'base64');
  if (buffer.length === 0) {
    throw new ImageValidationError('photo data is empty');
  }
  if (buffer.length > MAX_BYTES) {
    throw new ImageValidationError(`photo exceeds the maximum size of ${MAX_BYTES} bytes`);
  }

  return { buffer, mimeType: mimeType.toLowerCase(), ext };
}

async function uploadImage(dataUri) {
  const { buffer, ext } = parseImageDataUri(dataUri);

  await fs.promises.mkdir(UPLOAD_DIR, { recursive: true });

  // Filename is always server-generated — the client never controls the path
  // an upload lands at, which rules out path traversal / overwrite via a
  // crafted filename (there is no client-supplied filename to begin with).
  const filename = `${crypto.randomUUID()}.${ext}`;
  await fs.promises.writeFile(path.join(UPLOAD_DIR, filename), buffer);

  return `/uploads/${filename}`;
}

module.exports = { uploadImage, parseImageDataUri, ImageValidationError, UPLOAD_DIR, MAX_BYTES };
