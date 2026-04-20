# Protonyx

Internal development repository for Protonyx — a fintech company built around institutional-grade portfolio analytics for retail investors. This repo contains the full stack: backend API, web frontend, and the Vector desktop application.

---

## What We're Building

**Vector** is the first Protonyx product — a downloadable desktop application that gives retail investors access to portfolio analysis tools typically reserved for institutional players. It runs a proprietary internal engine called Lens that generates personalized portfolio insights.

This repository is the development workspace for the entire platform — backend infrastructure, the marketing and account frontend, and the Vector app itself all live here and share a single API.

---

## Repo Structure

```
protonyx/
├── backend/       # Fastify + TypeScript REST API
├── frontend/      # Web dashboard and marketing site
├── app/           # Vector desktop app (PyQt6)
├── scripts/       # Admin and database utility scripts
├── database/      # Local development database
└── .env           # Local secrets — never committed
```

---

## Backend

The backend is a Fastify + TypeScript API handling authentication, data persistence, and business logic for both the web frontend and the Vector desktop app.

**Stack:** Fastify, TypeScript, PostgreSQL, bcrypt, JWT, dotenv

**To run locally:**
```bash
cd backend
npm install
npm run dev
```

Requires a `.env` file in `backend/` with:
```
JWT_SECRET=your-secret-here
DATABASE_URL=your-postgres-url-here
```

---

## Status

This project is in active early development. Frontend and app documentation will be added as those components mature.