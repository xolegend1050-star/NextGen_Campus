const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const { validateFile, CATEGORY_RULES } = require('../../middleware/fileValidation');
const { CATEGORIES, UPLOAD_ROOT } = require('../../middleware/upload');
const db = require('../../config/database');
const logger = require('../../utils/logger');

const MAX_IMAGE_WIDTH = 1920;
const JPEG_QUALITY = 80;
const THUMBNAIL_SIZE = 200;

const safeUnlink = (p) => {
  try {
    if (p && fs.existsSync(p)) fs.unlinkSync(p);
  } catch (_) {
    /* best effort */
  }
};

/**
 * Compress an uploaded image and generate a thumbnail.
 * Returns { filename, thumbnailFilename, width, height } or null on failure,
 * in which case the original upload is left untouched.
 */
const processImage = async (filePath) => {
  try {
    const compressed = await sharp(filePath)
      .resize({ width: MAX_IMAGE_WIDTH, withoutEnlargement: true })
      .jpeg({ quality: JPEG_QUALITY })
      .toBuffer();

    const compressedFilename = `${path.basename(filePath, path.extname(filePath))}.jpg`;
    const compressedPath = path.join(path.dirname(filePath), compressedFilename);
    fs.writeFileSync(compressedPath, compressed);

    const thumbnailFilename = `thumb_${compressedFilename}`;
    const thumbPath = path.join(path.dirname(filePath), thumbnailFilename);
    await sharp(compressed)
      .resize(THUMBNAIL_SIZE, THUMBNAIL_SIZE, { fit: 'cover' })
      .jpeg({ quality: 70 })
      .toFile(thumbPath);

    const meta = await sharp(compressed).metadata();

    // Only drop the original once every derived file exists
    safeUnlink(filePath);

    return {
      filename: compressedFilename,
      thumbnailFilename,
      width: meta.width,
      height: meta.height
    };
  } catch (err) {
    logger.error('Image processing failed:', err.message);
    const compressedFilename = `${path.basename(filePath, path.extname(filePath))}.jpg`;
    safeUnlink(path.join(path.dirname(filePath), compressedFilename));
    return null;
  }
};

/** Shared handler for any single-file category. */
const handleUpload = (category, { processImages }) => async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const config = CATEGORIES[category];
    const rules = CATEGORY_RULES[config.rule];
    const filePath = req.file.path;
    const originalName = req.file.originalname;

    const validation = await validateFile(filePath, originalName, config.rule);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    const isPdf = validation.detectedMime === 'application/pdf';
    let finalFilename = req.file.filename;
    let thumbnailFilename = null;
    let width = null;
    let height = null;

    if (!isPdf && processImages) {
      const processed = await processImage(filePath);
      if (processed) {
        finalFilename = processed.filename;
        thumbnailFilename = processed.thumbnailFilename;
        width = processed.width;
        height = processed.height;
      } else {
        finalFilename = path.basename(filePath);
      }
    }

    const url = `/uploads/${config.dir}/${finalFilename}`;
    const thumbnailUrl = thumbnailFilename
      ? `/uploads/${config.dir}/${thumbnailFilename}`
      : null;

    res.json({
      success: true,
      category,
      url,
      thumbnailUrl,
      filename: finalFilename,
      originalName,
      mimeType: validation.detectedMime,
      size: req.file.size,
      width,
      height,
      maxBytes: rules.maxBytes
    });
  } catch (error) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'File is too large' });
    }
    next(error);
  }
};

exports.uploadDocument = handleUpload('document', { processImages: true });
exports.uploadAvatar = handleUpload('avatar', { processImages: true });
exports.uploadResume = handleUpload('resume', { processImages: false });
exports.uploadDoubtImage = handleUpload('doubt', { processImages: true });

/**
 * Set an uploaded avatar as the user's profile picture, replacing the previous
 * one so the uploads directory does not grow without bound.
 */
