# CMS Frontend

React frontend for the Content Management System with role-based dashboards.

## Tech Stack

- React 19
- React Router DOM v7
- Redux Toolkit with Redux Persist
- Ant Design v5
- Tailwind CSS v4
- Vite
- Axios
- Framer Motion
- Chart.js & Recharts
- Day.js

## Features

- Role-based authentication (State, Principal, Faculty, Student, Industry)
- Redux state management with persistence
- Smart data fetching with custom hooks
- Responsive layout with Ant Design
- Tailwind CSS for styling
- Notifications system
- Protected routes
- Error boundaries

## Installation

```bash
npm install
```

## Development

```bash
npm run dev
```

## Build

```bash
npm run build
```

## Environment Variables

Copy `.env.example` to `.env` and update the values:

```
VITE_API_BASE_URL=http://localhost:8000/api
VITE_MINIO_ENDPOINT=http://localhost:9000
VITE_MINIO_BUCKET=cms-uploads
```

## Project Structure

```
src/
├── app/              # App configuration (store, routes, providers)
├── features/         # Feature-based modules (auth, state, principal, etc.)
├── components/       # Shared components
├── hooks/            # Custom hooks
├── services/         # API services
└── utils/            # Utility functions
```

## Roles

- **State**: Manage institutions
- **Principal**: Manage students and staff
- **Faculty**: Manage courses and assignments
- **Student**: View profile and enrollments
- **Industry**: Manage internships
