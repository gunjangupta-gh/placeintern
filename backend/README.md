# CMS Backend - NestJS

College Management System Backend built with NestJS and Prisma.

## Features

- Clean Architecture with Domain-Driven Design
- Role-based Access Control (RBAC)
- State Directorate Portal
- Principal Portal
- Faculty Portal
- Student Portal
- Industry Portal
- Internship Management
- Placement Management
- Fee Management
- Academic Management

## Tech Stack

- **Framework**: NestJS
- **Database**: MongoDB with Prisma ORM
- **Authentication**: JWT with Passport
- **Cache**: Redis
- **Queue**: BullMQ
- **File Storage**: Cloudinary
- **Email**: Nodemailer
- **Notifications**: Firebase Cloud Messaging
- **Documentation**: Swagger/OpenAPI

## Project Structure

```
src/
├── core/              # Core functionality (auth, database, cache, etc.)
│   ├── auth/         # Authentication & authorization
│   ├── database/     # Prisma module
│   ├── cache/        # Redis cache
│   ├── queue/        # BullMQ queues
│   └── common/       # Common utilities
├── infrastructure/   # Infrastructure services
│   ├── mail/        # Email service
│   ├── notification/ # Push notifications
│   ├── file-storage/ # File handling
│   ├── cloudinary/  # Image uploads
│   ├── audit/       # Audit logging
│   └── health/      # Health checks
├── api/             # API endpoints by role
│   ├── state/       # State directorate endpoints
│   ├── principal/   # Principal endpoints
│   ├── faculty/     # Faculty endpoints
│   ├── student-portal/
│   ├── industry-portal/
│   └── shared/      # Shared endpoints
├── domain/          # Domain logic
│   ├── institution/
│   ├── student/
│   ├── user/
│   ├── internship/
│   ├── report/
│   ├── feedback/
│   ├── academic/
│   ├── finance/
│   ├── support/
│   ├── placement/
│   └── mentor/
└── bulk/            # Bulk operations
    ├── bulk-user/
    ├── bulk-student/
    └── templates/
```

## Installation

```bash
# Install dependencies
npm install

# Setup environment variables
cp .env.example .env

# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma db push

# Seed database
npm run seed
```

## Running the app

```bash
# Development
npm run start:dev

# Production
npm run build
npm run start:prod
```

## API Documentation

Once the application is running, visit:
- Swagger UI: http://localhost:8000/api/docs

## State Directorate API Routes

All routes require `STATE_DIRECTORATE` role.

- `GET /api/state/dashboard` - Get dashboard overview
- `GET /api/state/institutions` - List all institutions
- `GET /api/state/institutions/:id` - Get institution details
- `POST /api/state/institutions` - Create new institution
- `PUT /api/state/institutions/:id` - Update institution
- `DELETE /api/state/institutions/:id` - Delete institution
- `GET /api/state/principals` - List all principals
- `POST /api/state/principals` - Create new principal
- `GET /api/state/reports/institutions` - Get institutional reports
- `GET /api/state/audit-logs` - View system audit logs

## License

UNLICENSED
