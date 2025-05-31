const express = require('express');
const bodyParser = require('body-parser');
const JSZip = require('jszip');
const axios = require('axios');
const { embedMetadataToBase64 } = require('./metadata-utils');
const AWS = require('aws-sdk');
require('dotenv').config();

const app = express();
app.use(bodyParser.json({ limit: '50mb' }));

const s3 = new AWS.S3({
  region: process.env.AWS_REGION,
});

app.post('/export', async (req, res) => {
  const { project_id, photos } = req.body;

  if (!project_id || !photos || !Array.isArray(photos)) {
    return res.status(400).json({ error: 'Invalid payload.' });
  }

  try {
    const zip = new JSZip();

    for (let index = 0; index < photos.length; index++) {
      const photo = photos[index];
      const { public_url, ai_description, Folder, created_date } = photo;

      if (!public_url || !public_url.startsWith('http')) {
        console.error('❌ Skipping photo due to invalid URL:', JSON.stringify(photo, null, 2));
        continue;
      }

      const response = await axios.get(public_url, { responseType: 'arraybuffer' });
      const imageBase64 = Buffer.from(response.data, 'binary').toString('base64');
      const base64WithExif = embedMetadataToBase64("data:image/jpeg;base64," + imageBase64, {
        description: ai_description,
        folder: Folder,
        projectId: project_id,
        createdDate: created_date
      });

      const cleanBase64 = base64WithExif.split(',')[1];
      const safeName = Folder?.replace(/[<>:"/\\|?*]+/g, '-').trim() || `Photo-${index + 1}`;
      const fileName = `${safeName}.jpg`;

      zip.file(fileName, cleanBase64, { base64: true });
    }

    const zipContent = await zip.generateAsync({ type: 'nodebuffer' });
    const s3Key = `exports/${project_id}-${Date.now()}.zip`;

    await s3.putObject({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: s3Key,
      Body: zipContent,
      ContentType: 'application/zip',
      ACL: 'public-read',
    }).promise();

    const s3Url = `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${s3Key}`;
    return res.json({ url: s3Url });
  } catch (error) {
    console.error('Export failed:', error);
    return res.status(500).json({ error: 'Failed to export photos.' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Export server running on port ${PORT}`);
});
