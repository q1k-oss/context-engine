import { Router, type Router as RouterType } from 'express';
import multer from 'multer';
import { fileProcessorService } from '../services/files/file-processor.service.js';
import { AppError } from '../middleware/error-handler.js';

export const filesRouter: RouterType = Router();

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'application/pdf',
      'image/png',
      'image/jpeg',
      'image/gif',
      'image/webp',
      'text/plain',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];

    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new AppError('INVALID_FILE_TYPE', `File type ${file.mimetype} is not supported`, 400));
    }
  },
});

/**
 * POST /api/files/upload
 * Upload a file for processing
 */
filesRouter.post('/upload', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      throw new AppError('NO_FILE', 'No file uploaded', 400);
    }

    const sessionId = req.body.sessionId;
    if (!sessionId) {
      throw new AppError('MISSING_SESSION', 'Session ID is required', 400);
    }

    const file = await fileProcessorService.saveFile(sessionId, {
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      buffer: req.file.buffer,
    });

    res.status(201).json({
      success: true,
      data: {
        fileId: file.id,
        status: file.processingStatus,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/files/:id
 * Get file metadata
 */
filesRouter.get('/:id', async (req, res, next) => {
  try {
    const file = await fileProcessorService.getFile(req.params.id!);

    res.json({
      success: true,
      data: {
        id: file.id,
        originalName: file.originalName,
        mimeType: file.mimeType,
        fileSize: file.fileSize,
        processingStatus: file.processingStatus,
        createdAt: file.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/files/:id/content
 * Get extracted content from a file
 */
filesRouter.get('/:id/content', async (req, res, next) => {
  try {
    const content = await fileProcessorService.getExtractedContent(req.params.id!);

    if (!content) {
      throw new AppError('NOT_PROCESSED', 'File has not been processed yet', 404);
    }

    res.json({
      success: true,
      data: {
        extractedContent: content,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/files/:id
 * Delete a file
 */
filesRouter.delete('/:id', async (req, res, next) => {
  try {
    await fileProcessorService.deleteFile(req.params.id!);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});
