from __future__ import annotations

import os

AGGREGATOR_URL: str = os.getenv("AGGREGATOR_URL", "http://200.69.13.70:5008")
REPORTING_URL: str = os.getenv("REPORTING_URL", "http://200.69.13.70:5009")

REDIS_HOST: str = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT: int = int(os.getenv("REDIS_PORT", "6379"))

REDIS_PUBSUB_HOST: str = os.getenv("REDIS_PUBSUB_HOST", "200.69.13.70")
REDIS_PUBSUB_PORT: int = int(os.getenv("REDIS_PUBSUB_PORT", "5010"))

FORTNITE_ISLAND_CODE: str = os.getenv("FORTNITE_ISLAND_CODE", "3225-0366-8885")

SUPABASE_COLLECTOR_DEVICE_ID: str = "supabase-collector"

SUPABASE_URL: str = os.getenv("SUPABASE_URL", "https://yaykhzgsoozcdfbbyqvk.supabase.co")
SUPABASE_ANON_KEY: str = os.getenv("SUPABASE_ANON_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlheWtoemdzb296Y2RmYmJ5cXZrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTg1NzY4NywiZXhwIjoyMDg3NDMzNjg3fQ.FMLqGGLpXFkSEVz0cNQys3c3iO8TwJt0fwWvgJSiXLE")

# Mutable at runtime — command_listener updates these in place via the module dict
PC_COLLECT_INTERVAL_SECONDS: int = int(os.getenv("PC_COLLECT_INTERVAL_SECONDS", "30"))
FORTNITE_POLL_INTERVAL_SECONDS: int = int(os.getenv("FORTNITE_POLL_INTERVAL_SECONDS", "600"))
SUPABASE_COLLECT_INTERVAL_SECONDS: int = int(os.getenv("SUPABASE_COLLECT_INTERVAL_SECONDS", "20"))
UPLOAD_INTERVAL_SECONDS: int = int(os.getenv("UPLOAD_INTERVAL_SECONDS", "30"))
