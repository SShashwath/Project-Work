#!/usr/bin/env python3
"""Entry point to start the AgriSense FastAPI server."""
import uvicorn

if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8001,
        reload=True,
        reload_includes=["*.py"],
        log_level="info",
    )
