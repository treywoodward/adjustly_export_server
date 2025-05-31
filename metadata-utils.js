const axios = require('axios');
const sharp = require('sharp');
const { ExiftoolProcess } = require('node-exiftool');
const { Readable } = require('stream');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

const compressAndEmbedMetadata = async (image, index) => {
  const { public_url, label, ai_description, subfolder_title } = image;

  if (!public_url) throw new Error('Missing image URL');

  // 1. Download image
  const response = await axios.get(public_url, { responseType: 'arraybuffer' });
  const inputBuffer = Buffer.from(response.data);

  // 2. Resize and compress
  const compressedBuffer = await sharp(inputBuffer)
    .resize({ width: 1800, withoutEnlargement: true })
    .jpeg({ quality: 70 })
    .toBuffer();

  // 3. Write to temp file
  const tempFilePath = path.join(os.tmpdir(), `temp-${Date.now()}-${index}.jpg`);
  await fs.writeFile(tempFilePath, compressedBuffer);

  // 4. Write metadata
  const exiftool = new ExiftoolProcess();
  await exiftool.open();

  const metadata = {
    Title: subfolder_title || label || `Image ${index}`,
    Description: `Short description: ${ai_description || ''}`.trim(),
  };

  await exiftool.writeMetadata(tempFilePath, metadata, ['overwrite_original']);
  await exiftool.close();

  // 5. Read back final file
  const finalBuffer = await fs.readFile(tempFilePath);
  await fs.unlink(tempFilePath);

  // 6. Construct sanitized filename
  const rawName = subfolder_title || label || `Image-${index}`;
  const sanitizedTitle = rawName.replace(/[^a-z0-9]/gi, '_').substring(0, 50);
  const filename = `${sanitizedTitle}.jpg`;

  return { buffer: finalBuffer, filename };
};

module.exports = { compressAndEmbedMetadata };
