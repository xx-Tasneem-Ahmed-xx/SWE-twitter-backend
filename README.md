# Twitter Clone - Backend API

A robust, scalable backend API for a Twitter-like social media platform built with Node.js, TypeScript, and PostgreSQL. Features include real-time messaging, personalized feeds, OAuth authentication, and advanced content recommendation algorithms.

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Environment Configuration](#environment-configuration)
- [Running the Application](#running-the-application)
- [API Documentation](#api-documentation)
- [Database Management](#database-management)
- [Testing](#testing)
- [Project Structure](#project-structure)
- [Contributing](#contributing)

## Features

### Core Functionality

- **User Management**

  - User registration and authentication with JWT
  - OAuth 2.0 integration (Google, GitHub)
  - Two-factor authentication (2FA) with TOTP
  - Profile management (bio, profile picture, cover photo)
  - Account privacy controls (protected accounts)
  - Date of birth visibility settings

- **Tweet Operations**

  - Create, read, update, delete tweets
  - Thread support (replies)
  - Quote tweets and retweets
  - Media attachments (images, videos)
  - Tweet categorization with AI
  - Hashtag extraction and trending topics
  - Reply controls (everyone, followers, mentioned users)

- **Social Interactions**

  - Follow/unfollow users with follow requests
  - Like, bookmark, and retweet functionality
  - Mute and block users
  - User mentions in tweets
  - Not interested and spam reporting

- **Timeline & Explore**

  - Personalized "For You" feed with ML-based recommendations
  - Following timeline
  - Explore page with trending content
  - User search with fuzzy matching
  - Hashtag search and discovery
  - Category-based content filtering

- **Direct Messaging**

  - Real-time chat with Socket.IO
  - One-on-one messaging
  - Media sharing in messages
  - Unseen message count tracking
  - Message read receipts

- **Notifications**

  - Real-time push notifications
  - In-app notification center
  - Unseen notification count
  - Notification types: likes, retweets, follows, mentions, replies
  - Firebase Cloud Messaging (FCM) integration

- **Advanced Features**
  - AI-powered tweet summarization (Groq API)
  - Content scoring algorithm for feed ranking
  - User reputation system
  - Tweet category classification
  - Email notifications for security events
  - Background job processing with BullMQ

## Tech Stack

### Core Technologies

- **Runtime**: Node.js (v22+)
- **Language**: TypeScript
- **Framework**: Express.js
- **Database**: PostgreSQL
- **ORM**: Prisma
- **Cache**: Redis
- **Real-time**: Socket.IO

### Authentication & Security

- **JWT**: jsonwebtoken
- **OAuth**: Google & GitHub OAuth 2.0
- **2FA**: Speakeasy (TOTP)
- **Password Hashing**: bcrypt
- **Security Headers**: Helmet
- **CORS**: cors

### Cloud Services

- **File Storage**: AWS S3
- **Secrets Management**: AWS Secrets Manager
- **Push Notifications**: Firebase Cloud Messaging
- **AI Services**: Groq API (LLaMA models)

### Background Processing

- **Job Queue**: BullMQ
- **Email**: Nodemailer
- **Cron Jobs**: Node-cron patterns

### Development & Testing

- **Testing**: Jest
- **API Documentation**: Swagger/OpenAPI
- **Code Quality**: ESLint, Prettier
- **CI/CD**: Jenkins
- **Monitoring**: SonarQube

### Additional Libraries

- **Text Processing**: twitter-text

## Architecture

```
┌─────────────────┐
│   Client Apps   │
│ (Web, Mobile)   │
└────────┬────────┘
         │
    ┌────▼────────────┐
    │   API Gateway   │
    │   (Express)     │
    └────┬────────────┘
         │
    ┌────▼────────────────────────────────┐
    │         Middleware Layer            │
    │  Auth │ Validation │ Error Handler  │
    └────┬────────────────────────────────┘
         │
    ┌────▼──────────────────────┐
    │   Business Logic Layer    │
    │   (Services & Controllers)│
    └────┬──────────────────────┘
         │
    ┌────▼─────────┬──────────┬──────────┐
    │  PostgreSQL  │  Redis   │  Socket  │
    │   (Prisma)   │  (Cache) │   (IO)   │
    └──────────────┴──────────┴──────────┘
```

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v22.20.0 or higher) - [Download](https://nodejs.org/)
- **npm** (v10.9.3 or higher) - Comes with Node.js
- **PostgreSQL** (v16.10 or higher) - [Download](https://www.postgresql.org/download/)
- **Redis** (v7.0.15 or higher) - [Download](https://redis.io/download)

### Optional but Recommended

- **Docker** - For containerized PostgreSQL and Redis
- **Postman** or **Insomnia** - For API testing

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/CUFE-Software-Engineering-Project/SWE-twitter-backend.git
cd SWE-twitter-backend
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up PostgreSQL

#### Option A: Using Docker (Recommended)

```bash
# Start PostgreSQL container
docker run --name twitter-postgres \
  -e POSTGRES_USER=username \
  -e POSTGRES_PASSWORD=password\
  -e POSTGRES_DB=dbName \
  -p 5432:5432 \
  -d postgres:14
```

#### Option B: Local Installation

Create two databases:

```sql
CREATE DATABASE twitter_dev;
CREATE DATABASE twitter_shadow; -- For migrations
```

### 4. Set Up Redis

#### Option A: Using Docker (Recommended)

```bash
# Start Redis container
docker run --name twitter-redis \
  -p 6379:6379 \
  -d redis:7
```

#### Option B: Local Installation

Start Redis server:

```bash
sudo apt install redis-server redis-tools -y
sudo systemctl start redis-server
# make sure its installed
redis-cli ping
```

### 5. Configure Environment Variables

Copy the example environment file and update it with your credentials:

```bash
cp .env.example .env
```

Edit `.env` file with your configuration (see [Environment Configuration](#-environment-configuration))

### 6. Set Up Database Schema

```bash
# Generate Prisma Client
npx prisma generate

# Run migrations
npx prisma migrate deploy --config prisma/prisma.config.ts

# Seed database with sample data (optional)
npm run seed
```

### 7. Build the Application

```bash
npm run build
```

## Environment Configuration

Create a `.env` file in the root directory. See `.env.example` for a complete template with all required variables.

## Running the Server

### Development Mode (with hot reload)

```bash
npm run dev
```

The server will start on `http://localhost:3000` (or your configured PORT)

### Production Mode

```bash
# Build the application
npm run build

# Start the server
npm start
```

### Using PM2 (Recommended for Production)

```bash
# Install PM2 globally
npm install -g pm2

# Start with PM2 the server and workers
pm2 start ecosystem.config.cjs

# To start a certain worker
pm2 start ecosystem.config.cjs --only <workername>

# View logs
pm2 logs

# Stop all processes
pm2 stop all
```

## API Documentation

### Swagger UI

Once the application is running, access the interactive API documentation at:

```
http://localhost:3000/api-docs
```

The Swagger UI provides:

- Complete API endpoint reference
- Request/response schemas
- Interactive API testing
- Authentication examples

### API Base URL

```
http://localhost:3000/api
```

## Database Management

### Prisma Commands for version 7

```bash
# Generate Prisma Client after schema changes
npx prisma generate

# Create a new migration
npx prisma migrate dev --name migration_name --config prisma/prisma.config.ts

# Apply migrations to production
npx prisma migrate deploy --config prisma/prisma.config.ts

# Open Prisma Studio (Database GUI)
npx prisma studio --config prisma/prisma.config.ts

# Reset database (⚠️ Deletes all data)
npx prisma migrate reset --config prisma/prisma.config.ts

# Seed database
npm run seed
```

### Database Seeding

The project includes comprehensive seed scripts:

```bash
npx ts-node prisma/seedMediaUsers.ts    # Users with media
npx ts-node prisma/seedCategroies.ts    # Tweet categories
npx ts-node prisma/seedTweets.ts        # Sample tweets
```

## Testing

### Run Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Test Coverage

Coverage reports are generated in the `coverage/` directory. View HTML report:

```bash
open coverage/lcov-report/index.html
```

## Project Structure

```
SWE-twitter-backend/
├── prisma/                      # Database schema and migrations
│   ├── schema.prisma           # Prisma schema definition
│   ├── migrations/             # Migration history
│   ├── seed.ts                 # Database seeding
│   └── *.ts                    # Specialized seed scripts
├── src/
│   ├── api/                    # API layer
│   │   ├── controllers/        # Route controllers
│   │   ├── middlewares/        # Express middlewares
│   │   ├── routes/             # Route definitions
│   │   └── validators/         # Request validation
│   ├── application/            # Business logic
│   │   ├── dtos/              # Data Transfer Objects
│   │   ├── services/          # Business services
│   │   └── utils/             # Utility functions
│   ├── background/            # Background jobs
│   │   ├── jobs/              # Job definitions
│   │   └── workers/           # BullMQ workers
│   ├── config/                # Configuration files
│   ├── docs/                  # API documentation
│   ├── errors/                # Custom error classes
│   ├── types/                 # TypeScript type definitions
│   ├── app.ts                 # Express app setup
│   ├── database.ts            # Database connection
│   └── index.ts               # Application entry point
├── coverage/                  # Test coverage reports
├── dist/                      # Compiled JavaScript (generated)
├── .env                       # Environment variables (local)
├── .env.example              # Environment template
├── ecosystem.config.cjs      # PM2 configuration
├── jest.config.ts            # Jest configuration
├── package.json              # Dependencies
├── tsconfig.json             # TypeScript configuration
└── README.md                 # This file
```

## Security Features

- **JWT Authentication**: Secure token-based authentication
- **Password Hashing**: bcrypt with salt rounds
- **OAuth 2.0**: Secure third-party authentication
- **2FA/TOTP**: Time-based one-time passwords
- **Helmet**: Security headers
- **CORS**: Cross-origin resource sharing controls
- **Rate Limiting**: API rate limiting (configurable)
- **Input Validation**: Zod and express-validator
- **SQL Injection Protection**: Prisma parameterized queries
- **XSS Protection**: Input sanitization

## Performance Optimizations

- **Redis Caching**: Frequently accessed data caching
- **Database Indexing**: Optimized queries with strategic indexes
- **Connection Pooling**: PostgreSQL connection management
- **Lazy Loading**: Efficient data fetching
- **Background Jobs**: Async processing with BullMQ
- **Compression**: Response compression middleware

## Monitoring & Logging

- **Morgan**: HTTP request logging
- **Winston**: Application logging (configurable)
- **SonarQube**: Code quality analysis
- **Jest Coverage**: Test coverage reporting

## Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request
6. Make sure it passes sonarQube Quality gate and other workflows

### Code Style

- Follow existing code style
- Run `npm run lint` before committing
- Write tests for new features
- Update documentation as needed

## License

This project is licensed under the MIT License – see the [LICENSE](LICENSE) file for details.

## Team

Software Engineering Project - Cairo University Faculty of Engineering Computer Department
