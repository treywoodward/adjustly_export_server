const piexif = require("piexifjs");

function embedMetadataToBase64(base64Image, metadata) {
  const zeroth = {};
  const exif = {};

  if (metadata.description) {
    zeroth[piexif.ImageIFD.ImageDescription] = metadata.description;
  }

  if (metadata.folder) {
    zeroth[piexif.ImageIFD.DocumentName] = metadata.folder;
  }

  if (metadata.projectId) {
    zeroth[piexif.ImageIFD.PageName] = metadata.projectId;
  }

  if (metadata.createdDate) {
    zeroth[piexif.ImageIFD.DateTime] = new Date(metadata.createdDate).toISOString();
  }

  const exifObj = { "0th": zeroth, Exif: exif };
  const exifBytes = piexif.dump(exifObj);
  const newData = piexif.insert(exifBytes, base64Image);

  return newData;
}

module.exports = { embedMetadataToBase64 };
