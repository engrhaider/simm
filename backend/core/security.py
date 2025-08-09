from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from datetime import datetime, timezone, timedelta
from typing import Optional

from backend.core.config import settings
from backend.schemas.token import TokenPayload

# This scheme will look for a token in the Authorization header, e.g., "Bearer <token>"
# It points to a dummy tokenUrl for now as we are not using username/password form login directly for our app's own auth.
# The actual token generation happens via Facebook OAuth callback.
oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_STR}/auth/token") # Dummy URL

ALGORITHM = "HS256"

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=30) # Default expiry
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.APP_SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def verify_token(token: str, credentials_exception) -> TokenPayload:
    try:
        payload = jwt.decode(token, settings.APP_SECRET_KEY, algorithms=[ALGORITHM])
        token_data = TokenPayload(**payload)
        if token_data.exp is not None and datetime.fromtimestamp(token_data.exp, tz=timezone.utc) < datetime.now(timezone.utc):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token has expired", headers={"WWW-Authenticate": "Bearer"})
        return token_data
    except JWTError as e:
        print(f"JWTError: {e}") # For debugging
        raise credentials_exception
    except Exception as e:
        print(f"Other exception during token decode: {e}") # For debugging
        raise credentials_exception

async def get_current_user(token: str = Depends(oauth2_scheme)) -> TokenPayload:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    token_payload = verify_token(token, credentials_exception)
    # In a real app, you might want to fetch the user from DB here using token_payload.sub (user_id)
    # For now, we just return the payload which contains user info obtained from Facebook login
    if token_payload.sub is None:
        raise credentials_exception # User ID (sub) must be in token
    return token_payload

async def get_current_active_user(current_user: TokenPayload = Depends(get_current_user)) -> TokenPayload:
    # If you have a concept of active/inactive users, you can check it here.
    # For now, if the token is valid and user_id (sub) is present, we consider them active.
    return current_user 