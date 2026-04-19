# Messenger App (Chatify)

A real-time messaging application built with Next.js and Supabase.

## Features

- **Real-time Messaging** - Instant message delivery using Supabase Realtime
- **User Authentication** - Secure login/register with Supabase Auth
- **Image Sharing** - Send and receive images in chats
- **Profile Management** - Edit username and profile picture
- **Edit & Delete Messages** - Edit text messages, delete text or images
- **Online Status** - See when users are online/offline
- **Responsive Design** - Works on mobile, tablet, and laptop

## Tech Stack

- **Frontend**: Next.js 16, React 19, Tailwind CSS
- **Backend**: Supabase (PostgreSQL, Auth, Storage, Realtime)
- **Deployment**: Vercel

## Quick Setup

### 1. Create Supabase Project

1. Go to [Supabase](https://supabase.com/)
2. Create a new project
3. Note your `Project URL` and `anon key`

### 2. Setup Database

Run the SQL from `supabase/schema.sql` in the Supabase SQL Editor to create tables and policies.

### 3. Setup Storage

1. Go to Supabase Dashboard → Storage
2. Create a new bucket named `message-images`
3. Add policy to allow public read access

### 4. Add Environment Variables

Create `.env.local` in project root:

```bash
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 5. Run Locally

```bash
npm install
npm run dev
```

## Deployment

### Deploy to Vercel

1. Push code to GitHub
2. Import project in Vercel
3. Add environment variables in Vercel dashboard:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy!

## Usage

1. **Register/Login** - Create an account or sign in
2. **Start Conversation** - Click "New Message" to find users
3. **Send Messages** - Type text or click the image icon to send images
4. **Edit/Delete** - Hover (desktop) or long-press (mobile) on your messages
5. **Edit Profile** - Click the gear icon in sidebar to change name or photo
