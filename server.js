require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const path = require('path');

const app = express();
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

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
  `);
}

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const wrap = fn => (req, res) => fn(req, res).catch(err => { console.error(err); res.status(500).json({ error: 'Server error' }); });

// GET all menus with vote counts
app.get('/api/menus', wrap(async (req, res) => {
  const { rows } = await pool.query(`
    SELECT m.*,
      COALESCE(SUM(v.value), 0) AS score,
      COUNT(DISTINCT v.id) AS vote_count,
      COUNT(DISTINCT c.id) AS comment_count
    FROM menus m
    LEFT JOIN votes v ON v.menu_id = m.id
    LEFT JOIN comments c ON c.menu_id = m.id
    GROUP BY m.id
    ORDER BY score DESC, m.created_at DESC
  `);
  res.json(rows);
}));

// POST new menu
app.post('/api/menus', wrap(async (req, res) => {
  const { title, restaurant, description, submitted_by, author, created_by } = req.body;
  if (!title || !title.trim()) return res.status(400).json({ error: 'Title is required' });
  const { rows } = await pool.query(
    'INSERT INTO menus (title, restaurant, description, submitted_by, author, created_by) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
    [title.trim(), restaurant?.trim() || null, description?.trim() || null, submitted_by?.trim() || null, author?.trim() || null, created_by?.trim() || null]
  );
  res.status(201).json({ ...rows[0], score: 0, vote_count: 0, comment_count: 0 });
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
    'UPDATE menus SET title=$1, restaurant=$2, description=$3, submitted_by=$4, author=$5 WHERE id=$6 RETURNING *',
    [title?.trim() || existing[0].title, restaurant?.trim() || null, description?.trim() || null, submitted_by?.trim() || null, author?.trim() || null, menuId]
  );
  res.json(rows[0]);
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
  await pool.query('DELETE FROM votes WHERE menu_id = $1', [menuId]);
  await pool.query('DELETE FROM comments WHERE menu_id = $1', [menuId]);
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

  const { rows } = await pool.query('SELECT * FROM votes WHERE menu_id = $1 AND voter = $2', [menuId, voter]);
  const existing = rows[0];

  if (existing) {
    if (existing.value === value) {
      await pool.query('DELETE FROM votes WHERE id = $1', [existing.id]);
    } else {
      await pool.query('UPDATE votes SET value = $1 WHERE id = $2', [value, existing.id]);
    }
  } else {
    await pool.query('INSERT INTO votes (menu_id, voter, value) VALUES ($1, $2, $3)', [menuId, voter, value]);
  }

  const scoreRes = await pool.query('SELECT COALESCE(SUM(value), 0) AS score FROM votes WHERE menu_id = $1', [menuId]);
  res.json({ score: parseInt(scoreRes.rows[0].score) });
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

initDb().catch(console.error);

const PORT = process.env.PORT || 3000;
if (require.main === module) {
  app.listen(PORT, () => console.log(`Lunch Vote running on http://localhost:${PORT}`));
}

module.exports = app;
