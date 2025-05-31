const piexif = require('piexifjs');

/**
 * Embeds metadata (description, folder, etc.) into a base64 image
 * @param {string} base64Image - The image in data URL format (e.g., "data:image/jpeg;base64,...")
 * @param {object} metadata - An object containing metadata fields like description, folder, etc.
 * @returns {string} - The base64 image string with embedded metadata
 */
function embedMetadataToBase64(base64Image, metadata) {
  // Strip off data URL prefix to get base64-encoded binary
  const base64Data = base64Image.split(',')[1];
  const binaryStr = Buffer.from(base64Data, 'base64').toString('binary');

  // Create EXIF metadata
  const exifObj = {
    "0th": {
      [piexif.ImageIFD.ImageDescription]: metadata.description || "",
    },
    "Exif": {
      [piexif.ExifIFD.UserComment]: piexif.undefinedUnicode(metadata.description || ""),
    },
    "1st": {},
    "thumbnail": null,
  };

  const exifBytes = piexif.dump(exifObj);
  const newDataUrl = piexif.insert(exifBytes, base64Image);

  return newDataUrl;
}

module.exports = {
  embedMetadataToBase64,
};
