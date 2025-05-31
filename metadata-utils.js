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
  try {
    const {
      public_url,
      ai_description = '',
      subfolder = `Image-${index}`,
      ai_tags = '',
    } = image;

    if (!public_url) {
      console.warn(`Image ${index} is missing a public_url.`);
      throw new Error(`Missing public_url for image ${index}`);
    }

    const imageBuffer = await downloadImage(public_url);

    const resizedBuffer = await sharp(imageBuffer)
      .resize({ width: 1800, withoutEnlargement: true }) // conservative compression
      .toBuffer();

    const tempFilePath = path.join(os.tmpdir(), `image-${index}.jpg`);
    await fs.writeFile(tempFilePath, resizedBuffer);

    await exiftool.write(tempFilePath, {
      Title: subfolder,
      Description: ai_description,
      Keywords: ai_tags,
    });

    const finalBuffer = await fs.readFile(tempFilePath);
    await fs.unlink(tempFilePath);

    return {
      buffer: finalBuffer,
      filename: `${subfolder.replace(/[^a-zA-Z0-9_-]/g, '_')}-${index}.jpg`,
    };
  } catch (err) {
    console.error(`Error processing image ${index}:`, err.message);
    throw err;
  }
}

module.exports = {
  compressAndEmbedMetadata,
};
