const axios = require('axios');
const sharp = require('sharp');
const { exiftool } = require('exiftool-vendored');
const { Readable } = require('stream');

/**
 * Download image, resize/compress, and embed metadata.
 */
async function compressAndEmbedMetadata(image, index) {
  const { image_url, ai_description, subfolder_title } = image;

  if (!image_url) {
    throw new Error(`Missing image_url for image index ${index}`);
  }

  const response = await axios.get(image_url, { responseType: 'arraybuffer' });
  const inputBuffer = Buffer.from(response.data);

  // Resize and compress image using sharp
  const resizedBuffer = await sharp(inputBuffer)
    .resize({ width: 1600, withoutEnlargement: true }) // Resize down to 1600px wide if larger
    .jpeg({ quality: 70 }) // Compress quality
    .toBuffer();

  const title = subfolder_title || `Image-${index}`;
  const description = `Short description: ${ai_description || 'No description provided.'}`;

  // Write metadata
  const taggedBuffer = await exiftool.writeBinary(resizedBuffer, {
    Title: title,
    Description: description,
  });

  return {
    buffer: taggedBuffer,
    filename: `${title.replace(/[^a-zA-Z0-9-_]/g, '_')}.jpg`,
  };
}

module.exports = { compressAndEmbedMetadata };
