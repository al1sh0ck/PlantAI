from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models.user import User
from app.core.security import hash_password, verify_password, create_access_token, create_refresh_token, decode_token
from app.schemas.auth import RegisterRequest, LoginRequest, TokenResponse


class AuthService:

    def register(self, db: Session, data: RegisterRequest) -> User:
        if db.query(User).filter(User.email == data.email).first():
            raise HTTPException(status_code=400, detail="Email already registered")
        if db.query(User).filter(User.username == data.username).first():
            raise HTTPException(status_code=400, detail="Username already taken")
        if len(data.password) < 8:
            raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

        user = User(
            email=data.email,
            username=data.username,
            hashed_pw=hash_password(data.password),
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return user

    def login(self, db: Session, data: LoginRequest) -> TokenResponse:
        user = db.query(User).filter(User.email == data.email).first()
        if not user or not verify_password(data.password, user.hashed_pw):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password",
            )
        if not user.is_active:
            raise HTTPException(status_code=403, detail="Account is inactive")

        token_data = {"sub": str(user.id), "username": user.username}
        return TokenResponse(
            access_token=create_access_token(token_data),
            refresh_token=create_refresh_token(token_data),
        )

    def refresh(self, db: Session, refresh_token: str) -> TokenResponse:
        payload = decode_token(refresh_token)
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Not a refresh token")
        user = db.query(User).filter(User.id == int(payload["sub"])).first()
        if not user or not user.is_active:
            raise HTTPException(status_code=401, detail="User not found")

        token_data = {"sub": str(user.id), "username": user.username}
        return TokenResponse(
            access_token=create_access_token(token_data),
            refresh_token=create_refresh_token(token_data),
        )


auth_service = AuthService()
