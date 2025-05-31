const piexif = require("piexifjs");

function embedMetadataToBase64(base64Image, metadata) {
  try {
    let exifObj = { "0th": {}, "Exif": {}, "GPS": {}, "1st": {}, "thumbnail": null };

    if (metadata.description) {
      exifObj["0th"][piexif.ImageIFD.ImageDescription] = metadata.description;
    }
    if (metadata.folder) {
      exifObj["0th"][piexif.ImageIFD.DocumentName] = metadata.folder;
    }
    if (metadata.projectId) {
      exifObj["0th"][piexif.ImageIFD.PageName] = metadata.projectId;
    }
    if (metadata.createdDate) {
      exifObj["0th"][piexif.ImageIFD.DateTime] = metadata.createdDate;
    }

    const exifBytes = piexif.dump(exifObj);
    const newData = piexif.insert(exifBytes, base64Image);
    return newData;
  } catch (error) {
    console.error("❌ Failed to embed metadata:", error);
    return base64Image; // return original image if embedding fails
  }
}

module.exports = {
  embedMetadataToBase64,
};
