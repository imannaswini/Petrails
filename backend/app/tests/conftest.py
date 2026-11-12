import os
import sys
from pathlib import Path

# Set TESTING=true before importing settings
os.environ["TESTING"] = "true"

backend_dir = str(Path(__file__).resolve().parent.parent.parent)
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

