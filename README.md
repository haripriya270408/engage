# Engage - Sales Execution Platform

Engage is a powerful, high-velocity sales execution platform designed to eliminate administrative overhead with real-time bi-directional Salesforce synchronization.

## Prerequisites

Before running the project locally, ensure you have the following installed:
- Node.js (v18 or higher recommended)
- npm or yarn
- Supabase account (for database and authentication)
- Salesforce Developer Edition (for CRM integration)

## Environment Setup

You need to create `.env.local` for the frontend and `.env` for the backend.

### Backend (`/backend/.env`)
Create a `.env` file in the `backend` directory with the following variables:
```env
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# JWT config
JWT_SECRET=your_jwt_secret

# Salesforce OAuth App Details
SALESFORCE_CLIENT_ID=your_sf_client_id
SALESFORCE_CLIENT_SECRET=your_sf_client_secret
SALESFORCE_REDIRECT_URI=http://localhost:3000/api/salesforce/callback
SALESFORCE_LOGIN_URL=https://login.salesforce.com
FRONTEND_URL=http://localhost:3001
```

### Frontend (`/frontend/.env.local`)
Create a `.env.local` file in the `frontend` directory:
```env
NEXT_PUBLIC_API_URL=http://localhost:3000/api
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Running the Application Locally

The project is structured as a monorepo with separate `frontend` and `backend` directories. You will need two terminal windows to run both simultaneously.

### 1. Start the Backend API
Open a terminal, navigate to the `backend` directory, install dependencies, and start the development server:
```bash
cd backend
npm install
npm run start:dev
```
The backend will run on `http://localhost:3000`.

### 2. Start the Frontend Application
Open a second terminal, navigate to the `frontend` directory, install dependencies, and start the development server:
```bash
cd frontend
npm install
npm run dev
```
The frontend will run on `http://localhost:3001`.

## Database Schema
To set up the initial Supabase database, run the SQL migrations or manually create the tables defined in your database ER diagram. Key tables include:
- `users`
- `tasks`
- `task_notes`
- `task_activities`
- `salesforce_connections`
- `manager_rep_assignments`

## Logging In
Once the servers are running, navigate to `http://localhost:3001` in your browser.
By default, the application comes with a hardcoded admin login for setup:
- **Email**: `admin@relanto.ai`
- **Password**: `admin123`

You can use the admin account to approve new users signing up for the platform.
