from fastapi import APIRouter, Request, HTTPException, Depends
from fastapi.responses import RedirectResponse, JSONResponse
from httpx import AsyncClient
# import jwt # No longer directly used here for encoding
from datetime import datetime, timedelta, timezone # timedelta is used for expires_delta
from urllib.parse import urlencode
from typing import Optional # Import Optional

from backend.core.config import settings
from backend.core.security import create_access_token # Import from security module

router = APIRouter()

# Helper to create JWT - REMOVED FROM HERE
# def create_access_token(data: dict, expires_delta: timedelta | None = None):
#     ...

@router.get("/login/facebook", summary="Initiate Facebook OAuth2 login flow")
async def login_facebook():
    """
    Redirects the user to Facebook for authentication.
    """
    query_params = {
        "client_id": settings.FACEBOOK_APP_ID,
        "redirect_uri": settings.FACEBOOK_REDIRECT_URI,
        "scope": "email,public_profile,user_posts",
        "response_type": "code",
        "state": "some_random_state_string" # Replace with a CSRF token generation/validation
    }
    facebook_login_url = f"https://www.facebook.com/v19.0/dialog/oauth?{urlencode(query_params)}"
    return RedirectResponse(url=facebook_login_url)

@router.get("/facebook/callback", summary="Handle Facebook OAuth2 callback")
async def auth_facebook_callback(request: Request, code: Optional[str] = None, error: Optional[str] = None, error_reason: Optional[str] = None, error_description: Optional[str] = None):
    """
    Handles the callback from Facebook after user authentication.
    Exchanges the authorization code for an access token.
    """
    if error:
        raise HTTPException(status_code=400, detail=f"Facebook login failed: {error_description or error_reason or error}")

    if not code:
        raise HTTPException(status_code=400, detail="Missing authorization code from Facebook.")

    # Exchange code for an access token
    token_url = f"{settings.FB_GRAPH_API_URL}/oauth/access_token"
    token_params = {
        "client_id": settings.FACEBOOK_APP_ID,
        "client_secret": settings.FACEBOOK_APP_SECRET,
        "redirect_uri": settings.FACEBOOK_REDIRECT_URI,
        "code": code
    }

    async with AsyncClient() as client:
        try:
            response = await client.post(token_url, data=token_params)
            response.raise_for_status() # Raise an exception for bad status codes
            token_data = response.json()
        except Exception as e:
            # Log the error details for debugging
            print(f"Error exchanging code for token: {e}")
            print(f"Response status: {response.status_code if 'response' in locals() else 'N/A'}")
            print(f"Response content: {response.text if 'response' in locals() else 'N/A'}")
            raise HTTPException(status_code=500, detail=f"Could not exchange code for token: {str(e)}")

    user_access_token = token_data.get("access_token")
    if not user_access_token:
        raise HTTPException(status_code=500, detail="Failed to retrieve access token from Facebook.")

    long_lived_token_url = f"{settings.FB_GRAPH_API_URL}/oauth/access_token"
    long_lived_params = {
        "grant_type": "fb_exchange_token",
        "client_id": settings.FACEBOOK_APP_ID,
        "client_secret": settings.FACEBOOK_APP_SECRET,
        "fb_exchange_token": user_access_token
    }
    async with AsyncClient() as client:
        try:
            ll_response = await client.post(long_lived_token_url, data=long_lived_params)
            ll_response.raise_for_status()
            long_lived_token_data = ll_response.json()
            user_access_token = long_lived_token_data.get("access_token", user_access_token) # Fallback to short-lived if LL fails
        except Exception as e:
            # Log this but don't fail the login, proceed with short-lived token
            print(f"Could not exchange for long-lived token: {e}. Proceeding with short-lived token.")

    # Fetch basic user profile information
    user_info_url = f"{settings.FB_GRAPH_API_URL}/me"
    user_info_params = {"fields": "id,name,email,picture", "access_token": user_access_token}
    async with AsyncClient() as client:
        try:
            user_response = await client.get(user_info_url, params=user_info_params)
            user_response.raise_for_status()
            user_data = user_response.json()
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Could not fetch user info from Facebook: {str(e)}")

    # create jwt token
    app_jwt_data = {
        "sub": user_data.get("id"), # Use Facebook user ID as subject
        "name": user_data.get("name"),
        "email": user_data.get("email"),
        "picture": user_data.get("picture", {}).get("data", {}).get("url"),
        "fb_access_token": user_access_token, # Store the Facebook access token
        # "token_type": "bearer" # Not needed in payload, it's part of the response structure
    }
    app_access_token = create_access_token(data=app_jwt_data, expires_delta=timedelta(days=7))

    # For now, return the JWT directly. In a real app, you'd redirect to the frontend
    # with the token (e.g., in a query param or cookie) or set an HTTPOnly cookie.
    response = JSONResponse(content={
        "access_token": app_access_token,
        "token_type": "bearer",
        "user_info": user_data
    })
    
    # Redirect to the frontend with the token so it can be used for subsequent API calls
    frontend_redirect_url = f"{settings.FRONTEND_URL}/auth/callback?token={app_access_token}"
    return RedirectResponse(url=frontend_redirect_url) 