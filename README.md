# Rakshak AI

Full-stack AI-powered security monitoring platform.

## Tech Stack
- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS, Mapbox, Supabase
- **Backend**: FastAPI, PostgreSQL, Redis, XGBoost ML, AWS S3 for evidence

## Local Setup
1. Backend: `cd backend && pip install -r requirements.txt && uvicorn main:app --reload`
2. Frontend: `cd frontend && npm install && npm run dev`
3. Docker: `docker-compose up`

## Deployment
- **Frontend**: Vercel (auto-deploy from GitHub)
- **Backend**: Render/Heroku (PostgreSQL + Redis required)

See [Vercel deployment docs](https://nextjs.org/docs/app/building-your-application/deploying) for frontend.
