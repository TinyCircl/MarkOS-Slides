#!/usr/bin/env python3
"""Convert a Slidev markdown file into a JSON request body."""

from __future__ import annotations

import argparse
import json
from pathlib import Path


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Convert a Slidev markdown file into a JSON request body for slidev-renderer."
    )
    parser.add_argument("markdown_file", help="Path to the Slidev markdown file.")
    parser.add_argument(
        "--api",
        choices=["render", "preview-build", "preview-session"],
        default="render",
        help="Which HTTP API payload to generate.",
    )
    parser.add_argument("--title", help="Optional title override. Defaults to the markdown file stem.")
    parser.add_argument(
        "--format",
        choices=["web", "pdf", "pptx"],
        default="web",
        help="Render format for /api/render.",
    )
    parser.add_argument(
        "--file-name",
        help="Optional output file name for /api/render.",
    )
    parser.add_argument(
        "--preview-id",
        default="demo-preview",
        help="Preview ID for /api/previews/build.",
    )
    parser.add_argument(
        "--base-path",
        help="Optional basePath for /api/previews/build. Defaults to /p/<preview-id>/.",
    )
    parser.add_argument(
        "--entry",
        default="slides.md",
        help="Entry path for /api/previews/build when using inline content.",
    )
    parser.add_argument("--project-id", help="Optional projectId for /api/preview/session.")
    parser.add_argument("--cache-key", help="Optional cacheKey for /api/preview/session.")
    parser.add_argument("--document-id", help="Optional documentId for /api/preview/session.")
    parser.add_argument(
        "--no-ascii-escape",
        action="store_true",
        help="Print UTF-8 characters directly instead of escaping them.",
    )
    return parser


def build_payload(args: argparse.Namespace, content: str, title: str) -> dict:
    if args.api == "render":
        payload = {
            "title": title,
            "content": content,
            "format": args.format,
        }
        if args.file_name:
            payload["fileName"] = args.file_name
        return payload

    if args.api == "preview-build":
        return {
            "previewId": args.preview_id,
            "basePath": args.base_path or f"/p/{args.preview_id}/",
            "entry": args.entry,
            "title": title,
            "content": content,
        }

    payload = {
        "title": title,
        "content": content,
    }
    if args.project_id:
        payload["projectId"] = args.project_id
    if args.cache_key:
        payload["cacheKey"] = args.cache_key
    if args.document_id:
        payload["documentId"] = args.document_id
    return payload


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()

    markdown_path = Path(args.markdown_file)
    content = markdown_path.read_text(encoding="utf-8")
    title = args.title or markdown_path.stem
    payload = build_payload(args, content, title)
    print(json.dumps(payload, ensure_ascii=not args.no_ascii_escape, indent=2))


if __name__ == "__main__":
    main()
