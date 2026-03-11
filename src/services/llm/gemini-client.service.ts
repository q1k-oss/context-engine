import { GoogleGenerativeAI } from '@google/generative-ai';
import type { ExtractedContent, GeminiExtractionRequest, GeminiExtractionResponse } from '../../types/index.js';
import { getConfig } from '../../config.js';

let genAI: GoogleGenerativeAI | null = null;

function getClient(): GoogleGenerativeAI {
  if (!genAI) {
    genAI = new GoogleGenerativeAI(getConfig().googleAiApiKey || '');
  }
  return genAI;
}

/**
 * Gemini Client Service for file extraction ONLY
 *
 * IMPORTANT: Gemini is used ONLY for extraction, NOT for reasoning.
 * All reasoning is handled by Claude.
 */
export const geminiClientService = {
  /**
   * Extract content from a file
   * Gemini performs EXTRACTION ONLY - no analysis, no reasoning
   */
  async extractFromFile(request: GeminiExtractionRequest): Promise<GeminiExtractionResponse> {
    try {
      const model = getClient().getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

      // Build extraction prompt - emphasize NO reasoning
      const extractionPrompt = `You are a content extraction tool. Your ONLY job is to extract information from this document.

DO NOT:
- Analyze or interpret the content
- Make conclusions or recommendations
- Summarize the meaning
- Add any reasoning or opinions

DO:
- Extract all text content verbatim
- Identify document structure (sections, headings, tables)
- List named entities found (people, organizations, dates, locations)
- Report document metadata

Return the extraction as JSON in this exact format:
{
  "textContent": "Full extracted text content...",
  "structure": {
    "title": "Document title if found",
    "sections": [{"heading": "Section heading", "content": "Section content", "level": 1}],
    "tables": [{"caption": "Table caption", "headers": ["col1", "col2"], "rows": [["cell1", "cell2"]]}],
    "lists": [{"type": "ordered|unordered", "items": ["item1", "item2"]}]
  },
  "entities": {
    "people": ["Name1", "Name2"],
    "organizations": ["Org1", "Org2"],
    "locations": ["Location1"],
    "dates": ["Date1", "Date2"],
    "amounts": ["$100", "50%"],
    "products": ["Product1"],
    "technologies": ["Tech1"]
  },
  "metadata": {
    "pageCount": 1,
    "wordCount": 100,
    "language": "en"
  }
}

Only include fields that have actual content. Return ONLY the JSON, no other text.`;

      // Prepare the content parts
      const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
        { text: extractionPrompt },
      ];

      // Add the file content
      if (request.mimeType.startsWith('image/') || request.mimeType === 'application/pdf') {
        parts.push({
          inlineData: {
            mimeType: request.mimeType,
            data: request.fileContent,
          },
        });
      } else {
        // For text-based files, decode and include as text
        const textContent = Buffer.from(request.fileContent, 'base64').toString('utf-8');
        parts.push({ text: `\n\nDocument content:\n${textContent}` });
      }

      const result = await model.generateContent(parts);
      const response = await result.response;
      const text = response.text();

      // Parse the JSON response
      try {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const extractedContent = JSON.parse(jsonMatch[0]) as ExtractedContent;
          return {
            success: true,
            extractedContent,
          };
        }
      } catch (parseError) {
        console.error('Failed to parse Gemini extraction response:', parseError);
      }

      // Fallback: return the raw text as content
      return {
        success: true,
        extractedContent: {
          textContent: text,
        },
      };
    } catch (error) {
      console.error('Gemini extraction error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown extraction error',
      };
    }
  },

  /**
   * Extract text from an image
   */
  async extractFromImage(
    base64Content: string,
    mimeType: string
  ): Promise<GeminiExtractionResponse> {
    return this.extractFromFile({
      fileId: '',
      mimeType,
      fileContent: base64Content,
    });
  },
};
