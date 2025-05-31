// server.js
const express = require('express');
const archiver = require('archiver');
const { compressAndEmbedMetadata } = require('./metadata-utils');
const AWS = require('aws-sdk');
const stream = require('stream');
require('dotenv').config();

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

// Configure AWS
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});
const s3 = new AWS.S3();

app.post('/export', async (req, res) => {
  try {
    const { project_id, images } = req.body;

    if (!images || images.length === 0) {
      return res.status(400).json({ error: 'No images provided.' });
    }

    // Create in-memory zip
    const zipStream = new stream.PassThrough();
    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.pipe(zipStream);

    // Prepare zip for upload to S3
    const uploadParams = {
      Bucket: process.env.S3_BUCKET_NAME,
      Key: `project-exports/${project_id}-${Date.now()}.zip`,
      Body: zipStream,
      ContentType: 'application/zip',
    };
    const s3Upload = s3.upload(uploadParams).promise();

    // Add each image to the archive
    for (let i = 0; i < images.length; i++) {
      const { buffer, filename } = await compressAndEmbedMetadata(images[i], i + 1);
      archive.append(buffer, { name: filename });
    }

    archive.finalize();

    // Wait for S3 upload to finish
    const s3Result = await s3Upload;

    // Return public link
    res.json({ download_url: s3Result.Location });
  } catch (err) {
    console.error('Export error:', err);
    res.status(500).json({ error: 'Export failed. Check server logs.' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Export service running on port ${PORT}`);
});
