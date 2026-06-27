// ==============================================
// SERVER.JS - Backend Express + SQLite (better-sqlite3)
// ==============================================

const express = require('express');
const cors    = require('cors');
const path    = require('path');
const Database = require('better-sqlite3');

const app  = express();
const PORT = 3000;

// Kết nối (hoặc tạo mới) file database SQLite
const db = new Database(path.join(__dirname, 'tasks.db'));

// Middleware: hỗ trợ JSON body và CORS
app.use(cors());
app.use(express.json());

// Phục vụ file tĩnh từ thư mục public (HTML, CSS, JS client)
app.use(express.static(path.join(__dirname, 'public')));

// ----------------------------------------------
// Khởi tạo bảng tasks nếu chưa tồn tại
// ----------------------------------------------
db.exec(`
  CREATE TABLE IF NOT EXISTS tasks (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    title      TEXT    NOT NULL,
    completed  INTEGER NOT NULL DEFAULT 0,
    created_at TEXT    NOT NULL DEFAULT (datetime('now'))
  )
`);

// ==============================================
// API ROUTES
// ==============================================

// GET /api/tasks — Lấy toàn bộ danh sách task (mới nhất lên đầu)
app.get('/api/tasks', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM tasks ORDER BY created_at DESC').all();

    // Chuyển cột completed từ 0/1 (SQLite) sang true/false (JS)
    const tasks = rows.map(r => ({ ...r, completed: r.completed === 1 }));
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ error: 'Lỗi khi lấy danh sách task: ' + err.message });
  }
});

// POST /api/tasks — Thêm task mới
app.post('/api/tasks', (req, res) => {
  const { title } = req.body;

  // Kiểm tra dữ liệu đầu vào
  if (!title || title.trim() === '') {
    return res.status(400).json({ error: 'Tiêu đề task không được để trống' });
  }

  try {
    const stmt   = db.prepare('INSERT INTO tasks (title) VALUES (?)');
    const result = stmt.run(title.trim());

    // Lấy lại task vừa thêm theo id được tạo tự động
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

  // Kiểm tra giá trị hợp lệ
  if (typeof completed !== 'boolean') {
    return res.status(400).json({ error: 'Trường completed phải là true hoặc false' });
  }

  try {
    // Chuyển boolean JS sang 0/1 trước khi lưu vào SQLite
    db.prepare('UPDATE tasks SET completed = ? WHERE id = ?').run(completed ? 1 : 0, id);

    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
    if (!task) {
      return res.status(404).json({ error: 'Không tìm thấy task với id: ' + id });
    }

    task.completed = task.completed === 1;
    res.json(task);
  } catch (err) {
    res.status(500).json({ error: 'Lỗi khi cập nhật task: ' + err.message });
  }
});

// DELETE /api/tasks/:id — Xóa một task
app.delete('/api/tasks/:id', (req, res) => {
  const id = Number(req.params.id);

  try {
    // Kiểm tra task tồn tại trước khi xóa
    const task = db.prepare('SELECT id FROM tasks WHERE id = ?').get(id);
    if (!task) {
      return res.status(404).json({ error: 'Không tìm thấy task với id: ' + id });
    }

    db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
    res.json({ message: 'Đã xóa task thành công', id });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi khi xóa task: ' + err.message });
  }
});

// ==============================================
// KHỞI ĐỘNG SERVER
// ==============================================
app.listen(PORT, () => {
  console.log(`✅ Server đang chạy tại http://localhost:${PORT}`);
  console.log('📋 API sẵn sàng:');
  console.log('   GET    /api/tasks');
  console.log('   POST   /api/tasks');
  console.log('   PATCH  /api/tasks/:id');
  console.log('   DELETE /api/tasks/:id');
});
