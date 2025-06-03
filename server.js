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
  console.log('---- RAW BODY START ----');
  console.log(req.body);
  console.log('---- RAW BODY END ----');

  try {
    let { project_id, project, images } = req.body;

    // Handle edge case: Bubble sometimes sends JSON as a string
    if (typeof images === 'string') {
      try {
        images = JSON.parse(images);
        console.log('Parsed `images` from string.');
      } catch (err) {
        console.error('Failed to parse `images` JSON string:', err.message);
        return res.status(400).json({ error: 'Invalid JSON in `images` parameter.' });
      }
    }

    // Validation
    if (!project_id || typeof project_id !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid project_id.' });
    }

    if (!project || typeof project !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid project name.' });
    }

    if (!Array.isArray(images) || images.length === 0) {
      return res.status(400).json({ error: 'No valid images provided.' });
    }

    // Setup zip stream
    const zipStream = new stream.PassThrough();
    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.pipe(zipStream);

    // Setup S3 upload
    const sanitizedProjectName = project.replace(/[^a-zA-Z0-9-_]/g, '_');
    const uploadParams = {
      Bucket: process.env.S3_BUCKET_NAME,
      Key: `project-exports/${sanitizedProjectName}-${Date.now()}.zip`,
      Body: zipStream,
      ContentType: 'application/zip',
    };
    const s3Upload = s3.upload(uploadParams).promise();

    // Process each image
    for (let i = 0; i < images.length; i++) {
      const image = images[i];
      const { public_url, subfolder_title, ai_description } = image;

      if (!public_url || typeof public_url !== 'string') {
        throw new Error(`Missing or invalid public_url for image at index ${i}`);
      }

      console.log(`Processing image ${i + 1}: ${public_url}`);

      const { buffer, filename } = await compressAndEmbedMetadata(
        { image_url: public_url, subfolder_title, ai_description },
        i + 1
      );

      archive.append(buffer, { name: filename });
    }

    archive.finalize();
    const s3Result = await s3Upload;

    console.log('Export successful:', s3Result.Location);
    res.json({ download_url: s3Result.Location });
  } catch (err) {
    console.error('Export error:', err);
    res.status(500).json({ error: 'Export failed. Check server logs for details.' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Export service running on port ${PORT}`);
});
