const piexif = require('piexifjs');
const sharp = require('sharp');

function embedMetadataToBase64(base64Image, metadata) {
  try {
    const jpegData = base64Image.split(',')[1];
    const binaryStr = Buffer.from(jpegData, 'base64').toString('binary');

    const exifObj = { "0th": {}, "Exif": {}, "GPS": {}, "1st": {}, "thumbnail": null };

    if (metadata.ai_description) {
      exifObj["0th"][piexif.ImageIFD.ImageDescription] = metadata.ai_description;
    }

    if (metadata.folder) {
      exifObj["0th"][piexif.ImageIFD.DocumentName] = metadata.folder;
    }

    if (metadata.projectId) {
      exifObj["0th"][piexif.ImageIFD.ImageUniqueID] = metadata.projectId;
    }

    if (metadata.createdDate) {
      exifObj["0th"][piexif.ImageIFD.DateTime] = new Date(metadata.createdDate).toISOString();
    }

    const exifBytes = piexif.dump(exifObj);
    const newData = piexif.insert(exifBytes, "data:image/jpeg;base64," + jpegData);
    return newData;
  } catch (err) {
    console.error('❌ Failed to embed metadata:', err);
    throw err;
  }
}

module.exports = {
  embedMetadataToBase64
};
