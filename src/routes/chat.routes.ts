import { Router, type Router as RouterType } from 'express';
import { z } from 'zod';
import { chatOrchestratorService } from '../services/chat/chat-orchestrator.service.js';
import { AppError } from '../middleware/error-handler.js';

export const chatRouter: RouterType = Router();

const uuidSchema = z.string().uuid();
function validateUuid(value: string, name: string): string {
  const result = uuidSchema.safeParse(value);
  if (!result.success) {
    throw new AppError('INVALID_PARAM', `${name} must be a valid UUID`, 400);
  }
  return result.data;
}

// Validation schemas
const createSessionSchema = z.object({
  title: z.string().optional(),
  tenantId: z.string().optional(),
});

const sendMessageSchema = z.object({
  content: z.string().min(1, 'Message content is required'),
  fileIds: z.array(z.string().uuid()).optional(),
});

/**
 * GET /api/chat/sessions
 * List all sessions
 */
chatRouter.get('/sessions', async (req, res, next) => {
  try {
    const tenantId = req.query.tenantId as string | undefined;
    const sessions = await chatOrchestratorService.listSessions(tenantId);
    res.json({ success: true, data: { sessions } });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/chat/sessions
 * Create a new session
 */
chatRouter.post('/sessions', async (req, res, next) => {
  try {
    const body = createSessionSchema.parse(req.body);
    const session = await chatOrchestratorService.createSession(body.title, body.tenantId);
    res.status(201).json({ success: true, data: { session } });
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new AppError('VALIDATION_ERROR', error.errors[0]?.message || 'Validation error', 400));
      return;
    }
    next(error);
  }
});

/**
 * GET /api/chat/sessions/:id
 * Get a session with all messages
 */
chatRouter.get('/sessions/:id', async (req, res, next) => {
  try {
    const id = validateUuid(req.params.id!, 'id');
    const session = await chatOrchestratorService.getSession(id);
    res.json({ success: true, data: { session } });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/chat/sessions/:id
 * Delete a session
 */
chatRouter.delete('/sessions/:id', async (req, res, next) => {
  try {
    const id = validateUuid(req.params.id!, 'id');
    await chatOrchestratorService.deleteSession(id);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/chat/sessions/:id/messages
 * Send a message and stream the response (SSE)
 */
chatRouter.post('/sessions/:id/messages', async (req, res, next) => {
  try {
    const body = sendMessageSchema.parse(req.body);
    const sessionId = validateUuid(req.params.id!, 'id');

    // Set up SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

    // Stream the response
    for await (const event of chatOrchestratorService.processMessage(
      sessionId,
      body.content,
      body.fileIds
    )) {
      const data = JSON.stringify(event);
      res.write(`data: ${data}\n\n`);

      // Flush to ensure immediate delivery
      if (typeof (res as any).flush === 'function') {
        (res as any).flush();
      }
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new AppError('VALIDATION_ERROR', error.errors[0]?.message || 'Validation error', 400));
      return;
    }
    next(error);
  }
});
