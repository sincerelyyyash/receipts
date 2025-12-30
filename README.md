# Receipts 

> Hold YouTubers accountable for their financial predictions. Track and verify their predictions with AI-powered analysis.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-000000?logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![Bun](https://img.shields.io/badge/Bun-000000?logo=bun&logoColor=white)](https://bun.sh/)

## 🎯 Overview

Receipts is an open-source platform that automatically tracks financial predictions made by YouTubers, verifies their accuracy against actual market outcomes, and ranks creators by their prediction accuracy. Built with modern web technologies and AI-powered analysis.

## ✨ Features

- **Automated Pipeline**: Automatically syncs videos, fetches transcripts, and analyzes predictions
- **AI-Powered Analysis**: Uses Gemini 2.5 Flash to extract predictions and verify accuracy
- **Real-time Verification**: Compares predictions against actual market data using Exa AI search
- **Leaderboard**: Rank YouTubers by their prediction accuracy
- **Detailed Analytics**: View individual predictions with timestamps, outcomes, and explanations
- **Beautiful UI**: Modern, responsive design with dark mode support
- **Production Ready**: Built with TypeScript, error handling, rate limiting, and caching

## 🛠️ Tech Stack

### Frontend
- **Next.js 16** - React framework with App Router
- **TypeScript** - Type-safe development
- **TailwindCSS** - Utility-first CSS framework
- **Shadcn/ui** - High-quality component library
- **Lucide React** - Icon library

### Backend
- **Bun** - Fast JavaScript runtime
- **Express** - Web framework
- **Prisma** - Type-safe ORM
- **PostgreSQL** - Database (Neon)
- **Redis** - Caching and job queue
- **BullMQ** - Job queue management

### AI Services
- **Google Gemini 2.5 Flash** - Prediction extraction and verification
- **Exa AI** - Market data search and verification
- **YouTube Data API** - Channel and video metadata

## 📋 Prerequisites

- [Bun](https://bun.sh/) v1.2.22 or higher
- [Node.js](https://nodejs.org/) 18+ (for frontend)
- [Docker](https://www.docker.com/) (for Redis)
- PostgreSQL database (recommended: [Neon](https://neon.tech/))
- API Keys:
  - YouTube Data API v3
  - Google Gemini API
  - Exa AI API

## 🚀 Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/receipts.git
cd receipts
```

### 2. Start Redis

```bash
docker run -d \
  --name receipts-redis \
  -p 6379:6379 \
  redis:7-alpine
```

Or use a managed Redis service like [Upstash](https://upstash.com/) or [Redis Cloud](https://redis.com/cloud/).

### 3. Backend Setup

```bash
cd backend

# Install dependencies
bun install

# Copy environment variables
cp env.example .env

# Edit .env with your API keys and database URL
# DATABASE_URL - PostgreSQL connection string (Neon recommended)
# REDIS_URL - Redis connection string
# YOUTUBE_API_KEY - YouTube Data API v3 key
# GEMINI_API_KEY - Google Gemini API key
# EXA_API_KEY - Exa AI API key

# Run database migrations
bunx prisma migrate dev

# Start the backend server
bun run dev
```

The backend will run on `http://localhost:3001`

### 4. Frontend Setup

```bash
cd frontend

# Install dependencies
bun install

# Copy environment variables (if needed)
# Create .env.local with:
# NEXT_PUBLIC_API_URL=http://localhost:3001/api

# Start the development server
bun run dev
```

The frontend will run on `http://localhost:3000`

## 🔧 Environment Variables

### Backend (`backend/.env`)

```env
# Database
DATABASE_URL="postgresql://user:password@host:5432/database"

# Redis
REDIS_URL="redis://localhost:6379"

# YouTube Data API v3
YOUTUBE_API_KEY="your_youtube_api_key"

# AI Services
GEMINI_API_KEY="your_gemini_api_key"
EXA_API_KEY="your_exa_api_key"

# Server
PORT=3001
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000
```

### Frontend (`frontend/.env.local`)

```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

## 📖 Usage

### Adding a YouTuber

1. Navigate to the homepage
2. Click "Add YouTuber"
3. Enter the YouTube channel URL (e.g., `https://www.youtube.com/@channelname`)
4. The system will automatically:
   - Sync videos from the last year
   - Fetch transcripts
   - Extract predictions
   - Verify against market data
   - Calculate accuracy scores

### Viewing Results

- **Dashboard**: Browse all YouTubers in card view
- **Leaderboard**: See rankings sorted by accuracy
- **Channel Page**: View detailed analysis for each creator
- **Predictions**: See individual predictions with timestamps, outcomes, and explanations

## 🏗️ Project Structure

```
receipts/
├── backend/              # Express API server
│   ├── src/
│   │   ├── config/       # Configuration files
│   │   ├── lib/          # Utilities (queue, cache, etc.)
│   │   ├── middleware/   # Express middleware
│   │   ├── routes/       # API routes
│   │   ├── services/     # Business logic
│   │   └── types/        # TypeScript types
│   ├── prisma/           # Database schema
│   └── package.json
├── frontend/             # Next.js application
│   ├── app/              # Next.js app router pages
│   ├── components/       # React components
│   ├── lib/              # Utilities
│   └── types/            # TypeScript types
└── README.md
```

## 🔌 API Endpoints

### Channels
- `GET /api/channels` - List all YouTubers
- `POST /api/channels` - Add new channel
- `GET /api/channels/:id` - Get channel details
- `GET /api/channels/:id/pipeline-status` - Get processing status
- `POST /api/channels/:id/start-pipeline` - Manually trigger pipeline

### Videos
- `GET /api/videos` - List videos
- `GET /api/videos/:id` - Get video with predictions
- `POST /api/videos/:id/transcript` - Fetch transcript
- `POST /api/videos/:id/analyze` - Analyze video

### Leaderboard
- `GET /api/leaderboard` - Get accuracy rankings
- `GET /api/leaderboard/stats` - Get platform statistics

## 🤖 How It Works

1. **Video Sync**: Fetches videos from YouTube channels
2. **Transcript Extraction**: Downloads video transcripts
3. **Prediction Extraction**: Uses Gemini AI to identify financial predictions
4. **Market Verification**: Searches for actual market outcomes using Exa AI
5. **Accuracy Scoring**: Compares predictions vs. reality using Gemini
6. **Ranking**: Calculates aggregate scores and ranks creators

## 🧪 Development

### Running Tests

```bash
# Backend tests
cd backend
bun test

# Frontend tests
cd frontend
bun test
```

### Database Migrations

```bash
cd backend
bunx prisma migrate dev    # Create migration
bunx prisma generate       # Generate Prisma Client
bunx prisma studio         # Open Prisma Studio
```

### Code Formatting

```bash
# Backend
cd backend
bun run format

# Frontend
cd frontend
bun run lint
```

## 🚢 Deployment

### Backend

The backend can be deployed to:
- [Railway](https://railway.app/)
- [Render](https://render.com/)
- [Fly.io](https://fly.io/)
- Any Node.js/Bun-compatible platform

### Frontend

The frontend can be deployed to:
- [Vercel](https://vercel.com/) (recommended)
- [Netlify](https://www.netlify.com/)
- Any static hosting service

### Environment Setup

Make sure to set all environment variables in your hosting platform:
- Database URL (Neon recommended)
- Redis URL (Upstash or Redis Cloud)
- All API keys

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👤 Author

**sincerelyyyash**

- Portfolio: [sincerelyyyash.com](https://sincerelyyyash.com)
- GitHub: [@yourusername](https://github.com/yourusername)

## 🙏 Acknowledgments

- [Next.js](https://nextjs.org/) for the amazing framework
- [Bun](https://bun.sh/) for the fast runtime
- [Prisma](https://www.prisma.io/) for the excellent ORM
- [Shadcn/ui](https://ui.shadcn.com/) for the beautiful components
- [Google Gemini](https://deepmind.google/technologies/gemini/) for AI capabilities
- [Exa AI](https://exa.ai/) for market data search

## 📊 Status

- ✅ Core functionality complete
- ✅ Automated pipeline working
- ✅ Frontend UI polished
- 🔄 Active development
- 📈 Performance optimizations ongoing

---

Made with ❤️ by [sincerelyyyash](https://sincerelyyyash.com)
