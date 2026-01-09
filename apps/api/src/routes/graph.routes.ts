import { Router, type Router as RouterType } from 'express';
import { db } from '@context-engine/db';
import { knowledgeNodes, knowledgeEdges, contextDeltas, graphVersions } from '@context-engine/db/schema';
import { eq, desc } from 'drizzle-orm';
import { graphBuilderService } from '../services/knowledge-graph/graph-builder.service.js';
import { AppError } from '../middleware/error-handler.js';

export const graphRouter: RouterType = Router();

/**
 * GET /api/graph/:sessionId
 * Get the current knowledge graph for a session
 */
graphRouter.get('/:sessionId', async (req, res, next) => {
  try {
    const graph = await graphBuilderService.getGraph(req.params.sessionId!);

    res.json({
      success: true,
      data: { graph },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/graph/:sessionId/versions
 * List all graph versions for a session
 */
graphRouter.get('/:sessionId/versions', async (req, res, next) => {
  try {
    const versions = await db.query.graphVersions.findMany({
      where: eq(graphVersions.sessionId, req.params.sessionId!),
      orderBy: [desc(graphVersions.version)],
    });

    const versionSummaries = versions.map((v) => {
      const snapshot = v.graphSnapshot as { nodes?: unknown[]; edges?: unknown[] };
      return {
        version: v.version,
        createdAt: v.createdAt,
        nodeCount: Array.isArray(snapshot?.nodes) ? snapshot.nodes.length : 0,
        edgeCount: Array.isArray(snapshot?.edges) ? snapshot.edges.length : 0,
      };
    });

    res.json({
      success: true,
      data: { versions: versionSummaries },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/graph/:sessionId/versions/:version
 * Get a specific graph version
 */
graphRouter.get('/:sessionId/versions/:version', async (req, res, next) => {
  try {
    const versionNum = parseInt(req.params.version!, 10);

    if (isNaN(versionNum)) {
      throw new AppError('INVALID_VERSION', 'Version must be a number', 400);
    }

    const version = await db.query.graphVersions.findFirst({
      where: eq(graphVersions.sessionId, req.params.sessionId!),
      orderBy: [desc(graphVersions.version)],
    });

    if (!version || version.version !== versionNum) {
      // Try to find the specific version
      const specificVersion = await db.query.graphVersions.findFirst({
        where: eq(graphVersions.version, versionNum),
      });

      if (!specificVersion) {
        throw new AppError('VERSION_NOT_FOUND', 'Graph version not found', 404);
      }

      res.json({
        success: true,
        data: { version: specificVersion },
      });
      return;
    }

    res.json({
      success: true,
      data: { version },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/graph/:sessionId/deltas
 * Get context evolution timeline (deltas)
 */
graphRouter.get('/:sessionId/deltas', async (req, res, next) => {
  try {
    const deltas = await db.query.contextDeltas.findMany({
      where: eq(contextDeltas.sessionId, req.params.sessionId!),
      orderBy: [desc(contextDeltas.versionTo)],
    });

    const enrichedDeltas = deltas.map((d) => {
      const deltaData = d.deltaData as {
        additions?: { nodes?: unknown[]; edges?: unknown[] };
        modifications?: { nodes?: unknown[]; priorities?: unknown[] };
        removals?: { nodeIds?: unknown[]; edgeIds?: unknown[] };
      };

      return {
        id: d.id,
        versionFrom: d.versionFrom,
        versionTo: d.versionTo,
        triggerMessageId: d.triggerMessageId,
        createdAt: d.createdAt,
        summary: `Version ${d.versionFrom} → ${d.versionTo}`,
        statistics: {
          additions:
            (deltaData?.additions?.nodes?.length || 0) +
            (deltaData?.additions?.edges?.length || 0),
          modifications:
            (deltaData?.modifications?.nodes?.length || 0) +
            (deltaData?.modifications?.priorities?.length || 0),
          removals:
            (deltaData?.removals?.nodeIds?.length || 0) +
            (deltaData?.removals?.edgeIds?.length || 0),
        },
      };
    });

    res.json({
      success: true,
      data: { deltas: enrichedDeltas },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/graph/:sessionId/deltas/:deltaId
 * Get a specific delta
 */
graphRouter.get('/:sessionId/deltas/:deltaId', async (req, res, next) => {
  try {
    const delta = await db.query.contextDeltas.findFirst({
      where: eq(contextDeltas.id, req.params.deltaId!),
    });

    if (!delta) {
      throw new AppError('DELTA_NOT_FOUND', 'Context delta not found', 404);
    }

    res.json({
      success: true,
      data: { delta },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/graph/:sessionId/context
 * Get prioritized context for Claude (debugging endpoint)
 */
graphRouter.get('/:sessionId/context', async (req, res, next) => {
  try {
    const minPriority = req.query.minPriority
      ? parseFloat(req.query.minPriority as string)
      : undefined;

    const context = await graphBuilderService.getPrioritizedContext(
      req.params.sessionId!,
      minPriority
    );

    res.json({
      success: true,
      data: { context },
    });
  } catch (error) {
    next(error);
  }
});
