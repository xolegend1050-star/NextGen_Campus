const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const { validateFile } = require('../../middleware/fileValidation');
const logger = require('../../utils/logger');

const UPLOAD_DIR = path.join(__dirname, '../../uploads/verification');
const MAX_IMAGE_WIDTH = 1920;
const JPEG_QUALITY = 80;
const THUMBNAIL_SIZE = 200;

exports.uploadDocument = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const filePath = req.file.path;
    const originalName = req.file.originalname;

    // Magic-byte validation
    const validation = await validateFile(filePath, originalName);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    let finalFilename = req.file.filename;
    let thumbnailFilename = null;

    // Compress images with Sharp
    if (validation.detectedMime !== 'application/pdf') {
      try {
        const compressed = await sharp(filePath)
          .resize({ width: MAX_IMAGE_WIDTH, withoutEnlargement: true })
          .jpeg({ quality: JPEG_QUALITY })
          .toBuffer();

        const compressedFilename = `${path.basename(filePath, path.extname(filePath))}.jpg`;
        const compressedPath = path.join(UPLOAD_DIR, compressedFilename);
        fs.writeFileSync(compressedPath, compressed);

        // Generate thumbnail
        thumbnailFilename = `thumb_${compressedFilename}`;
        const thumbPath = path.join(UPLOAD_DIR, thumbnailFilename);
        await sharp(compressed)
          .resize(THUMBNAIL_SIZE, THUMBNAIL_SIZE, { fit: 'cover' })
          .jpeg({ quality: 70 })
          .toFile(thumbPath);

        // Remove original
        fs.unlinkSync(filePath);
        finalFilename = compressedFilename;
      } catch (err) {
        logger.error('Image processing failed:', err);
        // Keep original file if processing fails
      }
    }

    const fileUrl = `/uploads/verification/${finalFilename}`;
    const thumbUrl = thumbnailFilename
      ? `/uploads/verification/${thumbnailFilename}`
      : null;

    res.json({
      url: fileUrl,
      thumbnailUrl: thumbUrl,
      filename: finalFilename,
      originalName,
      mimeType: validation.detectedMime,
      size: req.file.size
    });
  } catch (error) {
    next(error);
  }
};
