# Messenger App

A real-time messaging application built with Next.js, Express, Socket.io, and PostgreSQL.

## Features

- Real-time messaging with Socket.io
- User authentication (JWT)
- Direct and group conversations
- File and image attachments
- Typing indicators
- Online/offline status

## Project Structure

```
├── app/                    # Next.js frontend
│   ├── (auth)/            # Auth pages (login, register)
│   ├── (chat)/            # Chat pages
│   ├── lib/               # Auth and socket utilities
│   └── components/        # React components
└── server/                # Express backend
    ├── prisma/            # Database schema
    ├── src/
    │   ├── routes/       # API routes
    │   ├── middleware/    # Auth middleware
    │   ├── socket/        # Socket.io handlers
    │   └── types/         # TypeScript types
    └── uploads/          # File attachments
```

## Setup

### Prerequisites

- Node.js 20+
- PostgreSQL database
- Fly.io account (for deployment)

### Local Development

1. **Database Setup**

```bash
# Create PostgreSQL database
createdb messenger_db

# Update DATABASE_URL in server/.env
```

2. **Backend**

```bash
cd server
npm install
npx prisma generate
npx prisma db push
npm run dev
```

3. **Frontend**

```bash
npm install
npm run dev
```

4. **Environment Variables**

Copy `.env.example` to `.env.local` and `.env` in the respective directories.

## Deployment to Fly.io

### 1. Set up PostgreSQL on Fly.io

```bash
fly postgres create --name messenger-db
fly postgres attach --app messenger-server messenger-db
```

### 2. Deploy Backend

```bash
cd server

# Set secrets
fly secrets set JWT_SECRET="your-secret-key"
fly secrets set DATABASE_URL="postgresql://..."

# Deploy
fly deploy
```

### 3. Deploy Frontend

Update `NEXT_PUBLIC_API_URL` in `.env` with your backend URL:

```bash
# In root directory
fly secrets set NEXT_PUBLIC_API_URL="https://messenger-server.fly.dev"

fly deploy
```

### Or use the deploy script

```bash
cd server
./deploy.sh
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user

### Conversations
- `GET /api/conversations` - List user conversations
- `POST /api/conversations` - Create conversation
- `GET /api/conversations/:id` - Get conversation details
- `POST /api/conversations/:id/participants` - Add participants

### Messages
- `GET /api/messages/:conversationId` - Get messages
- `POST /api/messages` - Send message
- `POST /api/messages/upload` - Upload file
- `GET /api/messages/users/search?q=` - Search users

## Socket.io Events

### Client → Server
- `joinConversation` - Join a conversation room
- `leaveConversation` - Leave a conversation room
- `sendMessage` - Send a message
- `typing` - User is typing
- `stopTyping` - User stopped typing

### Server → Client
- `message` - New message received
- `typing` - User is typing
- `userOnline` - User came online
- `userOffline` - User went offline
