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
    const { project_id, project, images } = req.body;

    if (!images || images.length === 0) {
      return res.status(400).json({ error: 'No images provided.' });
    }

    if (!project) {
      return res.status(400).json({ error: 'Missing project name.' });
    }

    // Sanitize project name for file naming
    const safeProjectName = project.replace(/[^a-z0-9]/gi, '_').substring(0, 50);

    // Create in-memory zip
    const zipStream = new stream.PassThrough();
    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.pipe(zipStream);

    // Prepare S3 upload
    const uploadParams = {
      Bucket: process.env.S3_BUCKET_NAME,
      Key: `project-exports/${safeProjectName}.zip`,
      Body: zipStream,
      ContentType: 'application/zip',
    };
    const s3Upload = s3.upload(uploadParams).promise();

    // Add compressed + tagged images
    for (let i = 0; i < images.length; i++) {
      const { buffer, filename } = await compressAndEmbedMetadata(images[i], i + 1);
      archive.append(buffer, { name: filename });
    }

    archive.finalize();

    // Wait for S3 upload
    const s3Result = await s3Upload;

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
