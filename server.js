require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const path = require('path');
const rateLimit = require('express-rate-limit');

const app = express();
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

// Rate limiting
const apiLimiter = rateLimit({ windowMs: 60000, max: 60, message: { error: 'Too many requests, please try again later.' } });
app.use('/api/', apiLimiter);

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS menus (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      restaurant TEXT,
      description TEXT,
      submitted_by TEXT,
      author TEXT,
      created_by TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS votes (
      id SERIAL PRIMARY KEY,
      menu_id INTEGER NOT NULL REFERENCES menus(id) ON DELETE CASCADE,
      voter TEXT NOT NULL,
      value INTEGER NOT NULL CHECK(value IN (1, -1)),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(menu_id, voter)
    );
    CREATE TABLE IF NOT EXISTS comments (
      id SERIAL PRIMARY KEY,
      menu_id INTEGER NOT NULL REFERENCES menus(id) ON DELETE CASCADE,
      author TEXT NOT NULL,
      content TEXT NOT NULL,
      preferences TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS tournament_matches (
      id SERIAL PRIMARY KEY,
      winner_id INTEGER NOT NULL REFERENCES menus(id) ON DELETE CASCADE,
      loser_id INTEGER NOT NULL REFERENCES menus(id) ON DELETE CASCADE,
      player TEXT NOT NULL,
      round_size INTEGER NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_votes_menu_id ON votes(menu_id);
    CREATE INDEX IF NOT EXISTS idx_votes_voter ON votes(voter);
    CREATE INDEX IF NOT EXISTS idx_comments_menu_id ON comments(menu_id);
    CREATE INDEX IF NOT EXISTS idx_tournament_winner ON tournament_matches(winner_id);
    CREATE INDEX IF NOT EXISTS idx_tournament_loser ON tournament_matches(loser_id);
    CREATE INDEX IF NOT EXISTS idx_menus_created_at ON menus(created_at DESC);
  `);

  // Schema migration: rename confusing columns (safe to run multiple times)
  // menus.title -> quote, menus.restaurant -> book_title, menus.submitted_by -> link
  const { rows } = await pool.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'menus' AND column_name = 'restaurant'
  `);
  if (rows.length > 0) {
    await pool.query(`
      ALTER TABLE menus RENAME COLUMN title TO quote;
      ALTER TABLE menus RENAME COLUMN restaurant TO book_title;
      ALTER TABLE menus RENAME COLUMN submitted_by TO link;
    `);
  }
}

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const wrap = fn => (req, res) => fn(req, res).catch(err => { console.error(err); res.status(500).json({ error: 'Server error' }); });

// Simple in-memory cache
const cache = { menus: null, menusAt: 0 };
const CACHE_TTL = 5000; // 5 seconds

function invalidateMenuCache() { cache.menus = null; }

// GET all menus with vote counts
app.get('/api/menus', wrap(async (req, res) => {
  if (cache.menus && Date.now() - cache.menusAt < CACHE_TTL) {
    return res.json(cache.menus);
  }
  const { rows } = await pool.query(`
    WITH menu_scores AS (
      SELECT menu_id,
        COALESCE(SUM(value), 0)::int AS score,
        COUNT(*)::int AS vote_count
      FROM votes
      GROUP BY menu_id
    ),
    menu_comments AS (
      SELECT menu_id, COUNT(*)::int AS comment_count
      FROM comments
      GROUP BY menu_id
    )
    SELECT m.id, m.quote AS title, m.book_title AS restaurant, m.description,
      m.link AS submitted_by, m.author, m.created_by, m.created_at,
      COALESCE(ms.score, 0) AS score,
      COALESCE(ms.vote_count, 0) AS vote_count,
      COALESCE(mc.comment_count, 0) AS comment_count
    FROM menus m
    LEFT JOIN menu_scores ms ON ms.menu_id = m.id
    LEFT JOIN menu_comments mc ON mc.menu_id = m.id
    ORDER BY score DESC, m.created_at DESC
  `);
  cache.menus = rows;
  cache.menusAt = Date.now();
  res.json(rows);
}));

// POST new menu
app.post('/api/menus', wrap(async (req, res) => {
  const { title, restaurant, description, submitted_by, author, created_by } = req.body;
  if (!title || !title.trim()) return res.status(400).json({ error: 'Title is required' });
  const { rows } = await pool.query(
    'INSERT INTO menus (quote, book_title, description, link, author, created_by) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, quote AS title, book_title AS restaurant, description, link AS submitted_by, author, created_by, created_at',
    [title.trim(), restaurant?.trim() || null, description?.trim() || null, submitted_by?.trim() || null, author?.trim() || null, created_by?.trim() || null]
  );
  res.status(201).json({ ...rows[0], score: 0, vote_count: 0, comment_count: 0 });
  invalidateMenuCache();
}));

// PUT edit menu (owner only)
app.put('/api/menus/:id', wrap(async (req, res) => {
  const menuId = parseInt(req.params.id);
  const { title, restaurant, description, submitted_by, author, created_by } = req.body;
  if (!created_by) return res.status(400).json({ error: 'User ID required' });
  const { rows: existing } = await pool.query('SELECT * FROM menus WHERE id = $1', [menuId]);
  if (!existing.length) return res.status(404).json({ error: 'Not found' });
  if (existing[0].created_by !== created_by) return res.status(403).json({ error: 'Not your post' });
  const { rows } = await pool.query(
    'UPDATE menus SET quote=$1, book_title=$2, description=$3, link=$4, author=$5 WHERE id=$6 RETURNING id, quote AS title, book_title AS restaurant, description, link AS submitted_by, author, created_by, created_at',
    [title?.trim() || existing[0].quote, restaurant?.trim() || null, description?.trim() || null, submitted_by?.trim() || null, author?.trim() || null, menuId]
  );
  res.json(rows[0]);
  invalidateMenuCache();
}));

// DELETE menu (owner only)
app.delete('/api/menus/:id', wrap(async (req, res) => {
  const menuId = parseInt(req.params.id);
  const created_by = req.query.user;
  if (!created_by) return res.status(400).json({ error: 'User ID required' });
  const { rows: existing } = await pool.query('SELECT * FROM menus WHERE id = $1', [menuId]);
  if (!existing.length) return res.status(404).json({ error: 'Not found' });
  if (existing[0].created_by !== created_by) return res.status(403).json({ error: 'Not your post' });
  await pool.query('DELETE FROM menus WHERE id = $1', [menuId]);
  invalidateMenuCache();
  res.json({ success: true });
}));

// GET user's votes
app.get('/api/votes/:voter', wrap(async (req, res) => {
  const { rows } = await pool.query('SELECT menu_id FROM votes WHERE voter = $1', [req.params.voter]);
  res.json(rows.map(r => r.menu_id));
}));

// POST vote (upsert)
app.post('/api/menus/:id/vote', wrap(async (req, res) => {
  const { voter, value } = req.body;
  const menuId = parseInt(req.params.id);
  if (!voter?.trim()) return res.status(400).json({ error: 'Voter name required' });
  if (value !== 1) return res.status(400).json({ error: 'Value must be 1' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock($1, hashtext($2))', [menuId, voter]);

    const { rows } = await client.query('SELECT * FROM votes WHERE menu_id = $1 AND voter = $2', [menuId, voter]);
    const existing = rows[0];

    if (existing) {
      if (existing.value === value) {
        await client.query('DELETE FROM votes WHERE id = $1', [existing.id]);
      } else {
        await client.query('UPDATE votes SET value = $1 WHERE id = $2', [value, existing.id]);
      }
    } else {
      await client.query('INSERT INTO votes (menu_id, voter, value) VALUES ($1, $2, $3)', [menuId, voter, value]);
    }

    const scoreRes = await client.query('SELECT COALESCE(SUM(value), 0) AS score FROM votes WHERE menu_id = $1', [menuId]);
    await client.query('COMMIT');
    invalidateMenuCache();
    res.json({ score: parseInt(scoreRes.rows[0].score, 10) });
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    throw err;
  } finally {
    client.release();
  }
}));

// GET comments for a menu
app.get('/api/menus/:id/comments', wrap(async (req, res) => {
  const { rows } = await pool.query(
    'SELECT * FROM comments WHERE menu_id = $1 ORDER BY created_at ASC',
    [parseInt(req.params.id)]
  );
  res.json(rows);
}));

// POST comment
app.post('/api/menus/:id/comments', wrap(async (req, res) => {
  const { author, content, preferences } = req.body;
  const menuId = parseInt(req.params.id);
  if (!content?.trim()) return res.status(400).json({ error: 'Comment content required' });
  const { rows } = await pool.query(
    'INSERT INTO comments (menu_id, author, content, preferences) VALUES ($1, $2, $3, $4) RETURNING *',
    [menuId, author?.trim() || 'Anonymous', content.trim(), preferences?.trim() || null]
  );
  res.status(201).json(rows[0]);
}));

// GET tournament rankings
app.get('/api/tournament/rankings', wrap(async (req, res) => {
  const { rows } = await pool.query(`
    WITH menu_scores AS (
      SELECT menu_id, COALESCE(SUM(value), 0) AS score
      FROM votes GROUP BY menu_id
    ),
    menu_comments AS (
      SELECT menu_id, COUNT(*)::int AS comment_count
      FROM comments GROUP BY menu_id
    )
    SELECT m.id, m.quote AS title, m.book_title AS restaurant, m.description,
      m.link AS submitted_by, m.author, m.created_by, m.created_at,
      COALESCE(ms.score, 0) AS score,
      COALESCE(mc.comment_count, 0) AS comment_count,
      COUNT(w.id)::int AS wins,
      (COUNT(w.id) + COUNT(l.id))::int AS appearances,
      CASE WHEN (COUNT(w.id) + COUNT(l.id)) > 0
        THEN ROUND(COUNT(w.id)::numeric / (COUNT(w.id) + COUNT(l.id)) * 100, 1)
        ELSE 0
      END AS win_rate
    FROM menus m
    LEFT JOIN menu_scores ms ON ms.menu_id = m.id
    LEFT JOIN menu_comments mc ON mc.menu_id = m.id
    LEFT JOIN tournament_matches w ON w.winner_id = m.id
    LEFT JOIN tournament_matches l ON l.loser_id = m.id
    GROUP BY m.id, ms.score, mc.comment_count
    HAVING (COUNT(w.id) + COUNT(l.id)) > 0
    ORDER BY win_rate DESC, wins DESC
  `);
  res.json(rows);
}));

// POST tournament match result
app.post('/api/tournament/matches', wrap(async (req, res) => {
  const { winner_id, loser_id, player, round_size } = req.body;
  if (!winner_id || !loser_id || !player) return res.status(400).json({ error: 'Missing fields' });
  await pool.query(
    'INSERT INTO tournament_matches (winner_id, loser_id, player, round_size) VALUES ($1, $2, $3, $4)',
    [winner_id, loser_id, player, round_size]
  );
  res.status(201).json({ success: true });
}));

// POST batch tournament match results
app.post('/api/tournament/matches/batch', wrap(async (req, res) => {
  const { matches, player, round_size } = req.body;
  if (!matches || !Array.isArray(matches) || !player) return res.status(400).json({ error: 'Missing fields' });
  if (matches.length === 0) return res.status(400).json({ error: 'No matches' });
  // Build a single multi-row INSERT
  const values = [];
  const params = [];
  matches.forEach((m, i) => {
    const offset = i * 4;
    values.push(`($${offset+1}, $${offset+2}, $${offset+3}, $${offset+4})`);
    params.push(m.winner_id, m.loser_id, player, round_size);
  });
  await pool.query(
    `INSERT INTO tournament_matches (winner_id, loser_id, player, round_size) VALUES ${values.join(', ')}`,
    params
  );
  res.status(201).json({ success: true, count: matches.length });
}));

initDb().catch(console.error);

const PORT = process.env.PORT || 3000;
if (require.main === module) {
  app.listen(PORT, () => console.log(`Lunch Vote running on http://localhost:${PORT}`));
}

module.exports = app;
