const sharp = require('sharp');
const axios = require('axios');
const { exiftool } = require('exiftool-vendored');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { v4: uuidv4 } = require('uuid');

async function compressAndEmbedMetadata(image, index) {
  try {
    const response = await axios.get(image.url, { responseType: 'arraybuffer' });
    const inputBuffer = Buffer.from(response.data);

    // Resize and compress the image
    const resizedBuffer = await sharp(inputBuffer)
      .resize({ width: 1800, withoutEnlargement: true })
      .jpeg({ quality: 70 })
      .toBuffer();

    // Create a temp file path
    const tempDir = os.tmpdir();
    const filename = `${image.subfolder || 'Image'}-${index}.jpg`;
    const tempPath = path.join(tempDir, `${uuidv4()}.jpg`);
    fs.writeFileSync(tempPath, resizedBuffer);

    // Prepare metadata
    const metadata = {
      Title: image.subfolder || `Image ${index}`,
      Description: `Short description: ${image.ai_description || ''}`,
    };

    // Embed metadata using exiftool
    await exiftool.write(tempPath, metadata);

    // Read the file back into buffer
    const finalBuffer = fs.readFileSync(tempPath);

    // Clean up temp file
    fs.unlinkSync(tempPath);

    return { buffer: finalBuffer, filename };
  } catch (err) {
    console.error('Metadata embedding error:', err);
    throw err;
  }
}

module.exports = { compressAndEmbedMetadata };
