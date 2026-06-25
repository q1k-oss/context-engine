import { spawn } from 'child_process';
import * as path from 'path';
import { fileURLToPath } from 'url';
import type { ExtractedContent } from '../../types/index.js';

export interface DoclingExtractionRequest {
  /** Absolute or relative path to the file on disk. */
  storagePath: string;
  mimeType: string;
}

export interface DoclingExtractionResponse {
  success: boolean;
  extractedContent?: ExtractedContent;
  error?: string;
}

// This file lives at <pkg>/src/services/files (dev) or <pkg>/dist/services/files
// (built) — both are three levels under the package root, where python/ sits.
const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../');
const SCRIPT_PATH = path.join(PACKAGE_ROOT, 'python', 'docling_extract.py');

/**
 * Docling-backed file extraction. Spawns the Python adapter (`docling_extract.py`)
 * and parses its JSON into `ExtractedContent`. The Python command defaults to
 * `uv run python` (resolves the pyproject env) and can be overridden via
 * `DOCLING_CMD` (space-separated, e.g. "python3").
 *
 * Returns `{ success: false }` on any failure so the caller can fall back to the
 * Gemini extractor rather than throwing.
 */
export const doclingClientService = {
  async extractFromFile(request: DoclingExtractionRequest): Promise<DoclingExtractionResponse> {
    const parts = (process.env.DOCLING_CMD ?? 'uv run python').split(/\s+/).filter(Boolean);
    const cmd = parts[0] ?? 'python3';
    const args = [...parts.slice(1), SCRIPT_PATH, request.storagePath];

    return new Promise<DoclingExtractionResponse>((resolve) => {
      let stdout = '';
      let stderr = '';
      // spawn does not throw synchronously for a missing binary — it emits an
      // 'error' event, handled below — so no try/catch is needed here.
      const child = spawn(cmd, args, { cwd: PACKAGE_ROOT });

      child.stdout.on('data', (d: Buffer) => (stdout += d.toString()));
      child.stderr.on('data', (d: Buffer) => (stderr += d.toString()));
      child.on('error', (err: Error) => resolve({ success: false, error: err.message }));
      child.on('close', (code: number | null) => {
        if (code !== 0) {
          resolve({ success: false, error: stderr.trim() || `docling exited with code ${code}` });
          return;
        }
        try {
          const extractedContent = JSON.parse(stdout) as ExtractedContent;
          resolve({ success: true, extractedContent });
        } catch (err) {
          resolve({
            success: false,
            error: `failed to parse docling output: ${err instanceof Error ? err.message : err}`,
          });
        }
      });
    });
  },
};
