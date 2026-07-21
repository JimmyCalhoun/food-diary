(function () {
  'use strict';

  // ── Default quick buttons ──────────────────────────────────────────
  const DEFAULT_BUTTONS = [
    // Breakfast (6-10am)
    { id: 'hbo',        label: 'Honey Bunches / Almond Milk / Banana', emoji: '🥣', category: 'breakfast', startHour: 6,  endHour: 10 },
    { id: 'jd-muffin',  label: 'Jimmy Dean Turkey Sausage Egg Cheese Muffin', emoji: '🍳', category: 'breakfast', startHour: 6,  endHour: 10 },
    { id: 'md-biscuit', label: 'Mason Dixie Cheddar Biscuit Sausage Egg Cheese', emoji: '🧈', category: 'breakfast', startHour: 6,  endHour: 10 },
    // Drinks (6am-noon)
    { id: 'espresso',   label: 'Double Espresso Americano', emoji: '☕', category: 'drink', startHour: 6,  endHour: 12 },
    { id: 'cold-brew',  label: 'Cold Brew',                emoji: '🧊', category: 'drink', startHour: 6,  endHour: 12 },
    { id: 'hot-coffee', label: 'Hot Brewed Coffee',         emoji: '☕', category: 'drink', startHour: 6,  endHour: 12 },
    { id: 'celsius',    label: 'Celsius Packet',            emoji: '⚡', category: 'drink', startHour: 6,  endHour: 12 },
    // Lunch (10am-1pm)
    { id: 'alfredo',     label: 'Chicken Alfredo',     emoji: '🍝', category: 'lunch', startHour: 10, endHour: 13 },
    { id: 'enchiladas',  label: 'Chicken Enchiladas',  emoji: '🌯', category: 'lunch', startHour: 10, endHour: 13 },
    { id: 'pizza',       label: 'Pizza Slice',         emoji: '🍕', category: 'lunch', startHour: 10, endHour: 13 },
    // Beer (1pm+)
    { id: 'ipa',         label: '16oz IPA Beer',       emoji: '🍺', category: 'beer', startHour: 13, endHour: 24 },
  ];

  // ── State ──────────────────────────────────────────────────────────
  let config = {
    pat: '',
    repo: '',
    issueNumber: null,
    buttons: DEFAULT_BUTTONS,
  };
  let entries = [];       // cached entries from GitHub
  let historyDate = null; // date being viewed in history modal

  // ── DOM refs ───────────────────────────────────────────────────────
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  // ── LocalStorage helpers ───────────────────────────────────────────
  function saveConfig() {
    localStorage.setItem('fd_config', JSON.stringify(config));
  }
  function loadConfig() {
    const raw = localStorage.getItem('fd_config');
    if (raw) {
      try {
        const saved = JSON.parse(raw);
        config = { ...config, ...saved };
        // Ensure buttons have all required fields
        if (!config.buttons || !config.buttons.length) config.buttons = DEFAULT_BUTTONS;
      } catch (_) { /* use defaults */ }
    }
  }

  // ── GitHub API ─────────────────────────────────────────────────────
  async function gh(path, opts = {}) {
    const url = path.startsWith('http') ? path : `https://api.github.com${path}`;
    const res = await fetch(url, {
      ...opts,
      headers: {
        Authorization: `Bearer ${config.pat}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
        ...opts.headers,
      },
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`GitHub API ${res.status}: ${body}`);
    }
    if (res.status === 204) return null;
    return res.json();
  }

  async function ensureDiaryIssue() {
    if (config.issueNumber) {
      try {
        await gh(`/repos/${config.repo}/issues/${config.issueNumber}`);
        return;
      } catch (_) { /* issue deleted, recreate */ }
    }
    // Search for existing diary issue
    const search = await gh(`/repos/${config.repo}/issues?labels=food-diary&state=open&per_page=1`);
    if (search.length) {
      config.issueNumber = search[0].number;
      saveConfig();
      return;
    }
    // Create new issue
    const issue = await gh(`/repos/${config.repo}/issues`, {
      method: 'POST',
      body: JSON.stringify({
        title: '🍽️ Food Diary Log',
        body: 'This issue stores food diary entries as comments. Do not close or delete.\n\nEach comment contains a JSON payload with entry data.',
        labels: ['food-diary'],
      }),
    });
    config.issueNumber = issue.number;
    saveConfig();
  }

  async function postEntry(item, category, notes = '') {
    const entry = {
      item,
      category,
      timestamp: new Date().toISOString(),
      notes,
    };
    const body = `${entry.item}\n\n\`\`\`json\n${JSON.stringify(entry)}\n\`\`\``;
    await gh(`/repos/${config.repo}/issues/${config.issueNumber}/comments`, {
      method: 'POST',
      body: JSON.stringify({ body }),
    });
    return entry;
  }

  async function fetchEntries() {
    let allComments = [];
    let page = 1;
    while (true) {
      const comments = await gh(
        `/repos/${config.repo}/issues/${config.issueNumber}/comments?per_page=100&page=${page}`
      );
      if (!comments.length) break;
      allComments = allComments.concat(comments);
      if (comments.length < 100) break;
      page++;
    }
    return allComments
      .map((c) => {
        const match = c.body.match(/```json\n([\s\S]*?)\n```/);
        if (!match) return null;
        try {
          const entry = JSON.parse(match[1]);
          entry._commentId = c.id;
          return entry;
        } catch (_) { return null; }
      })
      .filter(Boolean);
  }

  async function deleteEntry(commentId) {
    await gh(`/repos/${config.repo}/issues/comments/${commentId}`, {
      method: 'DELETE',
    });
  }

  // ── Time helpers ───────────────────────────────────────────────────
  function currentHour() {
    return new Date().getHours();
  }

  function timeLabel(hour) {
    if (hour >= 6 && hour < 10) return '🌅 Morning';
    if (hour >= 10 && hour < 12) return '☀️ Late Morning';
    if (hour >= 12 && hour < 13) return '🌞 Midday';
    if (hour >= 13 && hour < 17) return '🌇 Afternoon';
    if (hour >= 17 && hour < 21) return '🌆 Evening';
    return '🌙 Night';
  }

  function todayStr() {
    return new Date().toISOString().slice(0, 10);
  }

  function formatTime(iso) {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }

  function formatDate(dateStr) {
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  }

  // ── Render quick buttons ──────────────────────────────────────────
  function renderQuickButtons() {
    const hour = currentHour();
    const relevant = config.buttons.filter(b => hour >= b.startHour && hour < b.endHour);
    const all = config.buttons;

    $('#time-label').textContent = timeLabel(hour);
    $('#quick-buttons').innerHTML = relevant.length
      ? relevant.map(b => quickBtnHTML(b)).join('')
      : '<div class="no-entries">No quick buttons for this time. Tap "Show all" below.</div>';
    $('#all-buttons').innerHTML = all.map(b => quickBtnHTML(b)).join('');

    // Bind clicks
    $$('.quick-btn').forEach(btn => {
      btn.addEventListener('click', () => logQuickButton(btn));
    });
  }

  function quickBtnHTML(b) {
    return `<button class="quick-btn" data-id="${b.id}" data-label="${esc(b.label)}" data-cat="${b.category}">
      <span class="emoji">${b.emoji}</span>
      <span>${esc(b.label)}</span>
    </button>`;
  }

  function esc(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  }

  // ── Log a quick button ────────────────────────────────────────────
  async function logQuickButton(btn) {
    if (btn.classList.contains('logging')) return;
    btn.classList.add('logging');
    const label = btn.dataset.label;
    const cat = btn.dataset.cat;
    try {
      const entry = await postEntry(label, cat);
      entries.push(entry);
      renderToday();
      toast(`✓ Logged: ${label}`);
    } catch (err) {
      toast(`Error: ${err.message}`, true);
    } finally {
      setTimeout(() => btn.classList.remove('logging'), 500);
    }
  }

  // ── Custom entry ──────────────────────────────────────────────────
  function bindCustomEntry() {
    $('#custom-submit').addEventListener('click', async () => {
      const item = $('#custom-input').value.trim();
      if (!item) return;
      const cat = $('#custom-category').value;
      const notes = $('#custom-notes').value.trim();
      $('#custom-submit').disabled = true;
      try {
        const entry = await postEntry(item, cat, notes);
        entries.push(entry);
        renderToday();
        $('#custom-input').value = '';
        $('#custom-notes').value = '';
        toast(`✓ Logged: ${item}`);
      } catch (err) {
        toast(`Error: ${err.message}`, true);
      } finally {
        $('#custom-submit').disabled = false;
      }
    });

    // Submit on Enter in custom input
    $('#custom-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') $('#custom-submit').click();
    });
  }

  // ── Render today's log ────────────────────────────────────────────
  function renderToday() {
    const today = todayStr();
    const todayEntries = entries
      .filter(e => e.timestamp.startsWith(today))
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    if (!todayEntries.length) {
      $('#today-entries').innerHTML = '<div class="no-entries">No entries yet today. Tap a button above!</div>';
      return;
    }

    $('#today-entries').innerHTML = todayEntries.map(e => `
      <div class="entry">
        <div class="entry-info">
          <div class="entry-item">${esc(e.item)}</div>
          ${e.notes ? `<div class="entry-notes">${esc(e.notes)}</div>` : ''}
        </div>
        <span class="entry-time">${formatTime(e.timestamp)}</span>
        ${e._commentId ? `<button class="entry-delete" data-cid="${e._commentId}" title="Delete">🗑</button>` : ''}
      </div>
    `).join('');

    // Bind delete buttons
    $$('.entry-delete').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Delete this entry?')) return;
        const cid = btn.dataset.cid;
        try {
          await deleteEntry(cid);
          entries = entries.filter(e => e._commentId != cid);
          renderToday();
          toast('Entry deleted');
        } catch (err) {
          toast(`Error: ${err.message}`, true);
        }
      });
    });
  }

  // ── History modal ─────────────────────────────────────────────────
  function bindHistory() {
    $('#history-btn').addEventListener('click', () => {
      historyDate = todayStr();
      renderHistory();
      $('#history-modal').classList.remove('hidden');
    });
    $('#history-close').addEventListener('click', () => {
      $('#history-modal').classList.add('hidden');
    });
    $('#date-prev').addEventListener('click', () => {
      const d = new Date(historyDate + 'T12:00:00');
      d.setDate(d.getDate() - 1);
      historyDate = d.toISOString().slice(0, 10);
      renderHistory();
    });
    $('#date-next').addEventListener('click', () => {
      const d = new Date(historyDate + 'T12:00:00');
      d.setDate(d.getDate() + 1);
      historyDate = d.toISOString().slice(0, 10);
      renderHistory();
    });
  }

  function renderHistory() {
    $('#date-label').textContent = formatDate(historyDate);
    const dayEntries = entries
      .filter(e => e.timestamp.startsWith(historyDate))
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    if (!dayEntries.length) {
      $('#history-entries').innerHTML = '<div class="no-entries">No entries this day.</div>';
      return;
    }

    $('#history-entries').innerHTML = dayEntries.map(e => `
      <div class="entry">
        <div class="entry-info">
          <div class="entry-item">${esc(e.item)}</div>
          ${e.notes ? `<div class="entry-notes">${esc(e.notes)}</div>` : ''}
          <div class="entry-meta">${e.category}</div>
        </div>
        <span class="entry-time">${formatTime(e.timestamp)}</span>
      </div>
    `).join('');
  }

  // ── Export ─────────────────────────────────────────────────────────
  function bindExport() {
    $('#export-btn').addEventListener('click', () => {
      if (!entries.length) { toast('No entries to export'); return; }

      // CSV
      const header = 'timestamp,item,category,notes';
      const rows = entries
        .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
        .map(e => `"${e.timestamp}","${e.item.replace(/"/g, '""')}","${e.category}","${(e.notes || '').replace(/"/g, '""')}"`);
      const csv = [header, ...rows].join('\n');

      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `food-diary-${todayStr()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast('CSV downloaded');
    });
  }

  // ── Settings ──────────────────────────────────────────────────────
  function bindSettings() {
    $('#settings-btn').addEventListener('click', () => {
      renderButtonEditor();
      $('#settings-modal').classList.remove('hidden');
    });
    $('#settings-close').addEventListener('click', () => {
      $('#settings-modal').classList.add('hidden');
    });
    $('#disconnect-btn').addEventListener('click', () => {
      if (!confirm('Clear your token and disconnect?')) return;
      localStorage.removeItem('fd_config');
      location.reload();
    });
    $('#add-button-btn').addEventListener('click', () => {
      config.buttons.push({
        id: 'btn-' + Date.now(),
        label: 'New Item',
        emoji: '🍽️',
        category: 'food',
        startHour: 0,
        endHour: 24,
      });
      saveConfig();
      renderButtonEditor();
      renderQuickButtons();
    });
  }

  function renderButtonEditor() {
    const cats = ['breakfast', 'drink', 'lunch', 'beer', 'food', 'snack', 'supplement'];
    $('#button-editor').innerHTML = config.buttons.map((b, i) => `
      <div class="button-editor-item" data-idx="${i}">
        <input type="text" value="${esc(b.emoji)}" style="width:44px;text-align:center;flex:0" class="be-emoji">
        <input type="text" value="${esc(b.label)}" class="be-label">
        <select class="be-cat">
          ${cats.map(c => `<option value="${c}" ${c === b.category ? 'selected' : ''}>${c}</option>`).join('')}
        </select>
        <input type="number" value="${b.startHour}" min="0" max="23" style="width:50px;flex:0" class="be-start" title="Start hour">
        <input type="number" value="${b.endHour}" min="1" max="24" style="width:50px;flex:0" class="be-end" title="End hour">
        <button class="btn btn-sm be-delete" title="Remove">🗑</button>
      </div>
    `).join('');

    // Bind editor events
    $$('.button-editor-item').forEach(item => {
      const idx = parseInt(item.dataset.idx);
      const update = () => {
        config.buttons[idx].emoji = item.querySelector('.be-emoji').value;
        config.buttons[idx].label = item.querySelector('.be-label').value;
        config.buttons[idx].category = item.querySelector('.be-cat').value;
        config.buttons[idx].startHour = parseInt(item.querySelector('.be-start').value) || 0;
        config.buttons[idx].endHour = parseInt(item.querySelector('.be-end').value) || 24;
        saveConfig();
        renderQuickButtons();
      };
      item.querySelectorAll('input, select').forEach(el => el.addEventListener('change', update));
      item.querySelector('.be-delete').addEventListener('click', () => {
        config.buttons.splice(idx, 1);
        saveConfig();
        renderButtonEditor();
        renderQuickButtons();
      });
    });
  }

  // ── Show-all toggle ───────────────────────────────────────────────
  function bindShowAll() {
    $('#show-all-btn').addEventListener('click', () => {
      const allBtns = $('#all-buttons');
      const isHidden = allBtns.classList.contains('hidden');
      allBtns.classList.toggle('hidden');
      $('#show-all-btn').textContent = isHidden ? 'Hide all quick buttons' : 'Show all quick buttons';
    });
  }

  // ── Toast ─────────────────────────────────────────────────────────
  function toast(msg, isError = false) {
    const el = $('#toast');
    el.textContent = msg;
    el.style.background = isError ? 'var(--accent)' : 'var(--success)';
    el.style.color = isError ? '#fff' : '#000';
    el.classList.remove('hidden');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.add('hidden'), 2200);
  }

  // ── Setup flow ────────────────────────────────────────────────────
  async function handleSetup() {
    const pat = $('#pat-input').value.trim();
    const repo = $('#repo-input').value.trim();
    if (!pat || !repo) {
      $('#setup-error').textContent = 'Both fields are required.';
      $('#setup-error').classList.remove('hidden');
      return;
    }
    $('#setup-btn').disabled = true;
    $('#setup-btn').textContent = 'Connecting...';
    try {
      config.pat = pat;
      config.repo = repo;
      // Verify access
      await gh(`/repos/${repo}`);
      saveConfig();
      await startApp();
    } catch (err) {
      $('#setup-error').textContent = `Connection failed: ${err.message}`;
      $('#setup-error').classList.remove('hidden');
      $('#setup-btn').disabled = false;
      $('#setup-btn').textContent = 'Connect & Start';
    }
  }

  // ── App init ──────────────────────────────────────────────────────
  async function startApp() {
    $('#setup-screen').classList.add('hidden');
    $('#app-screen').classList.remove('hidden');

    renderQuickButtons();
    bindCustomEntry();
    bindHistory();
    bindExport();
    bindSettings();
    bindShowAll();

    // Load entries from GitHub
    try {
      await ensureDiaryIssue();
      entries = await fetchEntries();
      renderToday();
    } catch (err) {
      toast(`Failed to load entries: ${err.message}`, true);
      $('#today-entries').innerHTML = `<div class="no-entries">Could not load entries. Check your connection.</div>`;
    }
  }

  // ── Boot ───────────────────────────────────────────────────────────
  loadConfig();
  if (config.pat && config.repo) {
    startApp();
  } else {
    $('#setup-screen').classList.remove('hidden');
    $('#setup-btn').addEventListener('click', handleSetup);
  }

  // Re-render buttons every 30 min to update time-awareness
  setInterval(renderQuickButtons, 30 * 60 * 1000);

  // Register service worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
