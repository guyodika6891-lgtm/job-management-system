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

## Deploy to Render and Neon

The root `render.yaml` defines a Render web service for the FastAPI backend and a static site for the React frontend. PostgreSQL is hosted separately on Neon.

1. Create a PostgreSQL project on [Neon](https://neon.tech/) and copy its pooled connection string. Keep the SSL option (`sslmode=require`) in the URL.
2. In [Render](https://render.com/), choose **New → Blueprint**, connect this GitHub repository, and deploy the Blueprint from the `main` branch.
3. When prompted for `DATABASE_URL`, paste the Neon connection string. Render generates `SECRET_KEY` and `ADMIN_REGISTRATION_CODE` for the backend. Keep the registration code private.
4. After the services are created, open the backend service's **Settings** and copy its public URL. Set the frontend service's `VITE_API_URL` environment variable to that URL (for example, `https://jobconnect-api.onrender.com`), then trigger a new deploy of the frontend.
5. Copy the frontend's public URL. In the backend service's environment, set `CORS_ORIGINS` to that exact URL (for example, `https://jobconnect-frontend.onrender.com`), then redeploy the backend.
6. Confirm the backend health check at `<backend-url>/api/health/db`, then open the frontend URL and register the first administrator using the generated registration code.
7. Once the administrator is registered, remove `ADMIN_REGISTRATION_CODE` from the backend environment and redeploy.

The API service runs database migrations at startup. The frontend's static-site rewrite supports client-side routes such as `/login` and `/admin`. Free Render services may spin down after inactivity, so their first request can take longer while they start.

## Main workflows

- Public visitors can browse, search, and filter open jobs by keyword, location, company, and salary.
- Job seekers can register, attach an optional PDF/DOCX resume (maximum 5 MB), apply once per listing, withdraw pending applications, track application status, and receive in-app notifications.
- Employers can register with a company name, create/edit/close/reopen their own listings, review candidate applications and resumes, update application status, and receive in-app notifications.
- Employers can schedule interview invitations from candidate applications. `GET /api/interviews/me` returns future proposed or accepted interviews for the signed-in employer or job seeker.
- Run `alembic upgrade head` after pulling updates to apply schema changes, including employer company profiles, resumes, notifications, and administrator account status.
- `GET /api/health` and `GET /api/health/db` provide service and database health checks.
