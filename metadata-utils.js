const axios = require('axios');
const sharp = require('sharp');
const { exiftool } = require('exiftool-vendored');
const { Readable } = require('stream');

/**
 * Download, resize, and embed metadata into image.
 */
async function compressAndEmbedMetadata(image, index) {
  const { image_url, ai_description, subfolder_title } = image;

  if (!image_url) {
    throw new Error(`Missing image_url for image at index ${index}`);
  }

  console.log(`Downloading image from: ${image_url}`);

  let response;
  try {
    response = await axios.get(image_url, { responseType: 'arraybuffer' });
  } catch (err) {
    throw new Error(`Failed to download image at index ${index}: ${err.message}`);
  }

  const inputBuffer = Buffer.from(response.data);

  const resizedBuffer = await sharp(inputBuffer)
    .resize({ width: 1600, withoutEnlargement: true })
    .jpeg({ quality: 70 })
    .toBuffer();

  const title = subfolder_title || `Image-${index}`;
  const description = ai_description
    ? `Short description: ${ai_description}`
    : 'No description provided.';

  let taggedBuffer;
  try {
    taggedBuffer = await exiftool.writeBinary(resizedBuffer, {
      Title: title,
      Description: description,
    });
  } catch (err) {
    throw new Error(`Failed to write metadata for image ${index}: ${err.message}`);
  }

  const safeFilename = `${title.replace(/[^a-zA-Z0-9-_]/g, '_')}.jpg`;

  return {
    buffer: taggedBuffer,
    filename: safeFilename,
  };
}

module.exports = { compressAndEmbedMetadata };
