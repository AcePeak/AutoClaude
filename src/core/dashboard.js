const fs = require('fs');
const path = require('path');
const { getCollabDir, getConfigDir, getLockDir } = require('../utils/paths');

/**
 * Get all tasks from a project
 */
function getAllTasks(projectPath) {
  const collabDir = getCollabDir(projectPath);
  const tasks = {
    queue: [],
    executing: [],
    completed: []
  };

  for (const dir of ['queue', 'executing', 'completed']) {
    const taskDir = path.join(collabDir, dir);
    if (!fs.existsSync(taskDir)) continue;

    const files = fs.readdirSync(taskDir)
      .filter(f => f.endsWith('.md'))
      .map(f => {
        const filePath = path.join(taskDir, f);
        const stat = fs.statSync(filePath);
        return { name: f, path: filePath, mtime: stat.mtime };
      })
      .sort((a, b) => b.mtime - a.mtime);

    for (const file of files) {
      const content = fs.readFileSync(file.path, 'utf8');
      const task = {
        id: path.basename(file.name, '.md'),
        name: file.name,
        path: file.path,
        relativePath: `${dir}/${file.name}`,
        location: dir,
        status: 'UNKNOWN',
        priority: 'normal',
        iteration: 1,
        maxIterations: 3,
        created: file.mtime.toISOString().split('T')[0],
        modified: file.mtime.toLocaleString(),
        description: '',
        content: content
      };

      // Parse YAML front matter
      const statusMatch = content.match(/status:\s*(\w+)/i);
      if (statusMatch) task.status = statusMatch[1];

      const priorityMatch = content.match(/priority:\s*(\w+)/i);
      if (priorityMatch) task.priority = priorityMatch[1];

      const iterMatch = content.match(/iteration:\s*(\d+)/i);
      if (iterMatch) task.iteration = parseInt(iterMatch[1]);

      const maxIterMatch = content.match(/max_iterations:\s*(\d+)/i);
      if (maxIterMatch) task.maxIterations = parseInt(maxIterMatch[1]);

      const descMatch = content.match(/## Task Description\s*\n+([^\n]+)/i);
      if (descMatch) task.description = descMatch[1].trim();

      tasks[dir].push(task);
    }
  }

  return tasks;
}

/**
 * Get lock information for a project
 */
function getLockInfo(projectPath) {
  const lockDir = getLockDir(projectPath);
  const locks = {};

  if (!fs.existsSync(lockDir)) return locks;

  const lockFiles = fs.readdirSync(lockDir).filter(f => f.endsWith('.lock'));
  for (const lockFile of lockFiles) {
    try {
      const lockPath = path.join(lockDir, lockFile);
      const lockContent = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
      const taskId = path.basename(lockFile, '.lock');
      locks[taskId] = {
        executorId: lockContent.executor_id,
        pid: lockContent.pid,
        lockedAt: lockContent.locked_at
      };
    } catch (e) {
      // Invalid lock file
    }
  }

  return locks;
}

/**
 * Get project metrics
 */
function getMetrics(projectPath) {
  const metricsFile = path.join(getConfigDir(projectPath), 'metrics.md');
  const metrics = {
    totalCompletions: 0
  };

  if (fs.existsSync(metricsFile)) {
    const content = fs.readFileSync(metricsFile, 'utf8');
    const match = content.match(/Total task completions\s*\|\s*(\d+)/i);
    if (match) metrics.totalCompletions = parseInt(match[1]);
  }

  return metrics;
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Generate task card HTML
 */
function generateTaskCard(task, lockInfo = null) {
  const maxIterLabel = task.maxIterations === 0 ? 'Inf' : task.maxIterations;
  const iterProgress = task.maxIterations === 0 ? 50 : Math.min(100, (task.iteration / task.maxIterations) * 100);
  const escapedContent = escapeHtml(task.content);
  const escapedDesc = escapeHtml(task.description);
  const safeId = task.id.replace(/[^a-zA-Z0-9_]/g, '_');

  let lockHtml = '';
  if (lockInfo) {
    lockHtml = `
      <div class="executor-info">
        <span class="label">Executor:</span> ${escapeHtml(lockInfo.executorId)}<br>
        <span class="label">PID:</span> ${lockInfo.pid}<br>
        <span class="label">Started:</span> ${escapeHtml(lockInfo.lockedAt)}
      </div>`;
  }

  return `
    <div class="task-card">
      <div class="task-header">
        <div class="task-id">${escapeHtml(task.id)}</div>
        <span class="task-status status-${task.status}">${task.status}</span>
      </div>
      <div class="task-description">${escapedDesc}</div>
      <div class="task-meta">
        <span class="priority-${task.priority}">Priority: ${task.priority}</span>
        <span>Modified: ${task.modified}</span>
      </div>
      <div class="iteration-bar">
        <div class="bar"><div class="progress" style="width: ${iterProgress}%"></div></div>
        <div class="text">Iteration ${task.iteration} / ${maxIterLabel}</div>
      </div>
      ${lockHtml}
      <div class="task-actions">
        <button class="btn btn-primary" onclick="showTask('${safeId}')">View Details</button>
      </div>
    </div>
    <script>var taskContent_${safeId} = ${JSON.stringify(escapedContent)};</script>`;
}

/**
 * Generate the full dashboard HTML
 */
function generate(projectPath) {
  const collabDir = getCollabDir(projectPath);
  if (!fs.existsSync(collabDir)) {
    throw new Error(`Project not initialized: ${projectPath}`);
  }

  const tasks = getAllTasks(projectPath);
  const locks = getLockInfo(projectPath);
  const metrics = getMetrics(projectPath);
  const projectName = path.basename(projectPath);
  const generatedTime = new Date().toLocaleString();

  const totalQueue = tasks.queue.length;
  const totalExecuting = tasks.executing.length;
  const totalCompleted = tasks.completed.length;

  // Generate task sections
  let executingHtml = '';
  if (tasks.executing.length === 0) {
    executingHtml = '<div class="empty-state">No tasks currently executing</div>';
  } else {
    for (const task of tasks.executing) {
      executingHtml += generateTaskCard(task, locks[task.id]);
    }
  }

  let queueHtml = '';
  if (tasks.queue.length === 0) {
    queueHtml = '<div class="empty-state">No tasks in queue</div>';
  } else {
    for (const task of tasks.queue) {
      queueHtml += generateTaskCard(task);
    }
  }

  let completedHtml = '';
  if (tasks.completed.length === 0) {
    completedHtml = '<div class="empty-state">No completed tasks yet</div>';
  } else {
    const recentCompleted = tasks.completed.slice(0, 10);
    for (const task of recentCompleted) {
      completedHtml += generateTaskCard(task);
    }
    if (tasks.completed.length > 10) {
      completedHtml += `<div class="empty-state">... and ${tasks.completed.length - 10} more completed tasks</div>`;
    }
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="refresh" content="30">
  <title>AutoClaude Dashboard - ${escapeHtml(projectName)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      color: #eee;
      min-height: 100vh;
      padding: 20px;
    }
    .header {
      text-align: center;
      margin-bottom: 30px;
      padding: 20px;
      background: rgba(255,255,255,0.05);
      border-radius: 15px;
    }
    .header h1 {
      font-size: 2.5em;
      margin-bottom: 10px;
      background: linear-gradient(90deg, #00d2ff, #3a7bd5);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    .header .meta { color: #888; font-size: 0.9em; }
    .stats {
      display: flex;
      justify-content: center;
      gap: 20px;
      margin-bottom: 30px;
      flex-wrap: wrap;
    }
    .stat-card {
      background: rgba(255,255,255,0.08);
      padding: 20px 40px;
      border-radius: 12px;
      text-align: center;
      min-width: 150px;
      border: 1px solid rgba(255,255,255,0.1);
    }
    .stat-card .number { font-size: 2.5em; font-weight: bold; }
    .stat-card .label { color: #888; margin-top: 5px; }
    .stat-card.queue .number { color: #ffd700; }
    .stat-card.executing .number { color: #00bfff; }
    .stat-card.completed .number { color: #00ff7f; }
    .section { margin-bottom: 30px; }
    .section-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 15px;
      padding-bottom: 10px;
      border-bottom: 2px solid rgba(255,255,255,0.1);
    }
    .section-header h2 { font-size: 1.5em; }
    .section-header .badge {
      background: rgba(255,255,255,0.2);
      padding: 3px 10px;
      border-radius: 20px;
      font-size: 0.8em;
    }
    .task-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
      gap: 15px;
    }
    .task-card {
      background: rgba(255,255,255,0.05);
      border-radius: 12px;
      padding: 20px;
      border: 1px solid rgba(255,255,255,0.1);
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .task-card:hover {
      transform: translateY(-3px);
      box-shadow: 0 10px 30px rgba(0,0,0,0.3);
    }
    .task-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 10px;
    }
    .task-id { font-family: monospace; font-size: 0.85em; color: #888; word-break: break-all; }
    .task-status {
      padding: 3px 10px;
      border-radius: 5px;
      font-size: 0.75em;
      font-weight: bold;
      text-transform: uppercase;
    }
    .status-PENDING { background: #ffd700; color: #000; }
    .status-EXECUTING { background: #00bfff; color: #000; }
    .status-REVIEW { background: #ff69b4; color: #000; }
    .status-APPROVED, .status-COMPLETED { background: #00ff7f; color: #000; }
    .status-REJECTED { background: #ff4444; color: #fff; }
    .task-description { margin: 10px 0; color: #ccc; font-size: 0.95em; line-height: 1.4; }
    .task-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin: 10px 0;
      font-size: 0.8em;
      color: #888;
    }
    .task-meta span { background: rgba(255,255,255,0.05); padding: 3px 8px; border-radius: 4px; }
    .task-meta .priority-high { color: #ff4444; }
    .task-meta .priority-normal { color: #888; }
    .task-meta .priority-low { color: #4a9eff; }
    .iteration-bar { margin-top: 10px; }
    .iteration-bar .bar {
      height: 6px;
      background: rgba(255,255,255,0.1);
      border-radius: 3px;
      overflow: hidden;
    }
    .iteration-bar .progress {
      height: 100%;
      background: linear-gradient(90deg, #00d2ff, #3a7bd5);
    }
    .iteration-bar .text { font-size: 0.75em; color: #888; margin-top: 5px; }
    .executor-info {
      background: rgba(0,191,255,0.1);
      border: 1px solid rgba(0,191,255,0.3);
      border-radius: 8px;
      padding: 10px;
      margin-top: 10px;
      font-size: 0.85em;
    }
    .executor-info .label { color: #00bfff; font-weight: bold; }
    .task-actions { display: flex; gap: 8px; margin-top: 15px; }
    .btn {
      padding: 6px 12px;
      border: none;
      border-radius: 5px;
      cursor: pointer;
      font-size: 0.8em;
      transition: opacity 0.2s;
    }
    .btn:hover { opacity: 0.8; }
    .btn-primary { background: #3a7bd5; color: #fff; }
    .empty-state { text-align: center; padding: 40px; color: #666; }
    .modal {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.8);
      z-index: 1000;
      overflow: auto;
    }
    .modal-content {
      background: #1a1a2e;
      margin: 50px auto;
      padding: 30px;
      border-radius: 15px;
      max-width: 800px;
      max-height: 80vh;
      overflow: auto;
      border: 1px solid rgba(255,255,255,0.1);
    }
    .modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
    .modal-close { font-size: 1.5em; cursor: pointer; color: #888; }
    .modal-close:hover { color: #fff; }
    .modal-body pre {
      background: rgba(0,0,0,0.3);
      padding: 15px;
      border-radius: 8px;
      overflow: auto;
      white-space: pre-wrap;
      word-wrap: break-word;
      font-family: monospace;
      font-size: 0.9em;
    }
    .footer { text-align: center; margin-top: 40px; padding: 20px; color: #666; font-size: 0.85em; }
    .footer a { color: #3a7bd5; text-decoration: none; }
    @media (max-width: 600px) {
      .task-grid { grid-template-columns: 1fr; }
      .stats { flex-direction: column; align-items: center; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>AutoClaude Dashboard</h1>
    <div class="meta">
      Project: <strong>${escapeHtml(projectName)}</strong> |
      Last updated: ${generatedTime} |
      Total completions: ${metrics.totalCompletions}
    </div>
  </div>

  <div class="stats">
    <div class="stat-card queue">
      <div class="number">${totalQueue}</div>
      <div class="label">In Queue</div>
    </div>
    <div class="stat-card executing">
      <div class="number">${totalExecuting}</div>
      <div class="label">Executing</div>
    </div>
    <div class="stat-card completed">
      <div class="number">${totalCompleted}</div>
      <div class="label">Completed</div>
    </div>
  </div>

  <div class="section">
    <div class="section-header">
      <h2>[Running] Currently Executing</h2>
      <span class="badge">${totalExecuting} tasks</span>
    </div>
    <div class="task-grid">${executingHtml}</div>
  </div>

  <div class="section">
    <div class="section-header">
      <h2>[Queue] Queued Tasks</h2>
      <span class="badge">${totalQueue} tasks</span>
    </div>
    <div class="task-grid">${queueHtml}</div>
  </div>

  <div class="section">
    <div class="section-header">
      <h2>[Done] Completed Tasks</h2>
      <span class="badge">${totalCompleted} tasks</span>
    </div>
    <div class="task-grid">${completedHtml}</div>
  </div>

  <div id="taskModal" class="modal">
    <div class="modal-content">
      <div class="modal-header">
        <h3 id="modalTitle">Task Details</h3>
        <span class="modal-close" onclick="closeModal()">&times;</span>
      </div>
      <div class="modal-body">
        <pre id="modalContent"></pre>
      </div>
    </div>
  </div>

  <div class="footer">
    <p>AutoClaude Dashboard | Auto-refreshes every 30 seconds</p>
    <p><a href="https://github.com/AcePeak/AutoClaude" target="_blank">GitHub</a></p>
  </div>

  <script>
    function showTask(taskId) {
      var varName = 'taskContent_' + taskId;
      var content = window[varName] || 'Content not available';
      document.getElementById('modalTitle').textContent = taskId;
      document.getElementById('modalContent').textContent = decodeHtml(content);
      document.getElementById('taskModal').style.display = 'block';
    }
    function closeModal() {
      document.getElementById('taskModal').style.display = 'none';
    }
    function decodeHtml(html) {
      var txt = document.createElement('textarea');
      txt.innerHTML = html;
      return txt.value;
    }
    window.onclick = function(e) {
      if (e.target == document.getElementById('taskModal')) closeModal();
    }
    document.onkeydown = function(e) {
      if (e.key === 'Escape') closeModal();
    }
  </script>
</body>
</html>`;

  const dashboardPath = path.join(collabDir, 'dashboard.html');
  fs.writeFileSync(dashboardPath, html, 'utf8');

  return dashboardPath;
}

module.exports = { generate, getAllTasks, getLockInfo, getMetrics };
