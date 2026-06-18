const express = require('express');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = process.env.DB_PATH || 'lunch.db';
const dbDir = path.dirname(dbPath);
if (dbDir !== '.' && !fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const app = express();
const db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS menus (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    restaurant TEXT,
    description TEXT,
    submitted_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS votes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    menu_id INTEGER NOT NULL,
    voter TEXT NOT NULL,
    value INTEGER NOT NULL CHECK(value IN (1, -1)),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (menu_id) REFERENCES menus(id) ON DELETE CASCADE,
    UNIQUE(menu_id, voter)
  );

  CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    menu_id INTEGER NOT NULL,
    author TEXT NOT NULL,
    content TEXT NOT NULL,
    preferences TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (menu_id) REFERENCES menus(id) ON DELETE CASCADE
  );
`);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// GET all menus with vote counts
app.get('/api/menus', (req, res) => {
  const menus = db.prepare(`
    SELECT m.*,
      COALESCE(SUM(v.value), 0) AS score,
      COUNT(DISTINCT v.id) AS vote_count,
      COUNT(DISTINCT c.id) AS comment_count
    FROM menus m
    LEFT JOIN votes v ON v.menu_id = m.id
    LEFT JOIN comments c ON c.menu_id = m.id
    GROUP BY m.id
    ORDER BY score DESC, m.created_at DESC
  `).all();
  res.json(menus);
});

// POST new menu
app.post('/api/menus', (req, res) => {
  const { title, restaurant, description, submitted_by } = req.body;
  if (!title || !title.trim()) return res.status(400).json({ error: 'Title is required' });
  const result = db.prepare(
    'INSERT INTO menus (title, restaurant, description, submitted_by) VALUES (?, ?, ?, ?)'
  ).run(title.trim(), restaurant?.trim() || null, description?.trim() || null, submitted_by?.trim() || null);
  const menu = db.prepare('SELECT * FROM menus WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ ...menu, score: 0, vote_count: 0, comment_count: 0 });
});

// POST vote (upsert)
app.post('/api/menus/:id/vote', (req, res) => {
  const { voter, value } = req.body;
  const menuId = parseInt(req.params.id);
  if (!voter?.trim()) return res.status(400).json({ error: 'Voter name required' });
  if (value !== 1) return res.status(400).json({ error: 'Value must be 1' });

  const existing = db.prepare('SELECT * FROM votes WHERE menu_id = ? AND voter = ?').get(menuId, voter);
  if (existing) {
    if (existing.value === value) {
      // Toggle off
      db.prepare('DELETE FROM votes WHERE id = ?').run(existing.id);
    } else {
      db.prepare('UPDATE votes SET value = ? WHERE id = ?').run(value, existing.id);
    }
  } else {
    db.prepare('INSERT INTO votes (menu_id, voter, value) VALUES (?, ?, ?)').run(menuId, voter, value);
  }

  const score = db.prepare('SELECT COALESCE(SUM(value), 0) AS score FROM votes WHERE menu_id = ?').get(menuId).score;
  res.json({ score });
});

// GET comments for a menu
app.get('/api/menus/:id/comments', (req, res) => {
  const comments = db.prepare(
    'SELECT * FROM comments WHERE menu_id = ? ORDER BY created_at ASC'
  ).all(parseInt(req.params.id));
  res.json(comments);
});

// POST comment
app.post('/api/menus/:id/comments', (req, res) => {
  const { author, content, preferences } = req.body;
  const menuId = parseInt(req.params.id);
  if (!content?.trim()) return res.status(400).json({ error: 'Comment content required' });
  const result = db.prepare(
    'INSERT INTO comments (menu_id, author, content, preferences) VALUES (?, ?, ?, ?)'
  ).run(menuId, author?.trim() || 'Anonymous', content.trim(), preferences?.trim() || null);
  const comment = db.prepare('SELECT * FROM comments WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(comment);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Lunch Vote running on http://localhost:${PORT}`));
