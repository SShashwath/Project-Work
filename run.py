#!/usr/bin/env python3
"""Entry point to start the AgriSense FastAPI server."""
import os
import uvicorn

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8001))
    # Enable reload only in local development
    is_prod = os.environ.get("RENDER") is not None or os.environ.get("ENVIRONMENT") == "production"
    reload = not is_prod

    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=port,
        reload=reload,
        reload_includes=["*.py"] if reload else None,
        log_level="info",
    )
