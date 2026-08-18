const fs = require('fs');
const FileType = require('file-type');

const ALLOWED_MIME_MAP = {
  'image/jpeg': ['jpg', 'jpeg'],
  'image/png': ['png'],
  'application/pdf': ['pdf']
};

const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.pdf']);

const validateFile = async (filePath, originalName) => {
  // Check extension
  const ext = require('path').extname(originalName).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    fs.unlinkSync(filePath);
    return { valid: false, error: `Invalid extension: ${ext}` };
  }

  // Magic-byte MIME validation
  const buffer = Buffer.alloc(4100);
  const fd = fs.openSync(filePath, 'r');
  fs.readSync(fd, buffer, 0, 4100, 0);
  fs.closeSync(fd);

  const type = await FileType.fromBuffer(buffer);

  if (!type) {
    // For PDFs, file-type may not detect if header is at offset > 0
    // Check first bytes manually
    const header = buffer.toString('hex', 0, 5);
    if (header === '255044462d') {
      return { valid: true, detectedMime: 'application/pdf' };
    }
    fs.unlinkSync(filePath);
    return { valid: false, error: 'Could not detect file type' };
  }

  if (!ALLOWED_MIME_MAP[type.mime]) {
    fs.unlinkSync(filePath);
    return { valid: false, error: `Invalid file type detected: ${type.mime}` };
  }

  // Ensure detected MIME matches extension
  if (!ALLOWED_MIME_MAP[type.mime].includes(ext.slice(1))) {
    fs.unlinkSync(filePath);
    return { valid: false, error: `File extension ${ext} does not match content type ${type.mime}` };
  }

  return { valid: true, detectedMime: type.mime };
};

module.exports = { validateFile };
