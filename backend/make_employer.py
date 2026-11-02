
from sqlalchemy import select

from app.db.session import SessionLocal
from app.models import User

email = input("Enter your registered test user's email: ").strip().lower()

with SessionLocal() as db:
    user = db.scalar(
        select(User).where(User.email == email)
    )

    if user is None:
        print("User not found. Register this email first.")
    else:
        user.role = "employer"
        db.commit()
        print(f"Success! {user.email} is now an employer.")
