// One-off script for Spec/tasks.md task 0.10 — confirms Cloudinary credentials
// (HLD §3 chosen media storage) work by uploading a fixture image and printing its URL.
require('dotenv').config();

const path = require('path');
const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

async function main() {
  const imagePath = path.join(__dirname, 'fixtures', 'test-image.png');

  const result = await cloudinary.uploader.upload(imagePath, {
    folder: 'donation-app-test',
  });

  console.log(result.secure_url);
}

main().catch((err) => {
  console.error('Upload failed:', err.message);
  process.exit(1);
});
