const axios = require('axios');
const sharp = require('sharp');
const { exiftool } = require('exiftool-vendored');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

/**
 * Download image, resize/compress, embed metadata, return tagged buffer.
 */
async function compressAndEmbedMetadata(image, index) {
  const { image_url, ai_description, subfolder_title } = image;

  if (!image_url) throw new Error(`Missing image_url for image ${index}`);

  console.log(`Downloading image from: ${image_url}`);

  const response = await axios.get(image_url, { responseType: 'arraybuffer' });
  const inputBuffer = Buffer.from(response.data);

  // Resize and compress
  const resizedBuffer = await sharp(inputBuffer)
    .resize({ width: 1600, withoutEnlargement: true })
    .jpeg({ quality: 70 })
    .toBuffer();

  const title = subfolder_title || `Image-${index}`;
  const description = ai_description || 'No description provided.';

  // Write to a temp file
  const tempDir = os.tmpdir();
  const tempPath = path.join(tempDir, `image-${Date.now()}-${index}.jpg`);
  await fs.writeFile(tempPath, resizedBuffer);

  // Embed metadata
  await exiftool.write(tempPath, {
    Title: title,
    Description: `Short description: ${description}`,
  });

  // Read back modified file
  const taggedBuffer = await fs.readFile(tempPath);

  // Clean up
  await fs.unlink(tempPath);

  const safeFilename = `${title.replace(/[^a-zA-Z0-9-_]/g, '_')}.jpg`;

  return {
    buffer: taggedBuffer,
    filename: safeFilename,
  };
}

module.exports = { compressAndEmbedMetadata };
