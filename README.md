# JobConnect

A job management application with a React/Vite frontend and FastAPI, SQLAlchemy, and PostgreSQL backend. Job seekers can browse and apply for open roles; employers can publish and edit listings, review applicants, and update application statuses.

## Requirements

- Python 3.10 or newer
- Node.js 20.19+ or 22.12+
- PostgreSQL

## Backend setup (Windows PowerShell)

From the project directory:

```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
```

Set `DATABASE_URL`, a long random `SECRET_KEY`, and a private random `ADMIN_REGISTRATION_CODE` in `backend\.env`. Generate a setup code with:

```powershell
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

Then run migrations and start the API:

```powershell
alembic upgrade head
uvicorn app.main:app --reload
```

The API and interactive OpenAPI docs are available at `http://127.0.0.1:8000` and `http://127.0.0.1:8000/docs`.

Job seekers and employers can register their own accounts from `/register`. After registration, the system administrator manages user accounts, including role changes, disabling/reactivating accounts, and deletion, from the `/admin` workspace.

## System administration

Apply the latest database migrations before starting the API:

```powershell
cd backend
alembic upgrade head
```

The first system administrator can register through `/register` by selecting **System administrator** and entering the private `ADMIN_REGISTRATION_CODE` configured in `backend\.env`. Only one administrator account is allowed. Job seekers and employers may continue to register normally; the administrator manages their accounts after registration. Keep the setup code private and remove it from the environment after the administrator has registered.

After registration, sign in with the administrator account and open `/admin`. The administrator workspace provides platform overview and system status, user creation and management, job moderation, and application review. Admins can create job-seeker and employer accounts. User and job deletion is permanent and removes associated records. `python make_admin.py` remains available as a backend-only recovery/setup command and also refuses to create a second administrator.

## Frontend setup

In another terminal:

```powershell
cd frontend
npm install
npm run dev
```

The frontend defaults to the API at `http://127.0.0.1:8000`. Set `VITE_API_URL` in `frontend\.env` to override it.

## Main workflows

- Public visitors can browse, search, and filter open jobs by keyword, location, company, and salary.
- Job seekers can register, attach an optional PDF/DOCX resume (maximum 5 MB), apply once per listing, withdraw pending applications, track application status, and receive in-app notifications.
- Employers can register with a company name, create/edit/close/reopen their own listings, review candidate applications and resumes, update application status, and receive in-app notifications.
- Employers can schedule interview invitations from candidate applications. `GET /api/interviews/me` returns future proposed or accepted interviews for the signed-in employer or job seeker.
- Run `alembic upgrade head` after pulling updates to apply schema changes, including employer company profiles, resumes, notifications, and administrator account status.
- `GET /api/health` and `GET /api/health/db` provide service and database health checks.
