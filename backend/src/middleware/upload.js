const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { CATEGORY_RULES } = require('./fileValidation');

const UPLOAD_ROOT = path.join(__dirname, '../../uploads');

// Whitelist of directories we are willing to write into.
const CATEGORIES = {
  avatar: { rule: 'image', dir: 'avatars' },
  resume: { rule: 'pdf', dir: 'resumes' },
  document: { rule: 'document', dir: 'verification' },
  doubt: { rule: 'image', dir: 'doubts' }
};

const ensureDir = (dir) => fs.mkdirSync(dir, { recursive: true });

/**
 * Build a multer instance scoped to one upload category.
 * Rejects unknown categories outright so a caller can never traverse
 * out of the uploads root.
 */
const uploader = (category) => {
  const config = CATEGORIES[category];
  if (!config) {
    throw new Error(`Unknown upload category: ${category}`);
  }
  const rules = CATEGORY_RULES[config.rule];

  return multer({
    storage: multer.diskStorage({
      destination: (req, file, cb) => {
        const dir = path.join(UPLOAD_ROOT, config.dir);
        ensureDir(dir);
        cb(null, dir);
      },
      filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        // Force the extension we know the content to be, ignoring the client's
        const safeExt = rules.extensions.includes(ext) ? ext : '.bin';
        cb(null, `${uuidv4()}${safeExt}`);
      }
    }),
    fileFilter: (req, file, cb) => {
      if (rules.mimes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(
          new Error(
            `Invalid file type. Allowed for ${category}: ${rules.mimes.join(', ')}`
          ),
          false
        );
      }
    },
    limits: {
      fileSize: rules.maxBytes,
      files: 1
    }
  });
};

// Kept for backwards compatibility with the original single-use import.
const upload = uploader('document');

module.exports = upload;
module.exports.uploader = uploader;
module.exports.CATEGORIES = CATEGORIES;
module.exports.UPLOAD_ROOT = UPLOAD_ROOT;
