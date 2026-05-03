require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
const { serviceAuth } = require('./middleware/auth');

const prisma = new PrismaClient();
const app = express();
const PORT = process.env.PORT || 3024;

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.use(serviceAuth);

// ─── LIKES ───

// POST /likes/toggle — toggle like on content
app.post('/likes/toggle', async (req, res, next) => {
  try {
    const { userId, contentId } = req.body;
    if (!userId || !contentId) return res.status(400).json({ error: 'userId and contentId required' });

    const existing = await prisma.like.findUnique({ where: { userId_contentId: { userId, contentId } } });
    if (existing) {
      await prisma.like.delete({ where: { id: existing.id } });
    } else {
      await prisma.like.create({ data: { userId, contentId } });
    }
    const likesCount = await prisma.like.count({ where: { contentId } });
    res.json({ liked: !existing, likesCount });
  } catch (err) { next(err); }
});

// GET /likes/content/:contentId — get likes for content
app.get('/likes/content/:contentId', async (req, res, next) => {
  try {
    const userId = req.query.userId;
    const likesCount = await prisma.like.count({ where: { contentId: req.params.contentId } });
    let isLiked = false;
    if (userId) {
      isLiked = !!(await prisma.like.findUnique({ where: { userId_contentId: { userId, contentId: req.params.contentId } } }));
    }
    res.json({ likesCount, isLiked });
  } catch (err) { next(err); }
});

// ─── COMMENTS ───

// POST /comments — add comment
app.post('/comments', async (req, res, next) => {
  try {
    const { userId, contentId, text } = req.body;
    if (!userId || !contentId || !text?.trim()) return res.status(400).json({ error: 'userId, contentId, text required' });

    const comment = await prisma.comment.create({
      data: { userId, contentId, text: text.trim() },
    });
    res.status(201).json(comment);
  } catch (err) { next(err); }
});

// GET /comments/content/:contentId — list comments
app.get('/comments/content/:contentId', async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const cursor = req.query.cursor || null;

    const comments = await prisma.comment.findMany({
      where: { contentId: req.params.contentId },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: { _count: { select: { likes: true } } },
    });

    const hasMore = comments.length > limit;
    if (hasMore) comments.pop();
    const nextCursor = hasMore ? comments[comments.length - 1].id : null;

    res.json({ comments, nextCursor });
  } catch (err) { next(err); }
});

