import { getDb } from '../../db/index.js';
import { files, knowledgeNodes, knowledgeEdges } from '../../db/schema/index.js';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs/promises';
import * as path from 'path';
import type { FileMetadata, ExtractedContent, NodeType } from '../../types/index.js';
import { geminiClientService } from '../llm/gemini-client.service.js';
import { relationshipInferrerService } from '../knowledge-graph/relationship-inferrer.service.js';
import { AppError } from '../../middleware/error-handler.js';
import { getConfig } from '../../config.js';

/**
 * File Processor Service
 * Handles file uploads and content extraction via Gemini
 *
 * IMPORTANT: Gemini is used ONLY for extraction, NOT for reasoning
 */
export const fileProcessorService = {
  /**
   * Save an uploaded file and queue for processing
   */
  async saveFile(
    sessionId: string,
    file: {
      originalname: string;
      mimetype: string;
      size: number;
      buffer: Buffer;
    }
  ): Promise<FileMetadata> {
    const UPLOAD_DIR = getConfig().uploadDir || './uploads';
    // Ensure upload directory exists
    await fs.mkdir(UPLOAD_DIR, { recursive: true });

    const fileId = uuidv4();
    const ext = path.extname(file.originalname);
    const storagePath = path.join(UPLOAD_DIR, `${fileId}${ext}`);

    // Write file to disk
    await fs.writeFile(storagePath, file.buffer);

    // Create database record
    const [fileRecord] = await getDb()
      .insert(files)
      .values({
        id: fileId,
        sessionId,
        originalName: file.originalname,
        mimeType: file.mimetype,
        fileSize: file.size,
        storagePath,
        processingStatus: 'pending',
        createdAt: new Date(),
      })
      .returning();

    // Start async processing — errors are recorded in the DB (processingStatus = 'failed')
    this.processFile(fileId).catch((err) => {
      console.error(`File processing failed for ${fileId}:`, err);
      // Ensure status is set to failed even if processFile's own catch didn't fire
      getDb()
        .update(files)
        .set({ processingStatus: 'failed', processingError: err instanceof Error ? err.message : 'Unknown error' })
        .where(eq(files.id, fileId))
        .catch(() => {}); // Last-resort: don't let DB error propagate
    });

    return fileRecord as FileMetadata;
  },

  /**
   * Process a file using Gemini for extraction
   */
  async processFile(fileId: string): Promise<void> {
    // Update status to processing
    await getDb()
      .update(files)
      .set({ processingStatus: 'processing' })
      .where(eq(files.id, fileId));

    try {
      // Get file record
      const fileRecord = await getDb().query.files.findFirst({
        where: eq(files.id, fileId),
      });

      if (!fileRecord) {
        throw new AppError('FILE_NOT_FOUND', 'File not found', 404);
      }

      // Read file content
      const fileBuffer = await fs.readFile(fileRecord.storagePath);
      const base64Content = fileBuffer.toString('base64');

      // Extract content using Gemini (EXTRACTION ONLY)
      const extractionResult = await geminiClientService.extractFromFile({
        fileId,
        mimeType: fileRecord.mimeType,
        fileContent: base64Content,
      });

      if (!extractionResult.success) {
        throw new Error(extractionResult.error || 'Extraction failed');
      }

      // Update file record with extracted content
      await getDb()
        .update(files)
        .set({
          extractedContent: extractionResult.extractedContent,
          processingStatus: 'completed',
        })
        .where(eq(files.id, fileId));

      // Create knowledge graph nodes from extracted content
      await this.integrateIntoGraph(fileRecord.sessionId, fileId, extractionResult.extractedContent!);
    } catch (error) {
      console.error('File processing error:', error);

      await getDb()
        .update(files)
        .set({
          processingStatus: 'failed',
          processingError: error instanceof Error ? error.message : 'Unknown error',
        })
        .where(eq(files.id, fileId));
    }
  },

  /**
   * Integrate extracted content into the knowledge graph
   */
  async integrateIntoGraph(
    sessionId: string,
    fileId: string,
    content: ExtractedContent
  ): Promise<void> {
    const nodesToCreate: Array<{
      id: string;
      sessionId: string;
      nodeType: NodeType;
      name: string;
      graphData: Record<string, unknown>;
      confidenceScore: string;
      priorityScore: string;
      version: number;
      isDeleted: boolean;
      createdAt: Date;
      updatedAt: Date;
    }> = [];

    // Create Artifact node for the file
    const artifactNode = {
      id: uuidv4(),
      sessionId,
      nodeType: 'Artifact' as NodeType,
      name: `File: ${fileId.substring(0, 8)}`,
      graphData: {
        fileId,
        textPreview: content.textContent?.substring(0, 200),
        structure: content.structure,
      },
      confidenceScore: '1.00',
      priorityScore: '0.60',
      version: 1,
      isDeleted: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    nodesToCreate.push(artifactNode);

    // Create Entity nodes from extracted entities
    if (content.entities) {
      for (const person of content.entities.people || []) {
        nodesToCreate.push({
          id: uuidv4(),
          sessionId,
          nodeType: 'Entity' as NodeType,
          name: person,
          graphData: { entityType: 'person', sourceFile: fileId },
          confidenceScore: '0.80',
          priorityScore: '0.50',
          version: 1,
          isDeleted: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }

      for (const org of content.entities.organizations || []) {
        nodesToCreate.push({
          id: uuidv4(),
          sessionId,
          nodeType: 'Entity' as NodeType,
          name: org,
          graphData: { entityType: 'organization', sourceFile: fileId },
          confidenceScore: '0.80',
          priorityScore: '0.50',
          version: 1,
          isDeleted: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }

      for (const tech of content.entities.technologies || []) {
        nodesToCreate.push({
          id: uuidv4(),
          sessionId,
          nodeType: 'Entity' as NodeType,
          name: tech,
          graphData: { entityType: 'technology', sourceFile: fileId },
          confidenceScore: '0.70',
          priorityScore: '0.50',
          version: 1,
          isDeleted: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    }

    // Insert all nodes
    if (nodesToCreate.length > 0) {
      await getDb().insert(knowledgeNodes).values(nodesToCreate);
    }

    // Create DERIVED_FROM edges from extracted entities to artifact
    const extractedNodeIds = nodesToCreate.filter((n) => n.nodeType !== 'Artifact').map((n) => n.id);
    const edges = extractedNodeIds.map((nodeId) => ({
      id: uuidv4(),
      sessionId,
      sourceNodeId: nodeId,
      targetNodeId: artifactNode.id,
      edgeType: 'DERIVED_FROM',
      edgeData: { source: 'file_extraction' },
      weight: '1.00',
      isDeleted: false,
      createdAt: new Date(),
    }));

    if (edges.length > 0) {
      await getDb().insert(knowledgeEdges).values(edges);
    }
  },

  /**
   * Get file metadata
   */
  async getFile(fileId: string): Promise<FileMetadata> {
    const fileRecord = await getDb().query.files.findFirst({
      where: eq(files.id, fileId),
    });

    if (!fileRecord) {
      throw new AppError('FILE_NOT_FOUND', 'File not found', 404);
    }

    return fileRecord as FileMetadata;
  },

  /**
   * Get extracted content for a file
   */
  async getExtractedContent(fileId: string): Promise<ExtractedContent | null> {
    const fileRecord = await getDb().query.files.findFirst({
      where: eq(files.id, fileId),
    });

    if (!fileRecord) {
      throw new AppError('FILE_NOT_FOUND', 'File not found', 404);
    }

    return fileRecord.extractedContent as ExtractedContent | null;
  },

  /**
   * Delete a file
   */
  async deleteFile(fileId: string): Promise<void> {
    const fileRecord = await getDb().query.files.findFirst({
      where: eq(files.id, fileId),
    });

    if (fileRecord) {
      // Delete physical file
      try {
        await fs.unlink(fileRecord.storagePath);
      } catch (err) {
        console.error('Failed to delete physical file:', err);
      }

      // Delete database record
      await getDb().delete(files).where(eq(files.id, fileId));
    }
  },
};
