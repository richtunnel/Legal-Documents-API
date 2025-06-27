# Legal Documents API

A Node.js Express API for managing legal documents, with user authentication, API key support, and document upload/download functionality. The project uses TypeScript, SQLite for data storage, Redis for session management, and Multer for file uploads.

## Table of Contents

- [Legal Documents API](#legal-documents-api)
  - [Table of Contents](#table-of-contents)
  - [Project Overview](#project-overview)
  - [Features](#features)
  - [Tech Stack](#tech-stack)
  - [Prerequisites](#prerequisites)
  - [Environment Variables](#environment-variables)
  - [Database Schema](#database-schema)
  - [API Endpoints](#api-endpoints)
    - [Authentication Routes](#authentication-routes)
  - [Testing with Postman](#testing-with-postman)

## Project Overview

The Legal Documents API allows users to register, log in, generate API keys, and manage legal documents (upload and retrieve PDFs). It supports two authentication methods: JWT tokens (via `/login`) and API keys (generated via `/register`). The API is secured with `authMiddleware`, which validates requests using either a JWT in the `Authorization` header or an API key in the `x-api-key` header.

- **Base URL**: `http://localhost:3000`
- **API Version**: `/api/v1`
- **Project Location**: `/Users/rstokes/Sites/Milestone`

## Features

- User registration and login with JWT authentication.
- API key generation and validation for secure access.
- Document upload (PDFs) with Multer memory storage.
- Document retrieval (list all documents or fetch a single PDF).
- Session management with Redis.
- Logging with Winston for debugging and error tracking.
- Swagger UI for API documentation (`/api-docs`).
- Security middleware (Helmet, compression).

## Tech Stack

- **Node.js**: v20.18.3
- **TypeScript**: For type-safe JavaScript.
- **Express**: Web framework for routing and middleware.
- **SQLite**: Lightweight database for storing users, API keys, and documents.
- **Redis**: Session storage.
- **Multer**: File upload handling.
- **JWT**: Token-based authentication.
- **Bcrypt**: Password hashing.
- **Winston**: Logging.
- **Swagger UI**: API documentation.
- **Helmet**: Security headers.
- **Compression**: Response compression.

## Prerequisites

- **Node.js**: v20.18.3
- **Redis**: Running on `localhost:6379`
- **SQLite**: Install `sqlite3` CLI for database management
- **Postman**: For testing API endpoints
- **NPM**: For dependency installation

Install dependencies:

```bash
cd /Users/rstokes/Sites/Milestone
npm install
```

1. **Install Dependencies**:

   ```bash
   npm install
   ```

2. **Set Up Environment Variables**: Create or update `/Users/rstokes/Sites/Milestone/.env`:

   ```plaintext
   NODE_ENV=development
   PORT=3000
   JWT_SECRET=aB5fP9xZ2jR8cU4qW1tY7mD6hE3vS0874383fkdjfkkdfd
   SESSION_SECRET=yDKFJDKJFKEJKAKJDKJFKDJKFJKDJIF75784884848
   REDIS_URL=redis://localhost:6379
   DATABASE_URL=./src/db/legal_documents.db
   BLOB_STORAGE_PATH=./storage
   ```

   - Ensure `JWT_SECRET` and `SESSION_SECRET` are at least 32 characters.
   - `DATABASE_URL` points to `src/db/legal_documents.db`.

3. **Start Redis**:

   ```bash
   redis-server
   ```

   Verify: `redis-cli ping` (should return `PONG`).

4. **Initialize Database**: Create `src/db/legal_documents.db`:

   ```bash
   mkdir -p /Users/rstokes/Sites/Milestone/src/db
   sqlite3 /Users/rstokes/Sites/Milestone/src/db/legal_documents.db
   ```

   Run:

   ```sql
   CREATE TABLE users (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     email TEXT UNIQUE NOT NULL,
     password TEXT NOT NULL,
     role TEXT NOT NULL DEFAULT 'user'
   );
   CREATE TABLE api_keys (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     user_id INTEGER NOT NULL,
     api_key TEXT UNIQUE NOT NULL,
     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
     FOREIGN KEY (user_id) REFERENCES users(id)
   );
   CREATE TABLE documents (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     user_id INTEGER NOT NULL,
     title TEXT NOT NULL,
     blob_path TEXT NOT NULL,
     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
     FOREIGN KEY (user_id) REFERENCES users(id)
   );
   CREATE TABLE webhooks (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     user_id INTEGER NOT NULL,
     url TEXT NOT NULL,
     event_type TEXT NOT NULL,
     FOREIGN KEY (user_id) REFERENCES users(id)
   );
   INSERT INTO users (email, password, role) VALUES ('test@example.com', 'dummy_password', 'user');
   INSERT INTO api_keys (user_id, api_key, created_at) VALUES (1, 'abc123xyz4567890', '2025-06-27T09:11:00.000Z');
   INSERT INTO documents (user_id, title, blob_path, created_at) VALUES (1, 'Test Document', './storage/test.pdf', '2025-06-27T09:11:00.000Z');
   ```

5. **Create Storage Directory**:

   ```bash
   mkdir -p /Users/rstokes/Sites/Milestone/storage
   touch /Users/rstokes/Sites/Milestone/storage/test.pdf
   ```

6. **Compile TypeScript**:

   ```bash
   npm run build
   ```

## Environment Variables

- `NODE_ENV`: `development` or `production`
- `PORT`: Server port (default: `3000`)
- `JWT_SECRET`: Secret for JWT signing (min 32 chars)
- `SESSION_SECRET`: Secret for session management (min 32 chars)
- `REDIS_URL`: Redis connection URL (e.g., `redis://localhost:6379`)
- `DATABASE_URL`: Path to SQLite database (`./src/db/legal_documents.db`)
- `BLOB_STORAGE_PATH`: Path for uploaded files (`./storage`)

## Database Schema

- **users**:
  - `id`: Integer, primary key, auto-increment
  - `email`: Text, unique, not null
  - `password`: Text, hashed, not null
  - `role`: Text, default 'user'
- **api_keys**:
  - `id`: Integer, primary key, auto-increment
  - `user_id`: Integer, foreign key to `users(id)`
  - `api_key`: Text, unique, not null
  - `created_at`: Timestamp, default current
- **documents**:
  - `id`: Integer, primary key, auto-increment
  - `user_id`: Integer, foreign key to `users(id)`
  - `title`: Text, not null
  - `blob_path`: Text, file path, not null
  - `created_at`: Timestamp, default current
- **webhooks**:
  - `id`: Integer, primary key, auto-increment
  - `user_id`: Integer, foreign key to `users(id)`
  - `url`: Text, not null
  - `event_type`: Text, not null

## API Endpoints

### Authentication Routes

- **POST /api/v1/auth/login**

  - Authenticate user and return JWT.
  - Body:

    ```json
    {
      "email": "test@example.com",
      "password": "password123"
    }
    ```

  - Response: `200 OK`

````json
    {
      "token": "<jwt-token>",
      "user": { "id": 1, "email": "test@example.com", "role": "user" }
    }
    ```

### Document Routes
- **POST /api/v1/documents**
  - Upload a PDF document.
  - Headers: `x-api-key: <api-key>` or `Authorization: Bearer <jwt-token>`
  - Body: Form-data with `file` (PDF) and `title` (string)
  - Response: `200 OK`
    ```json
    { "message": "Document uploaded successfully", "documentId": 1 }
    ```
  - Errors: `400 Bad Request`, `401 Unauthorized`

- **GET /api/v1/documents**
  - Retrieve all documents for the authenticated user.
  - Headers: `x-api-key: <api-key>` or `Authorization: Bearer <jwt-token>`
  - Response: `200 OK`
    ```json
    [
      {
        "id": 1,
        "user_id": 1,
        "title": "Test Document",
        "blob_path": "./storage/test.pdf",
        "created_at": "2025-06-27T09:11:00.000Z"
      }
    ]
    ```
  - Errors: `400 Bad Request`, `401 Unauthorized`

- **GET /api/v1/documents/:id**
  - Retrieve a single PDF document.
  - Headers: `x-api-key: <api-key>` or `Authorization: Bearer <jwt-token>`
  - Response: `200 OK`, PDF file (Content-Type: `application/pdf`)
  - Errors: `400 Bad Request` (Invalid ID), `401 Unauthorized`, `404 Not Found`

## Authentication
- **JWT**: Obtain via `/api/v1/auth/login`. Use in `Authorization: Bearer <jwt-token>` header.
- **API Key**: Obtain via `/api/v1/auth/register`. Use in `x-api-key: <api-key>` header (e.g., `x-api-key: abc123xyz4567890`).
- All document routes require authentication via JWT or API key.

## Running the Application
1. **Compile TypeScript**:
   ```bash
   cd /Users/rstokes/Sites/Milestone
   npm run build
````

2. **Start Server**:

   ```bash
   npm start
   ```

   Server runs at `http://localhost:3000`.

3. **View Logs**:
   - Application logs: `logs/combined.log`
   - Error logs: `logs/error.log`

## Testing with Postman

1. **Get Documents**:

   - Method: GET
   - URL: `http://localhost:3000/api/v1/documents`
   - Headers: `x-api-key: <api-key>`
   - Tests:

     ```javascript
     pm.test("Status is 200", () => pm.response.to.have.status(200));
     pm.test("Response is array", () => {
       pm.expect(pm.response.json()).to.be.an("array");
     });
     if (pm.response.json().length > 0) {
       pm.environment.set("documentId", pm.response.json()[0].id);
     }
     ```

2. **Verify API Key**:
   - Method: POST
   - URL: `http://localhost:3000/api/v1/verify-api-key`
   - Body: `raw`, JSON

````json
    { "apiKey": "abc123xyz4567890" }
    ```
  - Expected: `{ "userId": 1 }`

## Troubleshooting
- **401 Unauthorized ("Invalid token or API key")**:
 - Check `api_keys`:
   ```bash
   sqlite3 /Users/rstokes/Sites/Milestone/src/db/legal_documents.db "SELECT * FROM api_keys;"
   ```
 - Insert test key:
   ```sql
   INSERT INTO api_keys (user_id, api_key, created_at) VALUES (1, 'abc123xyz4567890', '2025-06-27T09:11:00.000Z');
   ```
 - Verify database path in `logs/combined.log`:
   ```
   {"level":"info","message":"Resolved database path: /Users/rstokes/Sites/Milestone/src/db/legal_documents.db"}
   ```
 - Test `/verify-api-key` endpoint.

- **MODULE_NOT_FOUND**:
 - Compile TypeScript:
   ```bash
   npm run build
   ```
 - Check: `ls -l /Users/rstokes/Sites/Milestone/dist/config/database.js`

- **Database Issues**:
 - Verify: `ls -l /Users/rstokes/Sites/Milestone/src/db/legal_documents.db`
 - Recreate database (see [Setup Instructions](#setup-instructions)).

- **Logs**:
 - Check `logs/error.log` for errors.
 - Add logging to `auth.services.ts`:
   ```typescript
   export async function verifyApiKey(db: Database, apiKey: string): Promise<number> {
     logger.info(`Verifying API key: ${apiKey} in database: ${process.env.DATABASE_URL}`);
     const result = await db.get("SELECT user_id FROM api_keys WHERE api_key = ?", [apiKey]);
     logger.info(`Query result: ${JSON.stringify(result)}`);
     if (!result) {
       logger.warn(`Invalid API key: ${apiKey}`);
       throw new Error("Invalid API key");
     }
     return result.user_id;
   }
   ```


## License
MIT License. See `LICENSE` file for details.
````
