# Project API & System Documentation

## 1. Main Modules and Features

### 1.1 Tweets Module

- **Create Tweet**: Post a new tweet.
- **Update Tweet**: Edit tweet content (only author allowed).
- **Delete Tweet**: Delete tweet (only author allowed).
- **Like / Unlike Tweet**: Toggle like on a tweet.
- **Retweet / Remove Retweet**: Retweet or undo retweet.
- **Reply to Tweet**: Comment on a tweet.
- **Quote Tweet**: Quote an existing tweet.
- **Get Tweet Quotes**: View quotes of a specific tweet.
- **Get Tweet Details**: Retrieve full tweet info including likes, replies, and retweets.
- **Timeline**: Fetch tweets from user and followed users with pagination (cursor-based).
- **Search Tweets**: Search by content, hashtags, or users.
- **User Tweets**: Get all tweets by a user.
- **Mentioned Tweets**: Get tweets where user is mentioned.
- **Bookmarks**: Add / remove / get bookmarks.
- **Tweet Summary**: AI-generated summary of a tweet.
- **Get Liked Tweets**: Retrieve tweets liked by a specific user.

**Deviation from original website**: Timeline uses cursor-based pagination instead of offset-based. AI tweet summary is an added feature.

### 1.2 Hashtags & Trends Module

- **Search Hashtags**: Search hashtags by keyword.
- **Get Trends**: Fetch trending hashtags or topics in last 24 hours.
- **Get Tweets for Trend**: List tweets associated with a specific trend.

### 1.3 Users Module

- **User Profile**: Get user profile info by username.
- **Update Profile**: Edit user profile (bio, website, profile photo, etc.).
- **Profile Management**:
  - **Update Profile Picture**: Change profile picture with a new image.
  - **Delete Profile Picture**: Remove profile picture and restore default avatar.
  - **Update Profile Banner**: Change profile banner/cover image.
  - **Delete Profile Banner**: Remove banner and restore default background.
- **Search Users**: Search users by username or screen name.
- **Authentication**:
  - **Register/Sign up**: Create a new user account.
  - **Login**: Authenticate with credentials.
  - **Verify Login**: Verify with email code or 2FA.
  - **Generate Backup Codes**: Create backup login codes.
  - **Verify Backup Codes**: Use backup codes for authentication.
  - **JWT Management**: Token-based authentication system.

### 1.4 User Interactions Module

- **Follow Management**:
  - **Follow User / Send Follow Request**: Follow a user or send a request if their account is protected.
  - **Unfollow User / Cancel Request**: Remove follow or cancel pending follow request.
  - **Accept Follow Request**: Approve someone's request to follow you.
  - **Decline Follow Request / Remove Follower**: Reject a request or remove an existing follower.
  - **Get Followers**: View list of users who follow a specific user.
  - **Get Followings**: View list of users whom a specific user follows.

- **Block Management**:
  - **Block User**: Prevent a user from seeing your content or interacting with you.
  - **Unblock User**: Remove a block on a previously blocked user.
  - **Get Blocked Users**: View list of all users you've blocked.

- **Mute Management**:
  - **Mute User**: Hide a user's content from your timeline without unfollowing them.
  - **Unmute User**: Remove a mute on a previously muted user.
  - **Get Muted Users**: View list of all users you've muted.

### 1.5 Chats Module

- **Chat Management**:
  - **Get Chat Information**: Retrieve detailed information about a specific chat.
  - **Get User Chats**: Retrieve all chats that a user is participating in.
  - **Create New Chat**: Start a new conversation with one or more users.
  - **Delete Chat**: Remove a chat by its ID.
  - **Update Group Chat**: Modify group chat details.
  - **Add Message**: Send a new message in a chat.
  - **Update Message Status**: Mark messages as read/delivered.
  - **Get Unseen Messages Count**: Check how many unread messages exist in a chat.
  - **Get Unseen Chats Count**: Check how many chats have unread messages.

### 1.6 Notifications Module

- **Get Notifications**: Fetch list of all notifications for authenticated user.
- **Get Unseen Count**: Fetch count of unseen notifications.
- **Get Unseen Notifications**: Retrieve only unseen notifications.
- **Create Notification**: Create a new notification for a user.
- **Update Notification Status**: Mark a notification as read.

### 1.7 Media Module

- **Add Media to Tweet**: Attach media to a tweet.
- **Get Media from Tweet**: Retrieve media attached to a specific tweet.