// DELETE /comments/:id — delete comment
app.delete('/comments/:id', async (req, res, next) => {
  try {
    await prisma.comment.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// POST /comments/:id/like — toggle comment like
app.post('/comments/:id/like', async (req, res, next) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId required' });

    const existing = await prisma.commentLike.findUnique({ where: { userId_commentId: { userId, commentId: req.params.id } } });
    if (existing) {
      await prisma.commentLike.delete({ where: { id: existing.id } });
    } else {
      await prisma.commentLike.create({ data: { userId, commentId: req.params.id } });
    }
    const likesCount = await prisma.commentLike.count({ where: { commentId: req.params.id } });
    res.json({ liked: !existing, likesCount });
  } catch (err) { next(err); }
});

// ─── FOLLOWS ───

// POST /follows/toggle — toggle follow
app.post('/follows/toggle', async (req, res, next) => {
  try {
    const { followerId, followingId } = req.body;
    if (!followerId || !followingId) return res.status(400).json({ error: 'followerId and followingId required' });
    if (followerId === followingId) return res.status(400).json({ error: 'Cannot follow yourself' });

    const existing = await prisma.follow.findUnique({ where: { followerId_followingId: { followerId, followingId } } });
    if (existing) {
      await prisma.follow.delete({ where: { id: existing.id } });
    } else {
      await prisma.follow.create({ data: { followerId, followingId } });
    }
    const followersCount = await prisma.follow.count({ where: { followingId } });
    res.json({ following: !existing, followersCount });
  } catch (err) { next(err); }
});

// GET /follows/user/:userId — get follower/following counts + check if following
app.get('/follows/user/:userId', async (req, res, next) => {
  try {
    const checkerId = req.query.checkerId;
    const [followers, following] = await Promise.all([
      prisma.follow.count({ where: { followingId: req.params.userId } }),
      prisma.follow.count({ where: { followerId: req.params.userId } }),
    ]);
    let isFollowing = false;
    if (checkerId) {
      isFollowing = !!(await prisma.follow.findUnique({ where: { followerId_followingId: { followerId: checkerId, followingId: req.params.userId } } }));
    }
    res.json({ followers, following, isFollowing });
  } catch (err) { next(err); }
});

// GET /follows/user/:userId/followers — list followers
app.get('/follows/user/:userId/followers', async (req, res, next) => {
  try {
    const follows = await prisma.follow.findMany({
      where: { followingId: req.params.userId },
      orderBy: { createdAt: 'desc' },
      select: { followerId: true, createdAt: true },
    });
    res.json({ users: follows.map((f) => f.followerId) });
  } catch (err) { next(err); }
});

// GET /follows/user/:userId/following — list following
app.get('/follows/user/:userId/following', async (req, res, next) => {
  try {
    const follows = await prisma.follow.findMany({
      where: { followerId: req.params.userId },
      orderBy: { createdAt: 'desc' },
      select: { followingId: true, createdAt: true },
    });
    res.json({ users: follows.map((f) => f.followingId) });
  } catch (err) { next(err); }
});

// ─── BLOCKS ───

// POST /blocks/toggle — toggle block
app.post('/blocks/toggle', async (req, res, next) => {
  try {
    const { blockerId, blockedId } = req.body;
    if (!blockerId || !blockedId) return res.status(400).json({ error: 'blockerId and blockedId required' });

    const existing = await prisma.block.findUnique({ where: { blockerId_blockedId: { blockerId, blockedId } } });
    if (existing) {
      await prisma.block.delete({ where: { id: existing.id } });
    } else {
      await prisma.block.create({ data: { blockerId, blockedId } });
      // Remove follow in both directions
      await prisma.follow.deleteMany({ where: { OR: [{ followerId: blockerId, followingId: blockedId }, { followerId: blockedId, followingId: blockerId }] } });
    }
    res.json({ blocked: !existing });
  } catch (err) { next(err); }
});

// GET /blocks/check — check if blocked
app.get('/blocks/check', async (req, res, next) => {
  try {
    const { blockerId, blockedId } = req.query;
    if (!blockerId || !blockedId) return res.status(400).json({ error: 'blockerId and blockedId required' });
    const blocked = !!(await prisma.block.findUnique({ where: { blockerId_blockedId: { blockerId, blockedId } } }));
    res.json({ blocked });
  } catch (err) { next(err); }
});

// ─── SAVES / BOOKMARKS ───

// POST /saves/toggle — toggle save
app.post('/saves/toggle', async (req, res, next) => {
  try {
    const { userId, contentId } = req.body;
    if (!userId || !contentId) return res.status(400).json({ error: 'userId and contentId required' });

    const existing = await prisma.save.findUnique({ where: { userId_contentId: { userId, contentId } } });
    if (existing) {
      await prisma.save.delete({ where: { id: existing.id } });
    } else {
      await prisma.save.create({ data: { userId, contentId } });
    }
    res.json({ saved: !existing });
  } catch (err) { next(err); }
});

// GET /saves/user/:userId — list saved content IDs
app.get('/saves/user/:userId', async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const cursor = req.query.cursor || null;

    const saves = await prisma.save.findMany({
      where: { userId: req.params.userId },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const hasMore = saves.length > limit;
    if (hasMore) saves.pop();
    const nextCursor = hasMore ? saves[saves.length - 1].id : null;

    res.json({ saves, nextCursor });
  } catch (err) { next(err); }
});

// ─── ENGAGEMENT SUMMARY ───

// GET /engagement/:contentId — full engagement stats for content
app.get('/engagement/:contentId', async (req, res, next) => {
  try {
    const userId = req.query.userId;
    const [likesCount, commentsCount, savesCount] = await Promise.all([
      prisma.like.count({ where: { contentId: req.params.contentId } }),
      prisma.comment.count({ where: { contentId: req.params.contentId } }),
      prisma.save.count({ where: { contentId: req.params.contentId } }),
    ]);

    let isLiked = false, isSaved = false;
    if (userId) {
      const [like, save] = await Promise.all([
        prisma.like.findUnique({ where: { userId_contentId: { userId, contentId: req.params.contentId } } }),
        prisma.save.findUnique({ where: { userId_contentId: { userId, contentId: req.params.contentId } } }),
      ]);
      isLiked = !!like;
      isSaved = !!save;
    }

    res.json({ likesCount, commentsCount, savesCount, isLiked, isSaved });
  } catch (err) { next(err); }
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message });
});

app.listen(PORT, () => {
  console.log(`Social service running on port ${PORT}`);
});

module.exports = app;
