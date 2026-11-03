"""
PETRAILS Actuarial Intelligence API - Application Root Entrypoint
Forwarder to modular app package: app.main:app
"""

import sys
import os

# Add backend directory to sys.path
backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.main import app

if __name__ == "__main__":
    import uvicorn
    from app.core.config import settings
    uvicorn.run("app.main:app", host=settings.HOST, port=settings.PORT, reload=True)

