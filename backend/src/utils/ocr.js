const { createWorker } = require('tesseract.js');
const sharp = require('sharp');
const logger = require('./logger');

async function preprocessImage(imageBuffer) {
  return sharp(imageBuffer)
    .resize({ width: 1200, withoutEnlargement: true })
    .grayscale()
    .sharpen()
    .toBuffer();
}

function extractField(text, patterns) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1].trim();
  }
  return null;
}

function parseIDFields(rawText) {
  const name = extractField(rawText, [
    /name[:\s]+(.+)/i,
    /student[:\s]+(.+)/i,
    /holder[:\s]+(.+)/i,
  ]);

  const idNumber = extractField(rawText, [
    /(?:id|roll|enrollment|reg)[.\s]*no[:\s]*(\w+)/i,
    /(?:id|roll|enrollment|reg)[.\s]*number[:\s]*(\w+)/i,
    /(\d{4}[-\/]?\w{2,4}[-\/]?\d{2,4})/,
  ]);

  const college = extractField(rawText, [
    /college[:\s]+(.+)/i,
    /university[:\s]+(.+)/i,
    /institute[:\s]+(.+)/i,
  ]);

  const course = extractField(rawText, [
    /course[:\s]+(.+)/i,
    /branch[:\s]+(.+)/i,
    /department[:\s]+(.+)/i,
  ]);

  const year = extractField(rawText, [
    /year[:\s]*(\d)/i,
    /sem[:\s]*(\d)/i,
  ]);

  return { name, idNumber, college, course, year };
}

function normalizeForComparison(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function compareNames(extractedName, profileName) {
  if (!extractedName || !profileName) {
    return { match: false, confidence: 0, reason: 'Could not extract name from ID' };
  }

  const extracted = normalizeForComparison(extractedName);
  const profile = normalizeForComparison(profileName);

  if (extracted === profile) {
    return { match: true, confidence: 100, reason: 'Exact match' };
  }

  const extractedParts = extracted.split(' ');
  const profileParts = profile.split(' ');

  let matchedParts = 0;
  for (const part of extractedParts) {
    if (profileParts.some(p => p === part || p.startsWith(part) || part.startsWith(p))) {
      matchedParts++;
    }
  }

  const matchRatio = matchedParts / Math.max(extractedParts.length, profileParts.length);

  if (matchRatio >= 0.5) {
    return { match: true, confidence: Math.round(matchRatio * 100), reason: 'Partial name match' };
  }

  return { match: false, confidence: Math.round(matchRatio * 100), reason: 'Names do not match' };
}

async function analyzeIDCard(imageBuffer, profileName) {
  const worker = await createWorker('eng');
  try {
    const processed = await preprocessImage(imageBuffer);
    const { data } = await worker.recognize(processed);

    const rawText = data.text;
    const confidence = data.confidence;
    const parsed = parseIDFields(rawText);
    const nameComparison = compareNames(parsed.name, profileName);

    logger.info(`OCR completed: confidence=${confidence}%, name_match=${nameComparison.match}`);

    return {
      raw_text: rawText,
      confidence,
      parsed,
      name_comparison: nameComparison,
    };
  } finally {
    await worker.terminate();
  }
}

module.exports = { analyzeIDCard, parseIDFields, compareNames };
