const fs = require('fs');
const path = require('path');
const os = require('os');

// Mock file-type since it uses ESM imports
jest.mock('file-type', () => ({
  fromBuffer: jest.fn()
}));

jest.mock('../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));

const FileType = require('file-type');
const { validateFile } = require('../src/middleware/fileValidation');

describe('File Validation', () => {
  const tmpDir = os.tmpdir();

  function createTmpFile(name, content = 'test content') {
    const filePath = path.join(tmpDir, name);
    fs.writeFileSync(filePath, content);
    return filePath;
  }

  afterEach(() => {
    jest.clearAllMocks();
    // Clean up temp files
    ['test.txt', 'test.jpg', 'test.png', 'test.pdf', 'fake.jpg', 'fake.png'].forEach(f => {
      const p = path.join(tmpDir, f);
      if (fs.existsSync(p)) fs.unlinkSync(p);
    });
  });

  describe('Extension validation', () => {
    it('should reject .txt files', async () => {
      const filePath = createTmpFile('test.txt');
      const result = await validateFile(filePath, 'test.txt');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid extension');
    });

    it('should reject .exe files', async () => {
      const filePath = createTmpFile('test.exe');
      const result = await validateFile(filePath, 'test.exe');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid extension');
    });

    it('should reject .gif files', async () => {
      const filePath = createTmpFile('test.gif');
      const result = await validateFile(filePath, 'test.gif');
      expect(result.valid).toBe(false);
    });
  });

  describe('JPEG validation', () => {
    it('should accept valid JPEG files', async () => {
      const filePath = createTmpFile('test.jpg');
      FileType.fromBuffer.mockResolvedValue({ mime: 'image/jpeg', ext: 'jpg' });
      const result = await validateFile(filePath, 'photo.jpg');
      expect(result.valid).toBe(true);
      expect(result.detectedMime).toBe('image/jpeg');
    });

    it('should accept .jpeg extension', async () => {
      const filePath = createTmpFile('test.jpg');
      FileType.fromBuffer.mockResolvedValue({ mime: 'image/jpeg', ext: 'jpg' });
      const result = await validateFile(filePath, 'photo.jpeg');
      expect(result.valid).toBe(true);
    });
  });

  describe('PNG validation', () => {
    it('should accept valid PNG files', async () => {
      const filePath = createTmpFile('test.png');
      FileType.fromBuffer.mockResolvedValue({ mime: 'image/png', ext: 'png' });
      const result = await validateFile(filePath, 'image.png');
      expect(result.valid).toBe(true);
      expect(result.detectedMime).toBe('image/png');
    });
  });

  describe('PDF validation', () => {
    it('should accept valid PDF files', async () => {
      const filePath = createTmpFile('test.pdf');
      FileType.fromBuffer.mockResolvedValue({ mime: 'application/pdf', ext: 'pdf' });
      const result = await validateFile(filePath, 'document.pdf');
      expect(result.valid).toBe(true);
      expect(result.detectedMime).toBe('application/pdf');
    });
  });

  describe('MIME/extension mismatch', () => {
    it('should reject PNG content with .jpg extension', async () => {
      const filePath = createTmpFile('fake.jpg');
      FileType.fromBuffer.mockResolvedValue({ mime: 'image/png', ext: 'png' });
      const result = await validateFile(filePath, 'fake.jpg');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('does not match');
    });

    it('should reject JPEG content with .png extension', async () => {
      const filePath = createTmpFile('fake.png');
      FileType.fromBuffer.mockResolvedValue({ mime: 'image/jpeg', ext: 'jpg' });
      const result = await validateFile(filePath, 'fake.png');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('does not match');
    });
  });

  describe('Unknown / unrecognized files', () => {
    it('should reject files with no recognized MIME type', async () => {
      const filePath = createTmpFile('fake.jpg');
      FileType.fromBuffer.mockResolvedValue(undefined);
      const result = await validateFile(filePath, 'fake.jpg');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Could not detect file type');
    });
  });

  describe('Module exports', () => {
    it('should export validateFile function', () => {
      expect(typeof validateFile).toBe('function');
    });
  });
});
