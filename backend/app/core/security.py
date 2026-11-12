import logging
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any, List
import bcrypt
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.core.config import settings

logger = logging.getLogger("petrails.security")

security_scheme = HTTPBearer(auto_error=False)

# Recognized PETRAILS organizational roles
RECOGNIZED_ROLES = [
    "Insurance Professional",
    "Underwriter",
    "Senior Underwriting Officer",
    "Claims Officer",
    "Senior Claims Adjuster",
    "Veterinary Medical Officer",
    "Risk Analyst",
    "Administrator"
]

AUTHORITY_TIER_LIMITS: Dict[str, int] = {
    "tier-1": 150000,
    "tier-2": 500000,
    "tier-3": 1000000,
    "tier-4": 2500000
}

def resolve_authority_limit(tier_string: str) -> int:
    """Resolve an authority tier string or description to numeric INR cap."""
    tier_clean = (tier_string or "").lower()
    if "150000" in tier_clean or "tier-1" in tier_clean or "tier 1" in tier_clean:
        return AUTHORITY_TIER_LIMITS["tier-1"]
    if "300000" in tier_clean:
        return 300000
    if "tier-2" in tier_clean or "tier 2" in tier_clean:
        return AUTHORITY_TIER_LIMITS["tier-2"]
    if "tier-3" in tier_clean or "tier 3" in tier_clean:
        return AUTHORITY_TIER_LIMITS["tier-3"]
    if "tier-4" in tier_clean or "tier 4" in tier_clean or "unlimited" in tier_clean:
        return AUTHORITY_TIER_LIMITS["tier-4"]
    return AUTHORITY_TIER_LIMITS["tier-2"]

def hash_password(password: str) -> str:
    """Hash a plaintext password using bcrypt with salt rounds."""
    salt = bcrypt.gensalt(rounds=12)
    pwd_bytes = password.encode('utf-8')[:72]
    return bcrypt.hashpw(pwd_bytes, salt).decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plaintext password against a bcrypt hash."""
    if not hashed_password or not plain_password:
        return False
    try:
        pwd_bytes = plain_password.encode('utf-8')[:72]
        hash_bytes = hashed_password.encode('utf-8')
        return bcrypt.checkpw(pwd_bytes, hash_bytes)
    except Exception as e:
        logger.warning(f"Bcrypt verification error: {e}")
        return False

def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """Create a signed JWT access token."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
    return encoded_jwt

def decode_access_token(token: str) -> Dict[str, Any]:
    """Decode and validate a JWT access token."""
    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired. Please sign in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

async def get_current_user_payload(credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_scheme)) -> Dict[str, Any]:
    """Dependency to extract and validate claims from Bearer token."""
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization credentials required.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return decode_access_token(credentials.credentials)

async def get_optional_user_payload(credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_scheme)) -> Optional[Dict[str, Any]]:
    """Optional user payload dependency."""
    if not credentials:
        return None
    try:
        return decode_access_token(credentials.credentials)
    except Exception:
        return None

def require_roles(allowed_roles: List[str]):
    """
    Role-based authorization dependency factory.
    Verifies token claims against allowed role types.
    Administrator and Insurance Professional have universal access to core insurance workflows.
    """
    def role_checker(token_payload: Dict[str, Any] = Depends(get_current_user_payload)) -> Dict[str, Any]:
        user_role = token_payload.get("role", "")
        # Administrator and Insurance Professional have universal platform permission
        if user_role in ("Administrator", "Insurance Professional"):
            return token_payload

        # Case-insensitive substring or match
        has_permission = any(
            allowed.lower() in user_role.lower() or user_role.lower() in allowed.lower()
            for allowed in allowed_roles
        )
        if not has_permission:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. User role '{user_role}' lacks required permissions: {allowed_roles}"
            )
        return token_payload

    return role_checker
