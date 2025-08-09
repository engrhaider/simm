from fastapi import APIRouter, Depends, HTTPException
from typing import List, Any, Dict

from backend.core.security import get_current_active_user
from backend.schemas.token import TokenPayload
from backend.services.facebook_service import FacebookService
from backend.schemas.facebook import FacebookPost # For response model validation

router = APIRouter()

@router.get("/posts", summary="Get Facebook posts for the authenticated user")
async def get_facebook_posts(
    current_user: TokenPayload = Depends(get_current_active_user),
    limit: int = 10,
    after: str = None
) -> Dict[str, Any]:
    if not current_user.fb_access_token:
        raise HTTPException(status_code=403, detail="Facebook access token not found in JWT.")

    fb_service = FacebookService(user_fb_token=current_user.fb_access_token)
    try:
        posts_response = await fb_service.get_user_posts(limit=limit, after=after)
        return posts_response
    except Exception as e:
        # Log the exception details for debugging on the backend
        print(f"Error in /posts endpoint: {str(e)}")
        # Check if it's an HTTPStatusError from httpx to get more details
        if hasattr(e, 'response') and e.response is not None:
            raise HTTPException(status_code=e.response.status_code, detail=f"Error fetching Facebook posts: {e.response.text}")


@router.get("/posts/{post_id}", summary="Get a single Facebook post by ID")
async def get_facebook_post(
    post_id: str,
    current_user: TokenPayload = Depends(get_current_active_user)
) -> Dict[str, Any]:
    if not current_user.fb_access_token:
        raise HTTPException(status_code=403, detail="Facebook access token not found in JWT.")

    fb_service = FacebookService(user_fb_token=current_user.fb_access_token)
    try:
        post_data = await fb_service.get_single_post(post_id=post_id)
        return post_data
    except Exception as e:
        print(f"Error in /posts/{post_id} endpoint: {str(e)}")
        if hasattr(e, 'response') and e.response is not None:
            raise HTTPException(status_code=e.response.status_code, detail=f"Error fetching Facebook post: {e.response.text}")
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred while fetching post: {str(e)}")


@router.get("/posts/{post_id}/comments", summary="Get comments for a specific Facebook post") # Define response_model later if needed
async def get_facebook_post_comments(
    post_id: str,
    current_user: TokenPayload = Depends(get_current_active_user),
    limit: int = 50
) -> List[Dict[str, Any]]:
    if not current_user.fb_access_token:
        raise HTTPException(status_code=403, detail="Facebook access token not found in JWT.")
    
    fb_service = FacebookService(user_fb_token=current_user.fb_access_token)
    try:
        comments_data = await fb_service.get_post_comments(post_id=post_id, limit=limit)
        return comments_data
    except Exception as e:
        print(f"Error in /posts/{post_id}/comments endpoint: {str(e)}")
        if hasattr(e, 'response') and e.response is not None:
            raise HTTPException(status_code=e.response.status_code, detail=f"Error fetching comments: {e.response.text}")
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred while fetching comments: {str(e)}") 