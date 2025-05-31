// metadata-utils.js
const sharp = require('sharp');
const axios = require('axios');
const { exiftool } = require('exiftool-vendored');
const fs = require('fs/promises');
const path = require('path');
const os = require('os');

async function downloadImage(url) {
  const response = await axios.get(url, { responseType: 'arraybuffer' });
  return Buffer.from(response.data, 'binary');
}

async function compressAndEmbedMetadata(image, index) {
  const { public_url, ai_description, subfolder, ai_tags } = image;

  const imageBuffer = await downloadImage(public_url);

  // Resize image to 60% of original size
  const resizedBuffer = await sharp(imageBuffer).resize({ width: Math.round(0.6 * 3000), withoutEnlargement: true }).toBuffer();

  // Create temp file path
  const tempFilePath = path.join(os.tmpdir(), `image-${index}.jpg`);
  await fs.writeFile(tempFilePath, resizedBuffer);

  // Embed metadata
  await exiftool.write(tempFilePath, {
    Title: subfolder || '',
    Description: ai_description || '',
    Keywords: ai_tags || '',
  });

  // Read updated image back into buffer
  const finalBuffer = await fs.readFile(tempFilePath);

  // Clean up
  await fs.unlink(tempFilePath);

  return {
    buffer: finalBuffer,
    filename: `${subfolder || 'image'}-${index}.jpg`,
  };
}

module.exports = {
  compressAndEmbedMetadata,
};
