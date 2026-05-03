# service-social

Reusable social microservice: likes, comments, follows, blocks, bookmarks.

Content-agnostic — uses `contentId` instead of domain-specific IDs, so it works with any app.

## API Endpoints

### Likes
| Method | Path | Description |
|--------|------|-------------|
| POST | `/likes/toggle` | Toggle like on content |
| GET | `/likes/content/:contentId` | Get like count + isLiked |

### Comments
| Method | Path | Description |
|--------|------|-------------|
| POST | `/comments` | Add comment to content |
| GET | `/comments/content/:contentId` | List comments (cursor pagination) |
| DELETE | `/comments/:id` | Delete comment |
| POST | `/comments/:id/like` | Toggle comment like |

### Follows
| Method | Path | Description |
|--------|------|-------------|
| POST | `/follows/toggle` | Toggle follow |
| GET | `/follows/user/:userId` | Follower/following counts + isFollowing |
| GET | `/follows/user/:userId/followers` | List follower IDs |
| GET | `/follows/user/:userId/following` | List following IDs |

### Blocks
| Method | Path | Description |
|--------|------|-------------|
| POST | `/blocks/toggle` | Toggle block (auto-removes follows) |
| GET | `/blocks/check?blockerId=x&blockedId=y` | Check if blocked |

### Saves / Bookmarks
| Method | Path | Description |
|--------|------|-------------|
| POST | `/saves/toggle` | Toggle save |
| GET | `/saves/user/:userId` | List saved content (cursor pagination) |

### Engagement Summary
| Method | Path | Description |
|--------|------|-------------|
| GET | `/engagement/:contentId?userId=x` | Full stats: likes, comments, saves, isLiked, isSaved |

## Authentication

All endpoints (except `/health`) require `X-Service-Key` header.

## Setup

```bash
cp .env.example .env
npm install
npx prisma migrate dev
npm run dev           # http://localhost:3024
```

## Docker

```bash
docker-compose up     # service + postgres on port 3024
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | No | Server port (default: 3024) |
| `SERVICE_API_KEY` | Yes | API key for authentication |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
