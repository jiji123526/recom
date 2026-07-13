# ZZIKSTYPE

A community platform for sharing, voting on, and ranking favorite quotes from books and stories — featuring a tournament-style "World Cup" mode.

## Features

### Quote Sharing
- Submit quotes with book title, author, link, and reason
- Sort by popularity or newest
- Heart (like) voting
- Comment on posts
- Edit/delete your own posts

### World Cup Tournament
- Bracket-style tournament (8, 16, 32, or all entries)
- Pick your favorite between two quotes each round
- Like and comment during gameplay
- Undo misclicks with the back button
- Full ranking displayed after completion
- Global leaderboard ranked by win rate and total wins
- Personal history stored locally with most-won tracking

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Node.js + Express 5 |
| Database | PostgreSQL (Neon) |
| Frontend | Vanilla HTML/CSS/JS (SPA) |
| Font | Pretendard |
| Deploy | Vercel |

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database (or [Neon](https://neon.tech) free tier)

### Installation

```bash
git clone <repo-url>
cd recom
npm install
```

### Environment Variables

Create a `.env` file:

```
DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require
```

### Run

```bash
npm start
```

The app runs at `http://localhost:3000`.

## Database Schema

Tables are auto-created on startup:

- **menus** — Posts (title, restaurant, author, description, submitted_by, created_by)
- **votes** — Likes (menu_id, voter, value)
- **comments** — Comments (menu_id, author, content, preferences)
- **tournament_matches** — Tournament match results (winner_id, loser_id, player, round_size)

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/menus` | All posts with scores and comment counts |
| POST | `/api/menus` | Create a new post |
| PUT | `/api/menus/:id` | Edit a post (owner only) |
| DELETE | `/api/menus/:id` | Delete a post (owner only) |
| GET | `/api/votes/:voter` | Get user's voted post IDs |
| POST | `/api/menus/:id/vote` | Toggle like |
| GET | `/api/menus/:id/comments` | Get comments for a post |
| POST | `/api/menus/:id/comments` | Add a comment |
| GET | `/api/tournament/rankings` | Tournament leaderboard (by win rate) |
| POST | `/api/tournament/matches` | Record a tournament match result |

## Project Structure

```
recom/
├── server.js              # Express API server
├── public/
│   └── index.html         # SPA frontend (HTML + CSS + JS)
├── package.json
├── vercel.json            # Vercel deployment config
└── .env                   # Environment variables (not committed)
```

## License

ISC

---

© 2026 cxwdxggy
