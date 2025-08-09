from pydantic import BaseModel
from typing import Optional

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenPayload(BaseModel):
    sub: Optional[str] = None # Subject (usually user ID)
    exp: Optional[int] = None # Expiry time
    # You can add other fields that you put into the JWT payload
    name: Optional[str] = None
    email: Optional[str] = None
    picture: Optional[str] = None
    fb_access_token: Optional[str] = None # Storing the Facebook access token

class UserAuth(BaseModel):
    id: str
    name: Optional[str] = None
    email: Optional[str] = None
    picture_url: Optional[str] = None 