### 1.8 Explore Module

- **Get Notifications Unseen Count**: Retrieve the count of unseen notifications.
- **Get Trending Topics**: Retrieve a list of sports/news/entertainment tweets/trends.
- **Get Personalized Recommendations**: Get a list of personalized tweets/trends based on user preferences and behavior.
  

## 2. Architecture and Design Patterns

- **Backend**:

  - **Pattern**: Layered N Tier Architecture.
  - **Routes**: Define endpoints for each module.
  - **Controllers** handle request/response and validation.
  - **Service Layer** handles business logic.
  - **Repository / Prisma Client** handles database operations.
  - **Error handling middleware** centralizes exceptions.
  - **Dependency Injection** for services (if needed).

## 3. Error Handling, Caching, Monitoring, Logging

- **Error Handling**:
  - Central middleware handles Prisma, Zod, and generic errors.
  - Returns standardized JSON format.
- **Caching**:
  - Optional Redis caching for timeline and user feeds.
  - Cache tweet counts (likes, retweets) to reduce DB load.
- **Monitoring**:
  - Integration with Prometheus / Grafana or Sentry.
- **Logging**:
  - Morgan for requests
  - Winston or Pino for structured logs(TO DO in future).
  - Log levels: info, error, debug.

## 4. Authentication

- JWT for API authentication
- OAuth 2.0 (Google/GitHub) optional
- Refresh tokens for session management
- Protected routes on backend

## 5. Naming Conventions

- **Database tables**: camelCase and plural
- **Prisma Models**: PascalCase and singular
- **DTOs**: PascalCase
- **API endpoints**: kebab-case
- **Controller methods**: camelCase

Example:

- `TweetResponsesSchema`, `CreateTweetDTOSchema`
- `/api/tweets/timeline`

## 6 Third-Party Libraries / Tools

## 6.1 Core Framework & Middleware

- **Express.js** – Main backend framework for building APIs and routing.
- **Helmet** – Security middleware to set HTTP headers.
- **Compression** – Middleware to compress responses for faster delivery.
- **CORS** – Cross-Origin Resource Sharing middleware.
- **Cookie-parser** – Middleware to parse cookies from requests.
- **Morgan** – Logging middleware for HTTP requests.
- **Multer** – Middleware to handle `multipart/form-data` for file uploads (profile images, media in tweets).

## 6.2 Database & ORM

- **Prisma** – Type-safe ORM for database interaction (PostgreSQL in this project).
- **pg** – PostgreSQL driver used by Prisma.

## 6.3 Validation & API Documentation

- **Zod** – Runtime validation and schema definition for requests and responses.
- **@asteasolutions/zod-to-openapi** – Converts Zod schemas to OpenAPI docs.
- **tsoa** – TypeScript OpenAPI generator and route decorator support.
- **swagger-jsdoc / swagger-ui-express** – Auto-generate Swagger documentation and serve UI.

## 6.4 Authentication & Security

- **jsonwebtoken** – JWT handling for authentication.
- **bcryptjs** – Hashing passwords for secure storage.
- **speakeasy** – Two-factor authentication (TOTP) support.

## 6.5 Caching & Real-Time Features

- **ioredis / redis** – Redis client for caching timeline, counts, and notifications.
- **socket.io** – Real-time communication for notifications or live feed updates.

## 6.6 Utilities

- **uuid** – Generate unique IDs.
- **node-fetch** – Make HTTP requests from the backend.
- **qrcode** – Generate QR codes (optional for 2FA or sharing).
- **zxcvbn** – Password strength estimator.
- **fs-extra** – File system utilities (copy, move, remove).

## 6.7 Development Tools

- **nodemon / ts-node-dev** – Automatically restart server on file changes during development.
- **typescript / ts-node** – TypeScript support for backend code.
- **tsconfig-paths** – Resolve module absolute paths imports (@) using `tsconfig.json`.
- **dotenv** – Load environment variables from `.env`.

## 7. GitHub Workflow

- **Branch naming**:
  - `feature/<feature-name>`
  - `bugfix/<bug-name>`
  - `phase<number>`
- **PR Process**:
  1. Create a branch from `main`.
  2. Implement feature and push branch.
  3. Open PR to `main`.
  4. Code review by team lead.
  5. Run CI/CD tests to ensure no direct push to main .
  6. Merge after approval.