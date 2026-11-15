const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const { UploadedFile } = require('../models');
const { httpErr } = require('../utils');

if (!process.env.CLOUDINARY_URL && process.env.CLOUDINARY_CLOUD_NAME) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true
  });
}
const useCloud = () => !!cloudinary.config().cloud_name;
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 1 } });

// Validate by file signature (magic bytes), not by the client-supplied MIME type
function sniff(b) {
  if (b.length < 12) return null;
  const s = (a, z) => b.slice(a, z).toString('latin1');
  if (s(0, 4) === '%PDF') return { mime: 'application/pdf', ext: 'pdf' };
  if (b[0] === 0x89 && s(1, 4) === 'PNG') return { mime: 'image/png', ext: 'png' };
  if (b[0] === 0xff && b[1] === 0xd8) return { mime: 'image/jpeg', ext: 'jpg' };
  if (s(0, 4) === 'GIF8') return { mime: 'image/gif', ext: 'gif' };
  if (s(0, 4) === 'RIFF' && s(8, 12) === 'WEBP') return { mime: 'image/webp', ext: 'webp' };
  if (b[0] === 0 && b[1] === 0 && b[2] === 1 && b[3] === 0) return { mime: 'image/x-icon', ext: 'ico' };
  return null;
}

async function storeFile(file, purpose) {
  const type = sniff(file.buffer);
  if (!type) throw httpErr(415, 'Unsupported or corrupted file. Allowed: PDF (CV only), JPG, PNG, WebP, GIF, ICO.');
  if (purpose === 'cv' && type.ext !== 'pdf') throw httpErr(415, 'CV must be a PDF file.');
  if (purpose !== 'cv' && type.ext === 'pdf') throw httpErr(415, 'PDFs can only be uploaded as a CV.');
  if (type.ext !== 'pdf' && file.size > 5 * 1024 * 1024) throw httpErr(413, 'Images must be 5 MB or smaller.');
  const isPdf = type.ext === 'pdf';
  const base = { originalName: file.originalname.slice(0, 200), mimeType: type.mime, size: file.size, purpose, resourceType: isPdf ? 'raw' : 'image' };

  if (useCloud()) {
    const id = crypto.randomBytes(12).toString('hex');
    const result = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        { folder: `portfolio/${purpose}`, resource_type: isPdf ? 'raw' : 'image', public_id: isPdf ? `${id}.pdf` : id },
        (err, r) => (err ? reject(err) : resolve(r))
      ).end(file.buffer);
    });
    return UploadedFile.create({ ...base, url: result.secure_url, publicId: result.public_id, storage: 'cloudinary' });
  }
  if (process.env.NODE_ENV === 'production') throw httpErr(500, 'File storage (Cloudinary) is not configured on the server.');
  const name = `${crypto.randomBytes(12).toString('hex')}.${type.ext}`;
  fs.mkdirSync(path.join(__dirname, '../uploads'), { recursive: true });
  fs.writeFileSync(path.join(__dirname, '../uploads', name), file.buffer);
  return UploadedFile.create({ ...base, url: `/uploads/${name}`, publicId: name, storage: 'local' });
}

async function removeFile(doc) {
  try {
    if (doc.storage === 'cloudinary') await cloudinary.uploader.destroy(doc.publicId, { resource_type: doc.resourceType });
    else fs.unlinkSync(path.join(__dirname, '../uploads', path.basename(doc.publicId)));
  } catch (e) { console.warn('File cleanup failed:', e.message); }
}
module.exports = { upload, storeFile, removeFile };
