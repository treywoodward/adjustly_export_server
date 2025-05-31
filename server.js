const express = require('express');
const bodyParser = require('body-parser');
const JSZip = require('jszip');
const axios = require('axios');
const { embedMetadataToBase64 } = require('./metadata-utils');
const { Dropbox } = require('dropbox');
require('dotenv').config();

const app = express();
app.use(bodyParser.json({ limit: '50mb' }));

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

      // Use Folder as the photo name
      const safeName = Folder?.replace(/[<>:"/\\|?*]+/g, '-').trim() || `Photo-${index + 1}`;
      const fileName = `${safeName}.jpg`;

      zip.file(fileName, cleanBase64, { base64: true });
    }

    const zipContent = await zip.generateAsync({ type: 'nodebuffer' });

    const dbx = new Dropbox({ accessToken: process.env.DROPBOX_ACCESS_TOKEN });
    const dropboxPath = `/Adjustly Exports/${project_id}-${Date.now()}.zip`;

    await dbx.filesUpload({
      path: dropboxPath,
      contents: zipContent,
      mode: { '.tag': 'overwrite' }
    });

    const sharedLink = await dbx.sharingCreateSharedLinkWithSettings({ path: dropboxPath });

    return res.json({ url: sharedLink.result.url.replace('?dl=0', '?dl=1') }); // force download
  } catch (error) {
    console.error('Export failed:', error);
    return res.status(500).json({ error: 'Failed to export photos.' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Export server running on port ${PORT}`);
});
