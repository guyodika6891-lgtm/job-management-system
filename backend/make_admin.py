from sqlalchemy import select

from app.db.session import SessionLocal
from app.models import User

email = input("Enter the registered account email to promote to administrator: ").strip().lower()

with SessionLocal() as db:
    user = db.scalar(select(User).where(User.email == email))
    if user is None:
        print("User not found. Register the account first.")
    else:
        user.role = "admin"
        user.is_active = True
        db.commit()
        print(f"Success! {user.email} is now an active administrator.")
