// ==============================================
// server.js — Backend Node.js + Express + SQLite
// ==============================================

const express  = require('express');
const cors     = require('cors');
const path     = require('path');
const Database = require('better-sqlite3');

const app  = express();
const PORT = process.env.PORT || 3000;

// Kết nối (hoặc tạo mới) file cơ sở dữ liệu SQLite
const db = new Database(path.join(__dirname, 'tasks.db'));

// Middleware: phân tích JSON body và cho phép CORS
app.use(cors());
app.use(express.json());

// Phục vụ file tĩnh từ thư mục public (HTML, CSS, JS phía client)
app.use(express.static(path.join(__dirname, 'public')));

// ----------------------------------------------
// Khởi tạo bảng tasks nếu chưa tồn tại
// ----------------------------------------------
db.exec(`
  CREATE TABLE IF NOT EXISTS tasks (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    title      TEXT    NOT NULL,
    completed  INTEGER NOT NULL DEFAULT 0,
    created_at TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
  )
`);

// ==============================================
// API ROUTES
// ==============================================

// GET /api/tasks — Lấy toàn bộ danh sách (mới nhất lên đầu)
app.get('/api/tasks', (req, res) => {
  try {
    const rows  = db.prepare('SELECT * FROM tasks ORDER BY created_at DESC').all();
    // Chuyển cột completed từ 0/1 (SQLite) sang boolean (JavaScript)
    const tasks = rows.map(r => ({ ...r, completed: r.completed === 1 }));
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ error: 'Lỗi khi lấy danh sách: ' + err.message });
  }
});

// POST /api/tasks — Thêm task mới
app.post('/api/tasks', (req, res) => {
  const { title } = req.body;

  // Kiểm tra dữ liệu đầu vào không được để trống
  if (!title || title.trim() === '') {
    return res.status(400).json({ error: 'Tiêu đề không được để trống' });
  }

  try {
    const result  = db.prepare('INSERT INTO tasks (title) VALUES (?)').run(title.trim());
    const newTask = db.prepare('SELECT * FROM tasks WHERE id = ?').get(result.lastInsertRowid);
    newTask.completed = newTask.completed === 1;
    res.status(201).json(newTask);
  } catch (err) {
    res.status(500).json({ error: 'Lỗi khi thêm task: ' + err.message });
  }
});

// PATCH /api/tasks/:id — Cập nhật trạng thái hoàn thành
app.patch('/api/tasks/:id', (req, res) => {
  const id        = Number(req.params.id);
  const { completed } = req.body;

  if (typeof completed !== 'boolean') {
    return res.status(400).json({ error: 'completed phải là true hoặc false' });
  }

  try {
    // Chuyển boolean sang 0/1 trước khi lưu vào SQLite
    db.prepare('UPDATE tasks SET completed = ? WHERE id = ?').run(completed ? 1 : 0, id);
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
    if (!task) return res.status(404).json({ error: 'Không tìm thấy task' });
    task.completed = task.completed === 1;
    res.json(task);
  } catch (err) {
    res.status(500).json({ error: 'Lỗi khi cập nhật: ' + err.message });
  }
});

// PUT /api/tasks/:id — Sửa tiêu đề task
app.put('/api/tasks/:id', (req, res) => {
  const id    = Number(req.params.id);
  const { title } = req.body;

  if (!title || title.trim() === '') {
    return res.status(400).json({ error: 'Tiêu đề không được để trống' });
  }

  try {
    db.prepare('UPDATE tasks SET title = ? WHERE id = ?').run(title.trim(), id);
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
    if (!task) return res.status(404).json({ error: 'Không tìm thấy task' });
    task.completed = task.completed === 1;
    res.json(task);
  } catch (err) {
    res.status(500).json({ error: 'Lỗi khi sửa task: ' + err.message });
  }
});

// DELETE /api/tasks/:id — Xóa một task
app.delete('/api/tasks/:id', (req, res) => {
  const id = Number(req.params.id);
  try {
    const task = db.prepare('SELECT id FROM tasks WHERE id = ?').get(id);
    if (!task) return res.status(404).json({ error: 'Không tìm thấy task' });
    db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
    res.json({ message: 'Đã xóa thành công', id });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi khi xóa: ' + err.message });
  }
});

// DELETE /api/tasks — Xóa toàn bộ task đã hoàn thành
app.delete('/api/tasks', (req, res) => {
  try {
    const result = db.prepare('DELETE FROM tasks WHERE completed = 1').run();
    res.json({ message: `Đã xóa ${result.changes} task hoàn thành` });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi khi xóa: ' + err.message });
  }
});

// ==============================================
// KHỞI ĐỘNG SERVER
// ==============================================
app.listen(PORT, () => {
  console.log(`✅ Server đang chạy tại http://localhost:${PORT}`);
  console.log('📋 API:');
  console.log('   GET    /api/tasks         — Lấy danh sách');
  console.log('   POST   /api/tasks         — Thêm task');
  console.log('   PATCH  /api/tasks/:id     — Cập nhật trạng thái');
  console.log('   PUT    /api/tasks/:id     — Sửa tiêu đề');
  console.log('   DELETE /api/tasks/:id     — Xóa một task');
  console.log('   DELETE /api/tasks         — Xóa tất cả đã hoàn thành');
});
