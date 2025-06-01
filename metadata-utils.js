const axios = require('axios');
const sharp = require('sharp');
const { ExiftoolProcess } = require('node-exiftool');
const { Readable } = require('stream');

async function compressAndEmbedMetadata(imageData, index) {
  try {
    const ep = new ExiftoolProcess();
    await ep.open();

    const response = await axios.get(imageData.url, { responseType: 'arraybuffer' });
    const originalBuffer = Buffer.from(response.data, 'binary');

    const resizedBuffer = await sharp(originalBuffer)
      .resize({ width: 1800, withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer();

    const filename = imageData.subfolder_title
      ? `${imageData.subfolder_title}.jpg`
      : `Image-${index}.jpg`;

    const metadata = {
      Title: imageData.subfolder_title || `Image ${index}`,
      Description: `Short description: ${imageData.ai_description || 'No description provided.'}`,
    };

    const input = new Readable();
    input._read = () => {};
    input.push(resizedBuffer);
    input.push(null);

    const tempPath = `/tmp/${Date.now()}-${Math.random().toString(36).substring(2, 8)}.jpg`;
    const imageBufferWithExif = await new Promise((resolve, reject) => {
      const chunks = [];
      input.pipe(sharp().toBuffer())
        .on('data', chunk => chunks.push(chunk))
        .on('end', async () => {
          const completeBuffer = Buffer.concat(chunks);
          require('fs').writeFileSync(tempPath, completeBuffer);
          await ep.writeMetadata(tempPath, metadata, ['overwrite_original']);
          const finalBuffer = require('fs').readFileSync(tempPath);
          resolve(finalBuffer);
        })
        .on('error', reject);
    });

    await ep.close();

    return { buffer: imageBufferWithExif, filename };
  } catch (error) {
    console.error('Metadata embedding error:', error);
    throw error;
  }
}

module.exports = { compressAndEmbedMetadata };
