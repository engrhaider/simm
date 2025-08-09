import httpx
from typing import Optional, List, Dict, Any

from backend.core.config import settings
from backend.schemas.facebook import FacebookPost # We might need more schemas later

class FacebookService:
    def __init__(self, user_fb_token: str):
        self.user_fb_token = user_fb_token
        self.base_url = settings.FB_GRAPH_API_URL

    async def get_user_posts(self, limit: int = 25, after: Optional[str] = None) -> Dict[str, Any]:
        """
        Fetches posts from the user's feed.
        Requires user_posts permission.
        Returns both posts data and pagination information.
        """
        # Common fields for posts. Adjust as needed.
        # Refer to: https://developers.facebook.com/docs/graph-api/reference/post/
        fields = (
            "id,message,story,created_time,permalink_url,full_picture,"
            "from,shares,status_type,type"
            # To get counts, you can use summary (e.g., comments.summary(true).limit(0) )
            # However, for full comment/like details, separate calls per post are usually better.
        )
        # Using /me/posts endpoint to get posts published by the user.
        url = f"{self.base_url}/me/posts"
        params = {
            "access_token": self.user_fb_token,
            "fields": fields,
            "limit": limit,
        }
        
        # Add pagination cursor if provided
        if after:
            params["after"] = after
            
        # Define a timeout (e.g., 15 seconds for read, default is 5s)
        timeout_config = httpx.Timeout(30.0, read=30.0)

        async with httpx.AsyncClient(timeout=timeout_config) as client:
            try:
                response = await client.get(url, params=params)
                response.raise_for_status()
                posts_data = response.json()
                
                # Return both posts and pagination info
                return {
                    "data": posts_data.get("data", []),
                    "paging": posts_data.get("paging", {}),
                    "has_next_page": "next" in posts_data.get("paging", {}),
                    "next_cursor": posts_data.get("paging", {}).get("cursors", {}).get("after")
                }
            except httpx.HTTPStatusError as e:
                print(f"HTTP error fetching Facebook posts: Status {e.response.status_code} - Response: {e.response.text}")
                print(f"Request URL: {e.request.url}")
                print(f"Request Headers: {e.request.headers}")
                raise
            except httpx.RequestError as e: # Catch other httpx request errors like timeouts, connection errors
                print(f"httpx RequestError fetching Facebook posts: {type(e).__name__} - {str(e)}")
                print(f"Request URL: {e.request.url}")
                raise
            except Exception as e: # Generic catch-all
                print(f"Generic error fetching Facebook posts: {type(e).__name__} - {str(e)}")
                # For more detailed debugging, you might want to print the full traceback here
                import traceback
                traceback.print_exc()
                raise

    async def get_single_post(self, post_id: str) -> Dict[str, Any]:
        """
        Fetches a single post by ID with optimized fields.
        """
        # Optimized fields for single post - same as get_user_posts but for one post
        fields = (
            "id,message,story,created_time,permalink_url,full_picture,"
            "from,shares,status_type,type"
        )
        url = f"{self.base_url}/{post_id}"
        params = {
            "access_token": self.user_fb_token,
            "fields": fields,
        }
        
        timeout_config = httpx.Timeout(10.0, read=20.0)

        async with httpx.AsyncClient(timeout=timeout_config) as client:
            try:
                response = await client.get(url, params=params)
                response.raise_for_status()
                print(f"Single post response: {response.json()}")
                return response.json()
            except httpx.HTTPStatusError as e:
                print(f"HTTP error fetching single post {post_id}: Status {e.response.status_code} - Response: {e.response.text}")
                print(f"Request URL: {e.request.url}")
                raise
            except httpx.RequestError as e:
                print(f"httpx RequestError fetching single post {post_id}: {type(e).__name__} - {str(e)}")
                print(f"Request URL: {e.request.url}")
                raise
            except Exception as e:
                print(f"Generic error fetching single post {post_id}: {type(e).__name__} - {str(e)}")
                import traceback
                traceback.print_exc()
                raise
    
    async def get_post_comments(
        self, 
        post_id: str, 
        fetch_all: bool = False, 
        limit: int = 3
    ) -> List[Dict[str, Any]]:
        all_comments = []
        fields = "id,message,created_time,from{id,name,picture},attachment"
        
        # Initial URL for the first request
        next_page_url = f"{self.base_url}/{post_id}/comments"
        
        # To get the "last" comments, we use reverse_chronological order.
        params = {
            "access_token": self.user_fb_token,
            "fields": fields,
            "limit": limit,
            "order": "reverse_chronological", 
        }
        
        timeout_config = httpx.Timeout(15.0, read=30.0)

        async with httpx.AsyncClient(timeout=timeout_config) as client:
            # The loop will run as long as there is a next page URL.
            # If fetch_all is False, it will run only once.
            while next_page_url:
                try:
                    # Use params only for the first request. Subsequent requests use the full 'next_page_url'.
                    response = await client.get(next_page_url, params=params if not all_comments else None)
                    response.raise_for_status()
                    
                    json_response = response.json()
                    print(f"Comments response: {json_response}")
                    
                    comments_data = json_response.get("data", [])
                    print(f"Comments data: {comments_data}")
                    if comments_data:
                        all_comments.extend(comments_data)
                    
                    # If we are not fetching all, break the loop after the first successful call.
                    if not fetch_all:
                        break
                        
                    # Get the URL for the next page, if it exists. If not, the loop will terminate.
                    next_page_url = json_response.get("paging", {}).get("next")
                    print(f"Next page URL: {next_page_url}")
                    
                except httpx.HTTPStatusError as e:
                    print(f"HTTP error fetching comments for post {post_id}: Status {e.response.status_code}")
                    break # Stop on error
                except httpx.RequestError as e:
                    print(f"httpx RequestError fetching comments for post {post_id}: {type(e).__name__}")
                    break # Stop on error

        return all_comments