from pydantic import BaseModel, HttpUrl
from typing import Optional, List, Dict, Any
from datetime import datetime

class FacebookPostAttachmentMediaImage(BaseModel):
    height: Optional[int] = None
    src: Optional[HttpUrl] = None
    width: Optional[int] = None

class FacebookPostAttachmentMedia(BaseModel):
    image: Optional[FacebookPostAttachmentMediaImage] = None

class FacebookPostAttachment(BaseModel):
    description: Optional[str] = None
    media: Optional[FacebookPostAttachmentMedia] = None
    title: Optional[str] = None
    type: Optional[str] = None
    url: Optional[HttpUrl] = None # This is often a link to the original content if it's a share
    target: Optional[Dict[str, Any]] = None # For shared posts, target.id and target.url might exist

class FacebookPostFrom(BaseModel):
    id: str
    name: str

class FacebookCommentFrom(BaseModel):
    id: str
    name: str
    picture: Optional[HttpUrl] = None

class FacebookCommentAttachment(BaseModel):
    type: Optional[str] = None
    url: Optional[HttpUrl] = None
    media: Optional[Dict[str, Any]] = None

class FacebookComment(BaseModel):
    id: str
    message: Optional[str] = None
    created_time: datetime
    from_user: Optional[FacebookCommentFrom] = None  # Using from_user since 'from' is a Python keyword
    attachment: Optional[FacebookCommentAttachment] = None
    
    class Config:
        orm_mode = True

class FacebookPost(BaseModel):
    id: str
    message: Optional[str] = None
    story: Optional[str] = None # For life events or other non-message posts
    created_time: datetime
    permalink_url: Optional[HttpUrl] = None
    full_picture: Optional[HttpUrl] = None # URL of the full-sized picture, if any
    attachments: Optional[Dict[str, List[FacebookPostAttachment]]] = None # FB uses attachments.data[]
    # from_user: Optional[FacebookPostFrom] = None # Field name is 'from' in API, which is a keyword
    comments_count: Optional[int] = 0 # Placeholder, actual comments need another call
    likes_count: Optional[int] = 0 # Placeholder

    class Config:
        orm_mode = True # For SQLAlchemy or other ORM compatibility if needed later
        # Pydantic V2 uses model_config, Pydantic V1 uses Config class like this.
        # We are using Pydantic V1 style for now as it's common with FastAPI initial setup.
        # For Pydantic V2, this would be:
        # from pydantic import ConfigDict
        # model_config = ConfigDict(from_attributes=True)

class FacebookPostsResponse(BaseModel):
    data: List[FacebookPost]
    # Add paging information if needed later
    # paging: Optional[Dict[str, Any]] = None

class FacebookCommentsResponse(BaseModel):
    data: List[FacebookComment] 