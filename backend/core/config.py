import os
from dotenv import load_dotenv
from pathlib import Path

# Construct the path to the .env file relative to this config.py file
# This config.py is in backend/core/, so .env is two levels up and then into .env
# More robustly: current_dir / .. / .. / .env (if .env is in root)
# OR current_dir / .. / .env (if .env is in backend/)

# Path to the directory containing this config.py file
CORE_DIR = Path(__file__).resolve().parent
# Path to the backend directory (one level up from core)
BACKEND_DIR = CORE_DIR.parent
# Path to the .env file within the backend directory
ENV_PATH = BACKEND_DIR / ".env"

load_dotenv(dotenv_path=ENV_PATH)

class Settings:
    API_V1_STR: str = "/api/v1"
    FACEBOOK_APP_ID: str = os.getenv("FACEBOOK_APP_ID", "") # Default to empty string if not found
    FACEBOOK_APP_SECRET: str = os.getenv("FACEBOOK_APP_SECRET", "")
    FACEBOOK_REDIRECT_URI: str = os.getenv("FACEBOOK_REDIRECT_URI", f"http://localhost:8000{API_V1_STR}/auth/facebook/callback")
    APP_SECRET_KEY: str = os.getenv("APP_SECRET_KEY", "")
    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:3000")

    # Facebook Graph API endpoints
    FB_GRAPH_API_URL: str = "https://graph.facebook.com/v20.0"

    def __init__(self):
        # You can add validation here to ensure critical env vars are set
        if not self.FACEBOOK_APP_ID:
            print("Warning: FACEBOOK_APP_ID is not set in .env")
        if not self.FACEBOOK_APP_SECRET:
            print("Warning: FACEBOOK_APP_SECRET is not set in .env")
        if not self.APP_SECRET_KEY:
            print("Warning: APP_SECRET_KEY is not set in .env. Security risk!")

settings = Settings() 