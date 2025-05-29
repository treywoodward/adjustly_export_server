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

    for (const photo of photos) {
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
  const filename = `${Folder || 'photo'}-${created_date}.jpg`;

  zip.file(filename, cleanBase64, { base64: true });
}


    const zipContent = await zip.generateAsync({ type: 'nodebuffer' });

    const dbx = new Dropbox({ accessToken: process.env.sl.u.AFzqzbQdMrLIAPpsBeCiULsB2zCskwzvv5KYLxogAPojen4UCizgo2KK5B25-wXV7JT_YYSzyL2GSddWE5njjfsFmHrHrvWKSR2pdWcCzHlkwg3ulEFzUm3kxiGF67WXmBmt9fEMJ_v4TnTyz7vceNm60O1kojPn8ZpM6U-MxzfZ9IbV3l9tZjvWH12whlKYe4ii9rjGDdCgZG7A4t9BX1PCivGHWMApUmMKXJ44SOu2ySaZUe2fw8ZZFL2Nwe3x0myj2rulKVrSBo74qS5AD5dhYZg0BP3TXUGaN51AbusLKH91Da3fIw5FIPDk1l2IixDbcVtH1AxU6O4_V5X4HXofoCjZP2JSwLGob8c3kgHYM8ANfhWyv-XfJ3jUmx6H6bxpmPeGOfmtD3hJxmPSTyBxf2kz_8yjoscYK9D_xf1fx1oU58-6jIJZikDV-EERmCLFvoldJAztjtl-Fi7AMsFG3nJBegZzP3LncZEGr99hsPEALf1Dpe8AVFgCCen06uKewuljhNy5yC_5CpjoShGQXBDqtSdxeTUAPXaOgQGs-vZJ24Th7TJnpK-hATmxmm7mrYkX4gcakQACIgup92ibkD22dXL91BYYdNhpbZKV7IL3esAV2G1KQSbQlYYce_AiT8FDwer3zFOAKYlkVark_saPCyh6hZTTxj59B6NZFGDIvZMLKPysNaSG-hHan4eLBmJy1ySAmJwvmGqz2zgpgbye4akmzczuJHLg__SpFYKA65uyUcoiVV8izaJPZGaT1cYl49f1qW2zwfdSALBLgbJq6TzPRwr1DUdIP5sdd4l4H36ias8vjDUcCToyV7M6MrL2vFZBfw226yMx_KUYOTcdskEtjrCk2JXhyvluI2SbztJRelw2lpSZKj-mXQShKdO7Wvh_a_AOOUsz2sk0BI2Azc1pEyZ6e2X6CbTIvJzuWGJljag1ltX3pwQjXIldQkPjHsBypph1QrKmRF4zOuhvmTpn8GUfRir3d4W-F_SVecw_ImSCGBeRuk_BT9OgXkv52goe_dOrFIONRT7qfqgihoQk9f_PaN9Zv5VLSeYnh2B7zld8EecW_wlygokWFgxY5RRQmdwMqwlb0ncEAGZyUYt_OvIH_e_EhO2m0YNUDqoFsu7DAHnz9aZb-00R49lrepZMPaAkCDI6Z8uQffYxy6QJdNt9Pg1tiw9nReOtKd8fDJmspvhau9pNnfUfxo1iuC5FcBTwpjBT0QxXRlCiSb24VZZmjwvKnCLrT797NH4ThQeCIYPn_XM5a-qyfBXb3P0LXQJ9VlB_m2_eJUf41E-hBlZcv4mZdOD18w });
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
