const piexif = require("piexifjs");

function embedMetadataToBase64(base64, metadata) {
  const exifObj = {
    "0th": {
      [piexif.ImageIFD.ImageDescription]: metadata.aidescription,
      [piexif.ImageIFD.DocumentName]: metadata.folder,
      [piexif.ImageIFD.Make]: metadata.projectId,
      [piexif.ImageIFD.Software]: "Adjustly"
    }
  };
  const exifBytes = piexif.dump(exifObj);
  return piexif.insert(exifBytes, base64);
}

module.exports = {
  embedMetadataToBase64
};
