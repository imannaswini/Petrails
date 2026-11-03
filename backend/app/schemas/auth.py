from typing import Optional
from pydantic import BaseModel, Field

class LoginRequest(BaseModel):
    email: str = Field(..., description="User corporate email address")
    password: Optional[str] = Field(default=None, description="Plaintext user password")

class RegisterRequest(BaseModel):
    organization: str = Field(..., description="Insurance carrier or veterinary organization")
    fullName: str = Field(..., description="Full legal name of the officer")
    workEmail: str = Field(..., description="Corporate email address")
    role: str = Field(..., description="Designated role (e.g. Underwriter, Claims Officer, Risk Analyst)")
    authorityTier: str = Field(default="tier-2", description="Discretionary underwriting authority tier")
    password: Optional[str] = Field(default="Petrails@2026", description="User password")

class UserResponse(BaseModel):
    id: str
    fullName: str
    email: str
    role: str
    authorityLimitInr: int
    organization: str

class AuthResponse(BaseModel):
    token: str
    user: UserResponse