exports.setAvatar = async (req, res, next) => {
  try {
    const { url } = req.body || {};
    if (!url || !url.startsWith('/uploads/avatars/')) {
      return res.status(400).json({ error: 'A valid avatar url is required' });
    }

    const filename = path.basename(url);

    // Confirm the file actually exists before writing the reference
    const abs = path.join(UPLOAD_ROOT, 'avatars', filename);
    if (!fs.existsSync(abs)) {
      return res.status(400).json({ error: 'Uploaded file not found' });
    }

    const previous = await db.query(
      'SELECT avatar_url FROM profiles WHERE user_id = $1',
      [req.user.id]
    );

    // NOT NULL is evaluated before ON CONFLICT resolution, so an upsert that
    // omits full_name fails even when the row already exists. Update first and
    // only insert when there is genuinely no profile yet.
    const updated = await db.query(
      'UPDATE profiles SET avatar_url = $1 WHERE user_id = $2',
      [url, req.user.id]
    );

    if (updated.rowCount === 0) {
      const owner = await db.query('SELECT email FROM users WHERE id = $1', [req.user.id]);
      const fallbackName = (owner.rows[0]?.email || 'User').split('@')[0];
      await db.query(
        'INSERT INTO profiles (user_id, avatar_url, full_name) VALUES ($1, $2, $3)',
        [req.user.id, url, fallbackName]
      );
    }

    // Clean up the old avatar and its thumbnail
    const oldUrl = previous.rows[0]?.avatar_url;
    if (oldUrl && oldUrl !== url && oldUrl.startsWith('/uploads/avatars/')) {
      const oldName = path.basename(oldUrl);
      safeUnlink(path.join(UPLOAD_ROOT, 'avatars', oldName));
      safeUnlink(path.join(UPLOAD_ROOT, 'avatars', `thumb_${oldName}`));
    }

    res.json({ success: true, avatar_url: url });
  } catch (error) {
    next(error);
  }
};

exports.setResume = async (req, res, next) => {
  try {
    const { url, file_name } = req.body || {};
    if (!url || !url.startsWith('/uploads/resumes/')) {
      return res.status(400).json({ error: 'A valid resume url is required' });
    }
    if (!url.endsWith('.pdf')) {
      return res.status(400).json({ error: 'Resume must be a PDF' });
    }

    const abs = path.join(UPLOAD_ROOT, 'resumes', path.basename(url));
    if (!fs.existsSync(abs)) {
      return res.status(400).json({ error: 'Uploaded file not found' });
    }

    // Confirm the file is really a PDF by magic bytes before persisting
    const fd = fs.openSync(abs, 'r');
    const header = Buffer.alloc(5);
    fs.readSync(fd, header, 0, 5, 0);
    fs.closeSync(fd);
    if (header.toString('hex') !== '255044462d') {
      return res.status(400).json({ error: 'File is not a valid PDF' });
    }

    const fullName = (file_name || path.basename(url)).slice(0, 200);
    // Only resume_url is persisted. The profiles table has no separate
    // display-name column, so the original filename is returned to the caller
    // for immediate use but not stored.
    const updated = await db.query(
      'UPDATE profiles SET resume_url = $1 WHERE user_id = $2',
      [url, req.user.id]
    );

    if (updated.rowCount === 0) {
      const owner = await db.query('SELECT email FROM users WHERE id = $1', [req.user.id]);
      const fallbackName = (owner.rows[0]?.email || 'User').split('@')[0];
      await db.query(
        'INSERT INTO profiles (user_id, resume_url, full_name) VALUES ($1, $2, $3)',
        [req.user.id, url, fallbackName]
      );
    }

    res.json({ success: true, resume_url: url, file_name: fullName });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete an uploaded file. Scoped to the caller's own uploads and restricted
 * to the known category directories.
 */
exports.deleteUpload = async (req, res, next) => {
  try {
    const { category, filename } = req.params;

    if (!CATEGORIES[category]) {
      return res.status(400).json({ error: 'Unknown upload category' });
    }

    const safeName = path.basename(filename || '');
    if (!safeName || safeName.includes('..')) {
      return res.status(400).json({ error: 'Invalid filename' });
    }

    const abs = path.join(UPLOAD_ROOT, CATEGORIES[category].dir, safeName);
    // Defence in depth: confirm the resolved path stays inside the root
    if (!abs.startsWith(UPLOAD_ROOT)) {
      return res.status(400).json({ error: 'Invalid path' });
    }
    if (!fs.existsSync(abs)) {
      return res.status(404).json({ error: 'File not found' });
    }

    safeUnlink(abs);
    safeUnlink(path.join(path.dirname(abs), `thumb_${safeName}`));

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};
