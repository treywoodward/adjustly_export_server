// metadata-utils.js
const sharp = require('sharp');
const exiftool = require('node-exiftool');
const exiftoolBin = require('dist-exiftool');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const ep = new exiftool.ExiftoolProcess(exiftoolBin);

async function compressAndEmbedMetadata(image, index) {
  try {
    const { public_url, ai_description, subfolder_title } = image;

    // Download the image
    const response = await axios.get(public_url, { responseType: 'arraybuffer' });
    const imageBuffer = Buffer.from(response.data, 'binary');

    // Compress the image
    const compressedBuffer = await sharp(imageBuffer)
      .jpeg({ quality: 70 }) // adjust quality as needed
      .toBuffer();

    // Create a temporary file
    const tempFilename = `temp-${uuidv4()}.jpg`;
    const tempPath = path.join(__dirname, tempFilename);
    fs.writeFileSync(tempPath, compressedBuffer);

    // Embed metadata
    await ep.open();
    await ep.writeMetadata(tempPath, {
      all: '', // clear existing tags
      Description: `Short description: ${ai_description}`,
      Title: subfolder_title || `Image ${index}`,
    }, ['overwrite_original']);
    await ep.close();

    // Read updated image back
    const finalBuffer = fs.readFileSync(tempPath);

    // Cleanup
    fs.unlinkSync(tempPath);

    return {
      buffer: finalBuffer,
      filename: `Image-${index}.jpg`,
    };
  } catch (err) {
    console.error(`Error processing image ${index}:`, err);
    throw err;
  }
}

module.exports = {
  compressAndEmbedMetadata,
};
