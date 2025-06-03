const express = require('express');
const archiver = require('archiver');
const { compressAndEmbedMetadata } = require('./metadata-utils');
const AWS = require('aws-sdk');
const stream = require('stream');
const getStream = require('get-stream');
require('dotenv').config();

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

// AWS config
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});
const s3 = new AWS.S3();

app.post('/export', async (req, res) => {
  try {
    let { project_id, project, images } = req.body;

    if (typeof images === 'string') {
      images = JSON.parse(images);
    }

    if (!images || !Array.isArray(images) || images.length === 0) {
      return res.status(400).json({ error: 'No valid images provided.' });
    }

    if (!project) {
      return res.status(400).json({ error: 'Missing project name.' });
    }

    const archiveStream = new stream.PassThrough();
    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.pipe(archiveStream);

    const sanitizedProjectName = project.replace(/[^a-zA-Z0-9-_]/g, '_');
    const s3Key = `project-exports/${sanitizedProjectName}-${Date.now()}.zip`;

    // ✅ Process all images and append
    for (let i = 0; i < images.length; i++) {
      const { public_url, subfolder_title, ai_description } = images[i];
      const { buffer, filename } = await compressAndEmbedMetadata(
        { image_url: public_url, subfolder_title, ai_description },
        i + 1
      );

      archive.append(buffer, { name: filename });
    }

    archive.finalize();

    // ✅ Wait until archive is fully written to buffer
    const zipBuffer = await getStream.buffer(archiveStream);

    // ✅ Now upload the buffer to S3
    const uploadResult = await s3
      .upload({
        Bucket: process.env.S3_BUCKET_NAME,
        Key: s3Key,
        Body: zipBuffer,
        ContentType: 'application/zip',
      })
      .promise();

    console.log('Export successful:', uploadResult.Location);
    res.json({ download_url: uploadResult.Location });
  } catch (err) {
    console.error('Export error:', err);
    res.status(500).json({ error: 'Export failed. Check server logs for details.' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Export service running on port ${PORT}`);
});
