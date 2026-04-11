# Messenger App

A real-time messaging application built with Next.js and Firebase.

## Features

- Real-time messaging with Firebase Firestore
- User authentication (Firebase Auth)
- Direct and group conversations
- File and image attachments (Firebase Storage)
- Real-time updates

## Quick Setup

### 1. Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project
3. **Authentication**: Enable "Email/Password" provider
4. **Firestore Database**: Create database in test mode
5. **Storage**: Enable storage in test mode

### 2. Get Firebase Config

1. Go to Project Settings > General > Your apps > Web app
2. Copy the config values

### 3. Add Environment Variables

Create `.env.local` in project root:

```bash
NEXT_PUBLIC_FIREBASE_API_KEY=your-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abcdef
```

### 4. Set Firestore Rules

Go to Firestore > Rules:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    match /conversations/{conversationId} {
      allow read, write: if request.auth != null;
    }
    match /messages/{messageId} {
      allow read, write: if request.auth != null;
    }
  }
}
```

### 5. Set Storage Rules

Go to Storage > Rules:

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

### 6. Run Locally

```bash
npm install
npm run dev
```

## Deploy to Vercel

1. Push code to GitHub
2. Import project in Vercel
3. Add Firebase environment variables in Vercel dashboard
4. Deploy!

**Important:** Don't forget to add all `NEXT_PUBLIC_FIREBASE_*` variables in Vercel.
