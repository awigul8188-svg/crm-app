const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { getDB } = require('../database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadDir = req.app.get('uploadDir');
      const ringtoneDir = path.join(uploadDir, 'ringtones');
      if (!fs.existsSync(ringtoneDir)) {
        fs.mkdirSync(ringtoneDir, { recursive: true });
      }
      cb(null, ringtoneDir);
    },
    filename: (req, file, cb) => {
      cb(null, `${req.user.id}_${Date.now()}${path.extname(file.originalname)}`);
    }
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.mp3', '.wav', '.m4a', '.ogg'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only audio files are allowed'));
    }
  }
});

router.post('/upload', upload.single('ringtone'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  
  const db = getDB();
  const filePath = `/uploads/ringtones/${req.file.filename}`;
  
  db.prepare('UPDATE users SET ringtone = ? WHERE id = ?').run(filePath, req.user.id);
  
  res.json({ success: true, path: filePath });
});

router.delete('/:userId/ringtone', (req, res) => {
  const db = getDB();
  const user = db.prepare('SELECT ringtone FROM users WHERE id = ?').get(req.params.userId);
  
  if (user && user.ringtone) {
    const uploadDir = req.app.get('uploadDir');
    const filePath = path.join(uploadDir, user.ringtone.replace('/uploads/', ''));
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
  
  db.prepare('UPDATE users SET ringtone = NULL WHERE id = ?').run(req.params.userId);
  res.json({ success: true });
});

module.exports = router;
