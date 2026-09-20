"""Vercel serverless entrypoint for the Flask API."""
import sys
from pathlib import Path

# Vercel builds this file in an isolated function directory. Make the repo's
# backend package discoverable in both Vercel and local Python execution.
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from backend.app import app  # noqa: E402
