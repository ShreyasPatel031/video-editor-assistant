#!/usr/bin/env python3
"""
vertex_test.py – Call Vertex AI Gemini model with multiple Cloud Storage video URIs
and print a flat list of snippets returned (baseline speed test).

Requires:
  pip install google-generativeai
Ensure GOOGLE_APPLICATION_CREDENTIALS env-var points to a service-account JSON.
"""
from __future__ import annotations

import json
import re
import textwrap
import time
from pathlib import Path
import sys

from google import genai
from google.genai import types
from google.oauth2 import service_account

# ------------------------ CONFIG ------------------------------------ #
GS_VIDEOS: list[tuple[str, str]] = [
    ("1", "gs://gopro_videos/sample2.mp4"),
    ("2", "gs://gopro_videos/sample3.mp4"),
    ("3", "gs://gopro_videos/sample4.mp4"),
]

PROMPT = textwrap.dedent(
    """
    You will receive several tagged videos [VIDEO_1] [VIDEO_2] [VIDEO_3].

    Produce ONE JSON array.  Each element must be:
      {
        "video_id": "VIDEO_1",        // the tag
        "start":    "HH:MM:SS",       // two-digit hours, minutes, seconds
        "end":      "HH:MM:SS|null",  // may be null
        "description": "visual summary for that slice"
      }

    • Interleave snippets from different videos in chronological or logical order.
    • 3-4 snippets per video (≤10 total).
    • NO ranges like 00:00-00:05, no decimals, no extra keys, no prose outside JSON.
    """
)

TIME_RE = r"^\d{2}:\d{2}:\d{2}$"
SCHEMA: dict[str, object] = {
    "type": "array",
    "items": {
        "type": "object",
        "properties": {
            "video_id": {"type": "string"},
            "start": {"type": "string", "pattern": TIME_RE},
            "end": {"type": "string", "pattern": TIME_RE, "nullable": True},
            "description": {"type": "string"},
        },
        "required": ["video_id", "start", "end", "description"],
    },
}

PROJECT_ID = "applied-ai-practice00"  # project from credentials.json
LOCATION = "global"
MODEL = "gemini-2.5-flash-preview-05-20"

# --------------------- Helper utilities ----------------------------- #

def build_request() -> list[types.Content]:
    parts: list[types.Part] = [types.Part.from_text(text=PROMPT)]
    for vid, uri in GS_VIDEOS:
        parts.extend(
            [
                types.Part.from_text(text=f"[VIDEO_{vid}]"),
                types.Part.from_uri(file_uri=uri, mime_type="video/mp4"),
            ]
        )
    return [types.Content(role="user", parts=parts)]


def sanitise(txt: str) -> str:
    """Attempt to clean model output so that it parses as JSON."""
    txt = txt.strip()

    # Remove markdown fences if present
    if txt.startswith("```"):
        txt = re.sub(r"^```[a-zA-Z]*\n?", "", txt)
        txt = re.sub(r"```\s*$", "", txt)

    # Remove trailing commas before closing brackets/braces
    txt = re.sub(r",\s*([}\]])", r"\1", txt)

    # Ensure times don't contain extra decimals, etc.
    txt = re.sub(r'"(start|end)"\s*:\s*"(\d{2}:\d{2}:\d{2})[^"}]*"', r'"\1":"\2"', txt)

    # Escape stray backslashes that aren't valid JSON escapes
    txt = re.sub(r"\\(?![\\/bfnrtu\"])", r"\\\\", txt)

    return txt


# ------------------------ Main -------------------------------------- #

def main() -> None:
    json_only = "--json" in sys.argv

    start_time = time.time()

    # Load service-account credentials programmatically (no env var needed)
    SA_PATH = Path(__file__).with_name("credentials.json")
    creds = service_account.Credentials.from_service_account_file(
        str(SA_PATH), scopes=["https://www.googleapis.com/auth/cloud-platform"],
    )

    client = genai.Client(vertexai=True, project=PROJECT_ID, location=LOCATION, credentials=creds)

    cfg = types.GenerateContentConfig(
        temperature=0.3,
        max_output_tokens=4096,
        response_mime_type="application/json",
        response_schema=SCHEMA,  # type: ignore
        safety_settings=[
            types.SafetySetting(category=c, threshold="OFF")
            for c in [
                "HARM_CATEGORY_HATE_SPEECH",
                "HARM_CATEGORY_DANGEROUS_CONTENT",
                "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                "HARM_CATEGORY_HARASSMENT",
            ]
        ],
    )

    # Stream the response so we can capture latency to first token, etc.
    if not json_only:
        print("▶  Sending request to Vertex Gemini …", flush=True)

    chunks = client.models.generate_content_stream(model=MODEL, contents=build_request(), config=cfg)

    raw_parts: list[str] = []
    for ck in chunks:
        if ck.text:
            raw_parts.append(ck.text)
    raw = "".join(raw_parts)

    elapsed = time.time() - start_time
    if not json_only:
        print(f"⏱️  Latency (wall): {elapsed:.2f}s\n")

    raw = sanitise(raw)
    try:
        snippets = json.loads(raw)
    except json.JSONDecodeError:
        print("⚠️  JSON decode failed – fetching non-stream result…")
        raw = sanitise(
            client.models.generate_content(model=MODEL, contents=build_request(), config=cfg).text or ""
        )
        snippets = json.loads(raw)

    # Pretty print result
    print("— Gemini Snippets —")
    for sn in snippets:
        vid = sn["video_id"]
        start = sn["start"]
        end = sn.get("end", "…")
        print(f"{vid}  🕒 {start} – {end}: {sn['description']}")

    if json_only:
        # JSON already printed; nothing else
        return
    else:
        print(json.dumps(snippets, ensure_ascii=False))


if __name__ == "__main__":
    main() 