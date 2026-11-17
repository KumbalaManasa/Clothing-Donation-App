const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Reusable upload helper — HLD §3 chosen media storage. Used by the listing
// creation flow (LLD §1.3/§1.5 photo_url fields) once it exists (Phase 3).
// Blocked on real Cloudinary credentials (task 0.10) for end-to-end verification;
// the call shape/plumbing is correct and fails cleanly against Cloudinary's API
// otherwise (see Spec/tasks.md task 0.10/3.1 notes).
async function uploadImage(file, options = {}) {
  const result = await cloudinary.uploader.upload(file, options);
  return result.secure_url;
}

module.exports = { uploadImage };
