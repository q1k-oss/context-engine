#!/usr/bin/env python3
"""Docling extraction adapter for context-engine.

Reads a single file path (argv[1]), parses it with Docling, and prints a JSON
object to stdout matching the TypeScript `ExtractedContent` shape:

    {
      "textContent": str,
      "structure": {
        "title": str | None,
        "sections": [{"heading": str, "content": str, "level": int, "pageRef": int | None}],
        "tables":   [{"caption": str | None, "headers": [str], "rows": [[str]]}],
        "lists":    [{"type": "ordered" | "unordered", "items": [str]}],
        "figures":  [{"caption": str | None, "pageRef": int | None}]
      },
      "metadata": {"pageCount": int, "wordCount": int, "characterCount": int}
    }

The TS caller (`docling-client.service.ts`) spawns this and falls back to the
Gemini extractor on a non-zero exit, so this script must fail loudly (exit 1 +
stderr) rather than emit partial JSON.

Run: `uv run python python/docling_extract.py <file>`

Device: the layout model (RT-DETR-v2) requests float64, which Apple-Silicon MPS
does not support — so we pin the accelerator via `DOCLING_DEVICE` (default `CPU`,
verified stable on macOS). Set `DOCLING_DEVICE=CUDA`/`MPS`/`AUTO` on a capable host.
"""

import json
import os
import sys


def _page_of(item) -> "int | None":
    prov = getattr(item, "prov", None)
    if prov:
        first = prov[0] if isinstance(prov, (list, tuple)) else prov
        return getattr(first, "page_no", None)
    return None


def extract(path: str) -> dict:
    from docling.document_converter import DocumentConverter, PdfFormatOption
    from docling.datamodel.base_models import InputFormat
    from docling.datamodel.pipeline_options import (
        AcceleratorOptions,
        PdfPipelineOptions,
    )

    # Pin the accelerator device (lowercase string: auto/cpu/mps/cuda/cuda:N).
    # Default cpu avoids the Apple-Silicon MPS float64 crash in RT-DETR-v2;
    # override with DOCLING_DEVICE on a capable host.
    device = os.getenv("DOCLING_DEVICE", "cpu").lower()
    pipeline_options = PdfPipelineOptions(
        accelerator_options=AcceleratorOptions(device=device)
    )
    converter = DocumentConverter(
        format_options={
            InputFormat.PDF: PdfFormatOption(pipeline_options=pipeline_options)
        }
    )

    doc = converter.convert(path).document

    text_content = doc.export_to_markdown()

    sections: list[dict] = []
    lists: list[dict] = []
    current_list: "dict | None" = None

    for item in getattr(doc, "texts", []) or []:
        label = str(getattr(item, "label", "")).lower()
        text = (getattr(item, "text", "") or "").strip()
        if not text:
            continue

        if "list_item" in label:
            if current_list is None:
                current_list = {"type": "unordered", "items": []}
                lists.append(current_list)
            current_list["items"].append(text)
            continue
        current_list = None  # any non-list item closes the run

        if "section_header" in label or "title" in label:
            sections.append(
                {
                    "heading": text,
                    "content": "",
                    "level": int(getattr(item, "level", 1) or 1),
                    "pageRef": _page_of(item),
                }
            )
        else:
            if not sections:
                sections.append({"heading": "", "content": "", "level": 1, "pageRef": _page_of(item)})
            sections[-1]["content"] = (sections[-1]["content"] + "\n" + text).strip()

    tables: list[dict] = []
    for tbl in getattr(doc, "tables", []) or []:
        try:
            df = tbl.export_to_dataframe()
            headers = [str(c) for c in df.columns.tolist()]
            rows = [[("" if v is None else str(v)) for v in row] for row in df.values.tolist()]
        except Exception:
            headers, rows = [], []
        caption = None
        try:
            caption = tbl.caption_text(doc) or None
        except Exception:
            pass
        tables.append({"caption": caption, "headers": headers, "rows": rows})

    figures: list[dict] = []
    for pic in getattr(doc, "pictures", []) or []:
        caption = None
        try:
            caption = pic.caption_text(doc) or None
        except Exception:
            pass
        figures.append({"caption": caption, "pageRef": _page_of(pic)})

    title = sections[0]["heading"] if sections and sections[0]["heading"] else None

    return {
        "textContent": text_content,
        "structure": {
            "title": title,
            "sections": sections,
            "tables": tables,
            "lists": lists,
            "figures": figures,
        },
        "metadata": {
            "pageCount": len(getattr(doc, "pages", []) or []),
            "wordCount": len(text_content.split()),
            "characterCount": len(text_content),
        },
    }


def main() -> int:
    if len(sys.argv) < 2:
        print("usage: docling_extract.py <file>", file=sys.stderr)
        return 2
    try:
        result = extract(sys.argv[1])
    except Exception as exc:  # noqa: BLE001 — surface any failure to the TS caller
        print(f"docling extraction failed: {exc}", file=sys.stderr)
        return 1
    json.dump(result, sys.stdout, ensure_ascii=False)
    return 0


if __name__ == "__main__":
    sys.exit(main())
