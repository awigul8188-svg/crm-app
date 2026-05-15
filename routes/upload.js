const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { getDB } = require('../database');
const { authenticate, requireManager } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate, requireManager);

// Dynamic storage based on type
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = req.app.get('uploadDir');
    const subDir = req.params.type === 'avatar' ? 'avatars' : 'ringtones';
    cb(null, path.join(uploadDir, subDir));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${req.params.userId}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const type = req.params.type;
    if (type === 'avatar') {
      if (!file.mimetype.startsWith('image/')) return cb(new Error('Only image files allowed'));
    } else if (type === 'ringtone') {
      if (!file.mimetype.startsWith('audio/') && !file.originalname.match(/\.(mp3|wav|ogg|m4a)$/i)) {
        return cb(new Error('Only audio files allowed'));
      }
    }
    cb(null, true);
  },
});

// POST /api/upload/:type/:userId
router.post('/:type/:userId', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const db = getDB();
  const { type, userId } = req.params;
  const subDir = type === 'avatar' ? 'avatars' : 'ringtones';
  const ext = path.extname(req.file.filename);
  const url = `/uploads/${subDir}/${userId}${ext}`;

  if (type === 'avatar') {
    db.prepare('UPDATE users SET avatar_url = ? WHERE id = ?').run(url, userId);
  } else if (type === 'ringtone') {
    db.prepare('UPDATE users SET ringtone_url = ? WHERE id = ?').run(url, userId);
  }

  res.json({ success: true, url });
});

// DELETE /api/upload/:type/:userId
router.delete('/:type/:userId', (req, res) => {
  const db = getDB();
  const { type, userId } = req.params;
  const uploadDir = req.app.get('uploadDir');
  const subDir = type === 'avatar' ? 'avatars' : 'ringtones';

  if (type === 'avatar') {
    const user = db.prepare('SELECT avatar_url FROM users WHERE id = ?').get(userId);
    if (user?.avatar_url) {
      const filePath = path.join(uploadDir, subDir, path.basename(user.avatar_url));
      try { fs.unlinkSync(filePath); } catch {}
    }
    db.prepare('UPDATE users SET avatar_url = NULL WHERE id = ?').run(userId);
  } else if (type === 'ringtone') {
    const user = db.prepare('SELECT ringtone_url FROM users WHERE id = ?').get(userId);
    if (user?.ringtone_url) {
      const filePath = path.join(uploadDir, subDir, path.basename(user.ringtone_url));
      try { fs.unlinkSync(filePath); } catch {}
    }
    db.prepare('UPDATE users SET ringtone_url = NULL, ringtone_active = 0 WHERE id = ?').run(userId);
  }

  res.json({ success: true });
});

module.exports = router;
