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
    let { project_id, project, images } = req.body;

    console.log('==== RAW BODY START ====');
    console.log('project_id:', project_id);
    console.log('project:', project);
    console.log('images:', images);
    console.log('==== RAW BODY END ====');

    // Parse if images is string
    if (typeof images === 'string') {
      try {
        images = JSON.parse(images);
      } catch (err) {
        console.error('Failed to parse images JSON:', err.message);
        return res.status(400).json({ error: 'Invalid JSON in images parameter.' });
      }
    }

    if (!images || !Array.isArray(images) || images.length === 0) {
      return res.status(400).json({ error: 'No valid images provided.' });
    }

    if (!project) {
      return res.status(400).json({ error: 'Missing project name.' });
    }

    const zipStream = new stream.PassThrough();
    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.pipe(zipStream);

    const sanitizedProjectName = project.replace(/[^a-zA-Z0-9-_]/g, '_');
    const uploadParams = {
      Bucket: process.env.S3_BUCKET_NAME,
      Key: `project-exports/${sanitizedProjectName}-${Date.now()}.zip`,
      Body: zipStream,
      ContentType: 'application/zip',
    };

    const s3Upload = s3.upload(uploadParams).promise();

    // Track filenames to prevent overwrites
    const filenameCount = {};

    for (let i = 0; i < images.length; i++) {
      const image = images[i];
      const { public_url, subfolder_title, ai_description } = image;

      if (!public_url) {
        console.warn(`Skipping image ${i + 1}: Missing public_url`);
        continue;
      }

      console.log(`Processing image ${i + 1}: ${public_url}`);

      const { buffer, filename } = await compressAndEmbedMetadata(
        { image_url: public_url, subfolder_title, ai_description },
        i + 1
      );

      let uniqueFilename = filename;
      if (filenameCount[filename]) {
        filenameCount[filename]++;
        const ext = filename.split('.').pop();
        const base = filename.replace(`.${ext}`, '');
        uniqueFilename = `${base}_${filenameCount[filename]}.${ext}`;
      } else {
        filenameCount[filename] = 1;
      }

      archive.append(buffer, { name: uniqueFilename });
    }

    archive.finalize();
    const s3Result = await s3Upload;

    console.log('Export successful:', s3Result.Location);
    res.json({ download_url: s3Result.Location });
  } catch (err) {
    console.error('Export error:', err.message);
    res.status(500).json({ error: 'Export failed. Check server logs for details.' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Export service running on port ${PORT}`);
});
