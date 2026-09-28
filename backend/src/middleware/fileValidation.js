const fs = require('fs');
// file-type v19+ renamed the entry points; the old `FileType.fromBuffer` form
// no longer exists and made every upload fail with a 500.
const { fileTypeFromBuffer } = require('file-type');

const ALLOWED_MIME_MAP = {
  'image/jpeg': ['jpg', 'jpeg'],
  'image/png': ['png'],
  'application/pdf': ['pdf']
};

const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.pdf']);

// Per-category allow-lists. Anything not listed here is rejected.
const CATEGORY_RULES = {
  image: {
    mimes: ['image/jpeg', 'image/jpg', 'image/png'],
    extensions: ['.jpg', '.jpeg', '.png'],
    maxBytes: 5 * 1024 * 1024
  },
  pdf: {
    mimes: ['application/pdf'],
    extensions: ['.pdf'],
    maxBytes: 10 * 1024 * 1024
  },
  // Backwards-compatible default used by the verification-document flow
  document: {
    mimes: ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'],
    extensions: ['.jpg', '.jpeg', '.png', '.pdf'],
    maxBytes: 5 * 1024 * 1024
  }
};

const safeUnlink = (filePath) => {
  try {
    if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch (_) {
    /* best effort */
  }
};

const validateFile = async (filePath, originalName, category = 'document') => {
  const rules = CATEGORY_RULES[category] || CATEGORY_RULES.document;
  const ext = require('path').extname(originalName).toLowerCase();

  if (!rules.extensions.includes(ext)) {
    safeUnlink(filePath);
    return {
      valid: false,
      error: `Invalid extension: ${ext}. Allowed: ${rules.extensions.join(', ')}`
    };
  }

  const size = fs.statSync(filePath).size;
  if (size > rules.maxBytes) {
    safeUnlink(filePath);
    return {
      valid: false,
      error: `File too large: ${(size / 1048576).toFixed(1)}MB. Max ${(rules.maxBytes / 1048576).toFixed(0)}MB.`
    };
  }

  // Magic-byte MIME validation
  const buffer = Buffer.alloc(4100);
  const fd = fs.openSync(filePath, 'r');
  fs.readSync(fd, buffer, 0, 4100, 0);
  fs.closeSync(fd);

  const type = await fileTypeFromBuffer(buffer);

  if (!type) {
    // file-type may not detect a PDF when the header sits past offset 0
    const header = buffer.toString('hex', 0, 5);
    if (header === '255044462d' && rules.mimes.includes('application/pdf')) {
      return { valid: true, detectedMime: 'application/pdf' };
    }
    safeUnlink(filePath);
    return { valid: false, error: 'Could not detect file type' };
  }

  if (!rules.mimes.includes(type.mime)) {
    safeUnlink(filePath);
    return { valid: false, error: `Invalid file type detected: ${type.mime}` };
  }

  // Extension must agree with the real content type
  if (!ALLOWED_MIME_MAP[type.mime] || !ALLOWED_MIME_MAP[type.mime].includes(ext.slice(1))) {
    safeUnlink(filePath);
    return {
      valid: false,
      error: `File extension ${ext} does not match content type ${type.mime}`
    };
  }

  return { valid: true, detectedMime: type.mime };
};

module.exports = { validateFile, CATEGORY_RULES };
