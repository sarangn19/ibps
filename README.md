# IBPS Coaching - Practice-First Learning Platform

A web application for exam coaching focused on practice-based learning with detailed analytics for both students and coaches.

## Tech Stack

- **Frontend:** React + TypeScript, Tailwind CSS, Vite
- **Backend:** Node.js + Express
- **Database:** PostgreSQL
- **Auth:** JWT-based authentication

## Project Structure

```
ibps/
├── backend/
│   ├── src/
│   │   ├── controllers/     # API route handlers
│   │   ├── database/        # Database schema and connection
│   │   ├── middleware/     # Auth middleware
│   │   ├── routes/         # API routes
│   │   └── server.js       # Express server entry point
│   ├── package.json
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── context/        # React context (Auth)
│   │   ├── pages/          # Page components
│   │   ├── types/          # TypeScript types
│   │   ├── utils/          # API client
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── package.json
│   └── vite.config.ts
└── README.md
```

## Setup Instructions

### Prerequisites

- Node.js (v18 or higher)
- PostgreSQL (v12 or higher)

### Backend Setup

1. Navigate to backend directory:
```bash
cd backend
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env` file:
```bash
cp .env.example .env
```

4. Edit `.env` with your database credentials:
```
PORT=5000
DATABASE_URL=postgresql://username:password@localhost:5432/ibps_coaching
JWT_SECRET=your_jwt_secret_key_here
JWT_EXPIRES_IN=7d
NODE_ENV=development
```

5. Create PostgreSQL database:
```sql
CREATE DATABASE ibps_coaching;
```

6. Run database migrations:
```bash
npm run migrate
```

7. Start backend server:
```bash
npm run dev
```

Backend will run on `http://localhost:5000`

### Frontend Setup

1. Navigate to frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Start frontend dev server:
```bash
npm run dev
```

Frontend will run on `http://localhost:3000`

## Phase 1 Features (Current Implementation)

### Student Features
- **Authentication:** Student registration and login with JWT
- **Question Bank:** Browse questions by subject, topic, difficulty
- **Test Taking:** Timed tests with auto-submit, question navigation, mark for review
- **Instant Results:** Score, accuracy, section-wise breakdown, explanations
- **Error Tagging:** Post-test analysis (concept gap, silly mistake, guessed, time out)

### API Endpoints

#### Auth
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user

#### Questions
- `GET /api/questions` - Get questions (with filters)
- `GET /api/questions/:id` - Get single question
- `POST /api/questions` - Create question (admin)

#### Tests
- `GET /api/tests` - Get tests (with filters)
- `GET /api/tests/:id` - Get single test with questions
- `POST /api/tests` - Create test (admin)

#### Attempts
- `POST /api/attempts/start` - Start a test attempt
- `POST /api/attempts/response` - Save question response
- `POST /api/attempts/submit` - Submit completed test
- `GET /api/attempts/:attempt_id/results` - Get attempt results
- `PUT /api/attempts/error-tag` - Update error tag for response

## Database Schema

### Core Tables
- `users` - Student and admin accounts
- `batches` - Student batches/groups
- `questions` - Question bank with metadata
- `tests` - Test configurations
- `attempts` - Student test attempts
- `question_responses` - Individual question responses
- `activity_logs` - User activity tracking
- `student_topic_mastery` - Real-time expertise tracking (for Phase 2)

## Next Steps (Phase 2)

Before starting Phase 2 (Real-Time Expertise Mapping), please confirm if Phase 1 is working as expected.

Phase 2 will include:
- Real-time mastery score calculation
- Student expertise map (heatmap visualization)
- Weak topic recommendations
- Subtopic classification (weak/developing/strong)
