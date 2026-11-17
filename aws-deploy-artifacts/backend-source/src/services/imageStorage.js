const cloudinaryDriver = require('./cloudinary');
const localDriver = require('./localImageStorage');
const s3Driver = require('./s3ImageStorage');

// Task 13A/13B — configurable image storage seam. Routes (listings.js,
// claims.js) import uploadImage from *this* module only, never a specific
// driver, so switching between local dev and production/cloud storage is a
// single env var:
//   IMAGE_STORAGE_DRIVER=local       (default) — backend/uploads/, no cloud account needed (13A)
//   IMAGE_STORAGE_DRIVER=cloudinary  — existing Cloudinary helper
//   IMAGE_STORAGE_DRIVER=s3          — private S3 bucket delivered through CloudFront
function getDriver() {
  const driver = (process.env.IMAGE_STORAGE_DRIVER || 'local').toLowerCase();
  if (driver === 'cloudinary') return cloudinaryDriver;
  if (driver === 's3') return s3Driver;
  if (driver === 'local') return localDriver;
  throw new Error(`Unknown IMAGE_STORAGE_DRIVER '${driver}' (expected 'local', 'cloudinary', or 's3')`);
}

async function uploadImage(file, options = {}) {
  return getDriver().uploadImage(file, options);
}

module.exports = { uploadImage, ImageValidationError: localDriver.ImageValidationError };
