const express = require('express');
const Database = require('better-sqlite3');
const path = require('path');

const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Database
const db = new Database(path.join(__dirname, 'leaderboard.db'));
db.pragma('journal_mode = WAL');

// Create table
db.exec(`
  CREATE TABLE IF NOT EXISTS scores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player_id TEXT NOT NULL,
    score INTEGER NOT NULL,
    difficulty TEXT NOT NULL,
    play_time INTEGER NOT NULL,
    created_at TEXT NOT NULL
  )
`);

// Prepared statements
const insertScore = db.prepare(`
  INSERT INTO scores (player_id, score, difficulty, play_time, created_at)
  VALUES (@player_id, @score, @difficulty, @play_time, @created_at)
`);

const getTopScores = db.prepare(`
  SELECT player_id, score, difficulty, play_time, created_at
  FROM scores
  ORDER BY score DESC
  LIMIT 50
`);

// API: Submit score
app.post('/api/scores', (req, res) => {
  try {
    const { player_id, score, difficulty, play_time } = req.body;

    if (!player_id || score === undefined || !difficulty || play_time === undefined) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const now = new Date();
    const created_at = `${now.getMonth() + 1}/${now.getDate()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    insertScore.run({ player_id, score, difficulty, play_time: Math.round(play_time), created_at });
    res.json({ success: true });
  } catch (err) {
    console.error('Error inserting score:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// API: Get leaderboard
app.get('/api/scores', (req, res) => {
  try {
    const scores = getTopScores.all();
    res.json(scores);
  } catch (err) {
    console.error('Error fetching scores:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🎮 Neon Shape Merge server running at http://0.0.0.0:${PORT}`);
  console.log(`📡 Local network: http://192.168.165.84:${PORT}`);
});
