const exiftool = require('node-exiftool');
const axios = require('axios');
const sharp = require('sharp');
const stream = require('stream');

const { spawn } = require('child_process');
const ep = new exiftool.ExiftoolProcess();

const compressAndEmbedMetadata = async (image, index) => {
  const { public_url, label, ai_description, subfolder_title } = image;

  // Fetch image buffer
  const response = await axios.get(public_url, { responseType: 'arraybuffer' });
  const inputBuffer = Buffer.from(response.data);

  // Compress image
  const compressedBuffer = await sharp(inputBuffer)
    .resize({ width: 1800, withoutEnlargement: true })
    .jpeg({ quality: 80 })
    .toBuffer();

  // Write metadata tags
  const metadataTags = {
    Title: subfolder_title || label || `Image ${index}`,
    Description: ai_description || '',
    'XPTitle': subfolder_title || '',
    'XPComment': ai_description || '',
  };

  // Use ExifTool to embed metadata
  const { exiftool } = require('exiftool-vendored');
  const fs = require('fs').promises;
  const path = require('path');
  const tmp = require('tmp-promise');

  const { path: tmpPath, cleanup } = await tmp.file({ postfix: '.jpg' });
  await fs.writeFile(tmpPath, compressedBuffer);
  await exiftool.write(tmpPath, metadataTags);
  const finalBuffer = await fs.readFile(tmpPath);
  await cleanup();

  const filename = `Image-${index}.jpg`;
  return { buffer: finalBuffer, filename };
};

module.exports = { compressAndEmbedMetadata };
