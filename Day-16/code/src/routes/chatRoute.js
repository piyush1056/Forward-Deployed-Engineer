import { Router } from 'express';
import multer from 'multer';

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export function createChatRouter(chatService) {
  const router = Router();
  
// Configure Multer to store uploaded files directly in RAM memory (Buffer) 
// instead of saving them to the hard drive disk.
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_UPLOAD_BYTES, fieldSize: MAX_UPLOAD_BYTES, files: 1, fields: 1 },

// Filter incoming files to ensure only images (like png, jpeg) are processed.
    fileFilter(req, file, callback) {
      if (!file.mimetype.startsWith('image/')) {
        const error = new Error('Please upload an image file.');
        error.status = 400;
        return callback(error);
      }
      callback(null, true);
    },
  });

  router.post('/', (req, res, next) => {
    const size = Number(req.headers['content-length']);
    if (size > MAX_UPLOAD_BYTES) {
      return res.status(413).type('text').send('Maximum request size is 10 MB.');
    }
    next();

    }, 

  // Multer Middleware: Processes the multipart form data and looks for a single file named 'image'.
   upload.single('image'), async (req, res, next) => {
    if (typeof req.body?.message !== 'string') {
      return res.status(400).type('text').send('The message field is required.');
    }
    try {
      const reply = await chatService.chat(req.body.message, req.file);
      res.type('text').send(reply);
    } catch (error) {
      next(error);
    }
  });

  router.delete('/', async (req, res, next) => {
    try {
      await chatService.clearHistory();
      res.status(200).end();
    } catch (error) {
      next(error);
    }
  });

  return router;
}
