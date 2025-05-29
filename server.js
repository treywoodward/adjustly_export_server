require('dotenv').config();
const express = require('express');
const axios = require('axios');
const JSZip = require('jszip');
const { embedMetadataToBase64 } = require('./metadata-utils');
const fs = require('fs');
const app = express();

app.use(express.json({ limit: '50mb' }));

app.post('/export', async (req, res) => {
  const { project_id, photos } = req.body;

  if (!project_id || !photos || !Array.isArray(photos)) {
    return res.status(400).json({ error: 'Invalid payload.' });
  }

  try {
    const zip = new JSZip();

    for (const photo of photos) {
      const { public_url, ai_description, Folder, created_date } = photo;
      const response = await axios.get(public_url, { responseType: 'arraybuffer' });
      const imageBase64 = Buffer.from(response.data, 'binary').toString('base64');
      const base64WithExif = embedMetadataToBase64("data:image/jpeg;base64," + imageBase64, {
        description: ai_description,
        folder: Folder,
        projectId: project_id,
        createdDate: created_date
      });

      const cleanBase64 = base64WithExif.split(',')[1];
      const filename = `${Folder || 'photo'}-${created_date}.jpg`;
      zip.file(filename, cleanBase64, { base64: true });
    }

    const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });

    const dropboxResponse = await axios.post(
      "https://content.dropboxapi.com/2/files/upload",
      zipBuffer,
      {
        headers: {
          "Authorization": `Bearer ${process.env.DROPBOX_TOKEN}`,
          "Content-Type": "application/octet-stream",
          "Dropbox-API-Arg": JSON.stringify({
            path: `/Adjustly Exports/${project_id}.zip`,
            mode: "overwrite",
            autorename: false,
            mute: false
          })
        }
      }
    );

    const linkRes = await axios.post(
      "https://api.dropboxapi.com/2/sharing/create_shared_link_with_settings",
      {
        path: dropboxResponse.data.path_lower,
        settings: { requested_visibility: "public" }
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.DROPBOX_TOKEN}`,
          "Content-Type": "application/json"
        }
      }
    );

    res.json({ success: true, url: linkRes.data.url.replace('?dl=0', '?dl=1') });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to export photos.' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
