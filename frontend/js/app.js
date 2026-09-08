'use strict';

/* ============================================================
   TRWL frontend — talks to the backend API only.
   The backend owns the linked list, queue and stack; this UI
   renders snapshots from /api/state after every action.
   ============================================================ */

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s == null ? '' : s)
  .replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const API = {
  async request(path, method = 'GET', body = null) {
    const opts = { method, headers: {} };
    if (body) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
    const res = await fetch(path, opts);
    let data = null;
    try { data = await res.json(); } catch { /* non-JSON */ }
    if (!res.ok || (data && data.ok === false)) {
      throw new Error((data && data.error) || `Request failed (${res.status})`);
    }
    return data;
  },
  get(path) { return this.request(path); },
  post(path, body) { return this.request(path, 'POST', body || {}); }
};

let state = null;
let wasConnected = false;
let searchMode = 'pnr';

const VIEWS = {
  dashboard: ['Dashboard', 'Live overview of berths, queue and activity'],
  book: ['Book Reservation', 'Add a passenger — CONFIRMED or WAITING decided automatically'],
  confirmed: ['Confirmed Reservations', 'Singly linked list of berth holders'],
  waiting: ['Waiting Queue', 'FIFO linked queue — the front is promoted first'],
  search: ['Search', 'Linear search by PNR or passenger name'],
  sort: ['Sort', 'Insertion sort on the confirmed linked list'],
  history: ['Action History & Undo', 'LIFO stack of booking / cancellation actions'],
  ds: ['Data Structures', 'Live visualisation of list, queue and stack'],
  system: ['System', 'Backend status, configuration and demo controls']
};

/* ============================ boot ============================ */

document.addEventListener('DOMContentLoaded', () => {
  bindNavigation();
  bindActions();
  renderStaticDS();
  refresh();
  setInterval(() => { if (!document.hidden) refresh(); }, 8000);
});

async function refresh() {
  try {
    const data = await API.get('/api/state');
    state = data.state;
    wasConnected = true;
    setConnection(true);
    renderAll();
  } catch (e) {
    setConnection(false);
    if (wasConnected) { toast('error', 'Backend unreachable', 'Retrying automatically…'); wasConnected = false; }
  }
}

function setConnection(ok) {
  $('connDot').classList.toggle('ok', ok);
  $('connText').textContent = ok ? 'Backend connected' : 'Backend offline';
}

function renderAll() {
  if (!state) return;
  renderPills();
  renderDashboard();
  renderConfirmed();
  renderWaiting();
  renderStackAndActivity();
  renderDataStructures();
  renderSystem();
}

/* ============================ navigation ============================ */

function bindNavigation() {
  document.querySelectorAll('.nav-item').forEach((btn) => {
    btn.addEventListener('click', () => {
      switchView(btn.dataset.view);
      $('sidebar').classList.remove('open');
    });
  });
  document.querySelectorAll('[data-goto]').forEach((b) =>
    b.addEventListener('click', () => switchView(b.dataset.goto)));
  $('hamburger').addEventListener('click', () => $('sidebar').classList.toggle('open'));
}

function switchView(name) {
  document.querySelectorAll('.nav-item').forEach((b) => b.classList.toggle('active', b.dataset.view === name));
  document.querySelectorAll('.view').forEach((v) => v.classList.toggle('active', v.id === 'view-' + name));
  const [t, s] = VIEWS[name] || ['—', ''];
  $('viewTitle').textContent = t;
  $('viewSubtitle').textContent = s;
}

/* ============================ actions ============================ */

function bindActions() {
  $('bookForm').addEventListener('submit', onBook);
  $('searchForm').addEventListener('submit', onSearch);
  $('searchSeg').querySelectorAll('.seg-btn').forEach((b) => {
    b.addEventListener('click', () => {
      $('searchSeg').querySelectorAll('.seg-btn').forEach((x) => x.classList.toggle('active', x === b));
      searchMode = b.dataset.mode;
      $('searchInput').placeholder = searchMode === 'pnr' ? 'e.g. 1006' : 'e.g. Meena Loganathan';
    });
  });
  $('sortBtn').addEventListener('click', onSort);
  $('undoBtn').addEventListener('click', onUndo);
  $('demoBtn').addEventListener('click', async () => {
    try {
      await API.post('/api/demo');
      toast('success', 'Demo scenario loaded', '5 confirmed + 3 waiting. Cancel PNR 1001 to watch FIFO promotion.');
      await refresh();
    } catch (e) { toast('error', 'Failed', e.message); }
  });
  $('resetBtn').addEventListener('click', () =>
    confirmDialog('Reset system', 'This clears every reservation, the waiting queue and the undo stack. Continue?', async () => {
      try { await API.post('/api/reset'); toast('info', 'System reset', 'All structures re-initialised.'); await refresh(); }
      catch (e) { toast('error', 'Reset failed', e.message); }
    }));
  $('confirmedTable').addEventListener('click', handleRowActions);
  $('queueVisual').addEventListener('click', handleRowActions);
  $('modalClose').addEventListener('click', closeModal);
  $('modalBackdrop').addEventListener('click', (e) => { if (e.target === $('modalBackdrop')) closeModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });
}

function handleRowActions(e) {
  const btn = e.target.closest('button');
  if (!btn) return;
  if (btn.dataset.viewPnr) openDetail(Number(btn.dataset.viewPnr));
  if (btn.dataset.cancelPnr) confirmCancel(Number(btn.dataset.cancelPnr));
}

/* ============================ booking ============================ */

let bookBusy = false;

async function onBook(e) {
  e.preventDefault();
  if (bookBusy) return;
  bookBusy = true;
  const btn = $('bookBtn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spin"></span> Processing…';
  $('bookResult').innerHTML = '<div class="processing"><span class="spin dark"></span><p>Checking berth availability…</p></div>';
  try {
    const { result } = await API.post('/api/book', {
      name: $('bName').value, age: $('bAge').value,
      gender: $('bGender').value, trainNo: $('bTrain').value
    });
    await refresh();
    renderBookResult(result);
    toast(result.status === 'CONFIRMED' ? 'success' : 'info',
      result.status === 'CONFIRMED' ? 'Reservation confirmed' : 'Added to waiting list',
      `PNR ${result.passenger.pnr} — ${esc(result.passenger.name)}`);
    $('bookForm').reset();
    $('bTrain').value = state.trainNo;
  } catch (err) {
    $('bookResult').innerHTML = `<div class="result err"><h3>Booking failed</h3><p>${esc(err.message)}</p></div>`;
    toast('error', 'Booking failed', esc(err.message));
  } finally {
    bookBusy = false;
    btn.disabled = false;
    btn.textContent = 'Book Reservation';
  }
}

function renderBookResult(r) {
  const p = r.passenger;
  if (r.status === 'CONFIRMED') {
    $('bookResult').innerHTML = `
      <div class="result ok">
        <div class="result-icon">✓</div>
        <h3>Reservation Confirmed</h3>
        <div class="pnr-big">PNR ${p.pnr}</div>
        <dl class="kv">${kv([
          ['Passenger', esc(p.name)], ['Train', p.trainNo],
          ['Age / Gender', `${p.age} / ${p.gender}`],
          ['Status', badge('CONFIRMED')],
          ['Berths remaining', state.availableSeats]
        ])}</dl>
      </div>`;
  } else {
    $('bookResult').innerHTML = `
      <div class="result wait">
        <div class="result-icon">⏳</div>
        <h3>Added to Waiting List</h3>
        <div class="pnr-big">PNR ${p.pnr}</div>
        <dl class="kv">${kv([
          ['Passenger', esc(p.name)],
          ['Waiting position', `WL #${r.position} of ${state.waitingCount}`],
          ['Confirmed berths', `${state.confirmedCount} of ${state.totalSeats}`],
          ['Status', badge('WAITING')]
        ])}</dl>
        <p class="hint">You will be promoted automatically — in strict FIFO order — as soon as a berth is freed by a cancellation.</p>
      </div>`;
  }
}

/* ============================ cancel / undo ============================ */

function confirmCancel(pnr) {
  const p = findPassenger(pnr);
  confirmDialog('Cancel reservation',
    `Cancel PNR <b class="mono">${pnr}</b>${p ? ` — <b>${esc(p.name)}</b>` : ''}?<br>
     A freed berth will be offered to the longest-waiting passenger automatically.`,
    async () => {
      try {
        const { result } = await API.post('/api/cancel', { pnr });
        toast('success', 'Reservation cancelled', result.promoted
          ? `PNR ${result.promoted.pnr} (${esc(result.promoted.name)}) promoted to CONFIRMED.`
          : 'No waiting passengers to promote.');
        await refresh();
        if (result.promoted) flashRow(result.promoted.pnr);
      } catch (err) { toast('error', 'Cancellation failed', esc(err.message)); }
    });
}

async function onUndo() {
  try {
    const { result } = await API.post('/api/undo');
    toast('info', 'Action reversed', esc(result.message));
    await refresh();
  } catch (err) { toast('error', 'Undo failed', esc(err.message)); }
}

function flashRow(pnr) {
  const row = document.querySelector(`tr[data-pnr="${pnr}"]`);
  if (row) { row.classList.add('flash'); setTimeout(() => row.classList.remove('flash'), 1700); }
}

/* ============================ search ============================ */

async function onSearch(e) {
  e.preventDefault();
  const value = $('searchInput').value.trim();
  if (!value) return;
  $('searchResult').innerHTML = '<div class="processing"><span class="spin dark"></span><p>Running linear search…</p></div>';
  $('searchTrail').innerHTML = '';
  try {
    const { result } = await API.post('/api/search', { type: searchMode, value });
    if (result.found) {
      const p = result.passenger;
      $('searchResult').innerHTML = `<div class="result ok">
        <h3>Match found</h3>
        <dl class="kv">${kv([
          ['PNR', p.pnr], ['Passenger', esc(p.name)], ['Train', p.trainNo],
          ['Age / Gender', `${p.age} / ${p.gender}`],
          ['Found in', result.where === 'confirmed list' ? 'Confirmed linked list' : 'Waiting queue'],
          ['Status', badge(p.status === 1 ? 'CONFIRMED' : 'WAITING') +
            (result.waitingPosition ? ` <span class="pos">WL #${result.waitingPosition}</span>` : '')],
          ['Nodes visited', result.nodesVisited]
        ])}</dl></div>`;
    } else {
      $('searchResult').innerHTML = `<div class="result none"><h3>Not found</h3>
        <p>No reservation matches <b>${esc(value)}</b> in the confirmed list or the waiting queue.</p>
        <p class="hint">Linear search visited ${result.nodesVisited} node(s) before reaching the end of both structures.</p></div>`;
    }
    renderTrail(result);
  } catch (err) {
    $('searchResult').innerHTML = `<div class="result err"><h3>Search failed</h3><p>${esc(err.message)}</p></div>`;
  }
}

function renderTrail(result) {
  const trail = result.trail || [];
  const confCount = state ? state.confirmed.length : 0;
  if (!trail.length) {
    $('searchTrail').innerHTML = `<h3 class="mini-title">Traversal</h3>
      <div class="trail-wrap"><span class="ptr-chip">HEAD</span><span class="ptr-chip null">NULL</span></div>
      <p class="hint">Both structures were empty — zero nodes visited.</p>`;
    return;
  }
  let html = `<h3 class="mini-title">Linear-search traversal · ${result.nodesVisited} node(s) visited</h3>
    <div class="trail-wrap"><span class="ptr-chip">HEAD</span>`;
  trail.forEach((label, i) => {
    if (i === confCount && trail.length > confCount) {
      html += '<span class="ptr-chip null small">→ WAITING QUEUE</span>';
    }
    const isMatch = result.found && i === trail.length - 1;
    html += `<span class="trail-chip${isMatch ? ' match' : ''}${i >= confCount ? ' wq' : ''}">${isMatch ? '✔ ' : ''}${esc(label)}</span>`;
  });
  html += `<span class="ptr-chip null">${result.found ? 'MATCH' : 'NULL'}</span></div>`;
  $('searchTrail').innerHTML = html;
}

/* ============================ sort ============================ */

async function onSort() {
  const key = $('sortKey').value;
  const btn = $('sortBtn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spin"></span> Sorting…';
  try {
    const { result } = await API.post('/api/sort', { key });
    $('sortStats').textContent =
      `Insertion sort by ${result.keyLabel} — ${result.comparisons} key comparisons, ` +
      `${result.after.length} nodes relinked in place (O(1) extra space).`;
    $('sortCompare').innerHTML = `
      <div class="card inner"><h3 class="mini-title">Before</h3>${chipList(result.before, key)}</div>
      <div class="card inner"><h3 class="mini-title">After</h3>${chipList(result.after, key)}</div>`;
    await refresh();
    toast('success', 'Sort complete', `Confirmed list ordered by ${result.keyLabel}.`);
  } catch (err) {
    toast('error', 'Sort failed', esc(err.message));
  } finally {
    btn.disabled = false;
    btn.textContent = 'Apply Insertion Sort';
  }
}

function keyLabel(p, key) {
  if (key === 'name') return p.name;
  if (key === 'bookingTime') return '#' + p.bookingTime;
  return String(p.pnr);
}

function chipList(rows, key) {
  if (!rows.length) return '<div class="empty"><p>List is empty.</p></div>';
  return '<div class="trail-wrap">' +
    rows.map((p) => `<span class="trail-chip">${esc(keyLabel(p, key))}</span>`).join('<span class="link-arrow"></span>') +
    '</div>';
}

/* ============================ renderers ============================ */

function renderPills() {
  $('pillTrain').textContent = state.trainNo;
  $('pillSeats').textContent = `${state.confirmedCount}/${state.totalSeats}`;
  $('pillWaiting').textContent = state.waitingCount;
}

function renderDashboard() {
  const lb = state.lastBooking, lc = state.lastCancellation;
  $('statGrid').innerHTML = [
    statCard('Confirmed Berths', `${state.confirmedCount}`, `of ${state.totalSeats} total`, state.confirmedCount ? 'ok' : 'muted'),
    statCard('Available Berths', `${state.availableSeats}`, 'ready to allocate', 'muted'),
    statCard('Waiting Passengers', `${state.waitingCount}`, `FIFO queue · max ${state.maxWaiting}`, state.waitingCount ? 'warn' : 'muted'),
    statCard('Total Reservations', `${state.totalReservations}`, 'confirmed + waiting', 'muted'),
    statCard('Latest Booking', lb ? `<span class="mono">${lb.pnr}</span>` : '—', lb ? timeAgo(lb.at) : 'no bookings yet', 'muted'),
    statCard('Latest Cancellation', lc ? `<span class="mono">${lc.pnr}</span>` : '—', lc ? timeAgo(lc.at) : 'no cancellations yet', 'muted')
  ].join('');

  let segs = '';
  for (let i = 0; i < state.totalSeats; i++) segs += `<span class="berth${i < state.confirmedCount ? ' filled' : ''}"></span>`;
  $('seatGauge').innerHTML =
    `<div class="seat-row">${segs}</div>
     <div class="seat-legend"><span><i class="filled"></i>reserved</span><span><i></i>free</span></div>`;
  $('occChip').textContent = `${state.confirmedCount} of ${state.totalSeats} berths reserved`;

  $('trainInfo').innerHTML = kv([
    ['Train number', state.trainNo],
    ['Total berths', state.totalSeats],
    ['Waiting capacity', state.maxWaiting],
    ['Booking tokens issued', state.bookingClock],
    ['Actions on undo stack', state.historySize],
    ['System uptime', fmtDuration(state.uptimeSec)]
  ]);

  $('dashConfirmed').innerHTML = passengerTable(state.confirmed.slice(0, 5),
    { compact: true, emptyText: 'No confirmed reservations yet.' });

  $('dashQueue').innerHTML = state.waiting.length
    ? state.waiting.slice(0, 6).map((p, i) =>
        `<span class="q-chip">WL ${i + 1} · ${p.pnr} · ${esc(p.name)}</span>`).join('') +
      (state.waiting.length > 6 ? `<span class="q-chip more">+${state.waiting.length - 6} more</span>` : '')
    : '<div class="empty"><p>Waiting queue is empty.</p></div>';

  $('dashActivity').innerHTML = timeline(state.activity.slice(0, 6));
}

function renderConfirmed() {
  $('confirmedTable').innerHTML = passengerTable(state.confirmed,
    { emptyText: 'No confirmed reservations — book a passenger to fill the first berth.' });
  $('confCount').textContent = `${state.confirmedCount} of ${state.totalSeats} berths`;
}

function renderWaiting() {
  $('waitCount').textContent = `${state.waitingCount} waiting · max ${state.maxWaiting}`;
  const el = $('queueVisual');
  if (!state.waiting.length) {
    el.innerHTML = '<div class="empty"><div class="empty-icon">⌀</div><p>Waiting queue is empty — every waiting passenger has been promoted.</p></div>';
    return;
  }
  const nodes = state.waiting.map((p, i) => `
    <div class="q-node">
      <span class="q-pos">WL #${i + 1}</span>
      <b class="mono">${p.pnr}</b>
      <span class="q-name">${esc(p.name)}</span>
      <span class="q-meta">${p.age} · ${p.gender}</span>
      <div><button class="btn-mini" data-view-pnr="${p.pnr}" type="button">View</button>
      <button class="btn-mini danger" data-cancel-pnr="${p.pnr}" type="button">Cancel</button></div>
    </div>`).join('<span class="link-arrow"></span>');
  el.innerHTML =
    `<span class="q-cap">FRONT<small>dequeue</small></span>${nodes}<span class="q-cap rear">REAR<small>enqueue</small></span>`;
}

function renderStackAndActivity() {
  const stack = state.stack;
  $('stackVisual').innerHTML = !stack.length
    ? '<div class="empty"><p>Action stack is empty — nothing to undo.</p></div>'
    : '<div class="stack-top-label">TOP — most recent action (next to undo)</div>' +
      stack.map((a, i) => `
        <div class="stk-item ${a.type}${i === 0 ? ' top' : ''}">
          <div class="stk-main">
            <span class="badge ${a.type === 'BOOK' ? 'ok' : 'danger'}">${a.type}</span>
            <b class="mono">PNR ${a.passenger.pnr}</b>
            <span class="stk-name">${esc(a.passenger.name)}</span>
          </div>
          <div class="stk-side">
            <span class="stk-detail">${esc(a.detail || '')}${a.promoted ? ` · promoted PNR ${a.promoted.pnr}` : ''}</span>
            <span class="tl-time">${timeAgo(a.at)}</span>
          </div>
        </div>`).join('') +
      `<div class="stack-bottom-label">bottom of stack (${stack.length} action${stack.length > 1 ? 's' : ''})</div>`;
  $('activityFull').innerHTML = timeline(state.activity);
}

function renderDataStructures() {
  const conf = state.confirmed, wait = state.waiting, st = state.stack;
  $('dsList').innerHTML = conf.length
    ? '<span class="ptr-chip">HEAD</span>' +
      conf.map((p) => `<div class="dsnode"><div class="cell"><b class="mono">${p.pnr}</b><span class="ds-name">${esc(p.name)}</span></div><div class="next">next</div></div>`).join('<span class="link-arrow"></span>') +
      '<span class="ptr-chip null">TAIL → NULL</span>'
    : '<div class="empty"><p>HEAD → NULL (empty list)</p></div>';
  $('dsQueue').innerHTML = wait.length
    ? '<span class="ptr-chip">FRONT</span>' +
      wait.map((p) => `<div class="dsnode q"><div class="cell"><b class="mono">${p.pnr}</b><span class="ds-name">${esc(p.name)}</span></div><div class="next">next</div></div>`).join('<span class="link-arrow"></span>') +
      '<span class="ptr-chip">REAR</span>'
    : '<div class="empty"><p>FRONT = REAR = NULL (empty queue)</p></div>';
  $('dsStack').innerHTML = st.length
    ? '<span class="ptr-chip">TOP</span><div class="stack-col">' +
      st.map((a) => `<div class="stk-mini ${a.type}"><b>${a.type}</b><span class="mono">PNR ${a.passenger.pnr}</span></div>`).join('') +
      '</div><span class="ptr-chip null">BASE</span>'
    : '<div class="empty"><p>TOP → NULL (empty stack)</p></div>';
}

function renderSystem() {
  $('sysChip').textContent = 'CONNECTED';
  $('sysChip').className = 'chip ok';
  $('sysStatus').innerHTML = kv([
    ['Backend', 'CONNECTED — HTTP API responding'],
    ['Confirmed linked list', `ACTIVE — ${state.confirmedCount} node(s)`],
    ['Waiting queue', `ACTIVE — ${state.waitingCount} node(s)`],
    ['Action stack', `ACTIVE — ${state.historySize} action(s)`],
    ['Search module', 'READY — linear search'],
    ['Sort module', 'READY — insertion sort'],
    ['Uptime', fmtDuration(state.uptimeSec)]
  ]);
  $('sysConfig').innerHTML = kv([
    ['Train number', state.trainNo],
    ['Berth capacity', state.totalSeats],
    ['Waiting capacity', state.maxWaiting],
    ['PNRs generated', state.bookingClock]
  ]);
}

function renderStaticDS() {
  $('complexityTable').innerHTML = `
    <table class="tbl"><thead><tr><th>Operation</th><th>Data structure</th><th>Time</th><th>Space</th></tr></thead><tbody>
      <tr><td>Book (berth free)</td><td>Singly linked list — tail insert</td><td class="mono">O(1)</td><td class="mono">O(1)</td></tr>
      <tr><td>Book (waiting)</td><td>Linked queue — enqueue at rear</td><td class="mono">O(1)</td><td class="mono">O(1)</td></tr>
      <tr><td>Cancel + auto-promote</td><td>Linear search + unlink + dequeue</td><td class="mono">O(n)</td><td class="mono">O(1)</td></tr>
      <tr><td>Undo last action</td><td>Linked stack — pop (O(1)) + possible O(n) re-insert</td><td class="mono">O(1)*</td><td class="mono">O(1)</td></tr>
      <tr><td>Search by PNR / name</td><td>Linear (sequential) search</td><td class="mono">O(n)</td><td class="mono">O(1)</td></tr>
      <tr><td>Sort confirmed list</td><td>Insertion sort (node relinking)</td><td class="mono">O(n) best / O(n²) worst</td><td class="mono">O(1)</td></tr>
      <tr><td>Traverse / display</td><td>Linked list / queue</td><td class="mono">O(n)</td><td class="mono">O(1)</td></tr>
    </tbody></table>
    <p class="hint">* The pop itself is O(1); reversing the action may re-insert a passenger at a recorded queue position, which is a single O(n) traversal.</p>`;

  $('coCards').innerHTML = [
    coCard('CO1', 'ADT & Linked Lists',
      'Confirmed reservations live in a singly linked list with head and tail pointers. Booking appends at the tail in O(1); cancellation unlinks head, middle or tail nodes correctly. A second linked list keeps the activity timeline.',
      'insert · delete · traverse · search · update'),
    coCard('CO2', 'Stack & Queue',
      'The waiting list is a linked queue (front/rear, FIFO) so the longest-waiting passenger is always promoted first. The action history is a linked stack (LIFO) powering one-click undo, including reversing promotions.',
      'enqueue · dequeue · push · pop · peek'),
    coCard('CO3', 'Searching & Sorting',
      'Linear search locates reservations by PNR or name — sequential traversal is the correct choice for linked storage with no random access. Insertion sort relinks the confirmed list into order with O(1) extra space.',
      'linear search · insertion sort')
  ].join('');
}

/* ============================ detail modal ============================ */

function openDetail(pnr) {
  const p = findPassenger(pnr);
  if (!p) return toast('error', 'Not found', `PNR ${pnr} no longer exists.`);
  const waiting = p.status === 0;
  const pos = waiting ? waitingPos(pnr) : null;
  openModal(`Reservation — PNR ${p.pnr}`, `
    <dl class="kv">${kv([
      ['PNR', p.pnr], ['Passenger', esc(p.name)], ['Train', p.trainNo],
      ['Age', p.age], ['Gender', p.gender],
      ['Booking token', '#' + p.bookingTime],
      ['Booked at', p.bookedAt ? new Date(p.bookedAt).toLocaleString() : '—'],
      ['Status', badge(waiting ? 'WAITING' : 'CONFIRMED') + (pos ? ` <span class="pos">WL #${pos}</span>` : '')]
    ])}</dl>
    <div class="modal-form">
      <h4>Update passenger details</h4>
      <div class="form-row">
        <label for="uAge">Age <input type="number" id="uAge" min="1" max="120" value="${p.age}"></label>
        <label for="uGender">Gender
          <select id="uGender">
            <option ${p.gender === 'M' ? 'selected' : ''}>M</option>
            <option ${p.gender === 'F' ? 'selected' : ''}>F</option>
            <option ${p.gender === 'O' ? 'selected' : ''}>O</option>
          </select>
        </label>
      </div>
      <div class="btn-row">
        <button class="btn btn-primary" id="uSave" type="button">Save changes</button>
        <button class="btn btn-danger" id="uCancelRes" type="button">Cancel reservation</button>
      </div>
    </div>`);
  $('uSave').addEventListener('click', async () => {
    try {
      await API.post('/api/update', { pnr, age: $('uAge').value, gender: $('uGender').value });
      toast('success', 'Reservation updated', `PNR ${pnr} details saved.`);
      closeModal();
      await refresh();
    } catch (err) { toast('error', 'Update failed', esc(err.message)); }
  });
  $('uCancelRes').addEventListener('click', () => { closeModal(); confirmCancel(pnr); });
}

/* ============================ modal / toast helpers ============================ */

function openModal(title, bodyHTML) {
  $('modalTitle').innerHTML = title;
  $('modalBody').innerHTML = bodyHTML;
  $('modalBackdrop').hidden = false;
}
function closeModal() { $('modalBackdrop').hidden = true; }

function confirmDialog(title, messageHTML, onConfirm) {
  openModal(title, `
    <div class="confirm-body"><p>${messageHTML}</p>
      <div class="btn-row">
        <button class="btn" id="mCancel" type="button">Keep reservation</button>
        <button class="btn btn-danger" id="mConfirm" type="button">Yes, cancel it</button>
      </div></div>`);
  $('mCancel').addEventListener('click', closeModal);
  $('mConfirm').addEventListener('click', async () => { closeModal(); await onConfirm(); });
}

function toast(type, title, message) {
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.innerHTML = `<strong>${esc(title)}</strong>${message ? `<span>${message}</span>` : ''}`;
  $('toasts').appendChild(el);
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 320); }, 4200);
}

/* ============================ small helpers ============================ */

function findPassenger(pnr) {
  return (state.confirmed.find((p) => p.pnr === pnr)) ||
         (state.waiting.find((p) => p.pnr === pnr)) || null;
}
function waitingPos(pnr) {
  const i = state.waiting.findIndex((p) => p.pnr === pnr);
  return i >= 0 ? i + 1 : null;
}
function badge(text) {
  const cls = text === 'CONFIRMED' ? 'ok' : text === 'WAITING' ? 'warn' : text === 'CANCELLED' ? 'danger' : 'muted';
  return `<span class="badge ${cls}">${text}</span>`;
}
function statCard(label, value, sub, tone) {
  return `<div class="stat"><span class="stat-label">${label}</span>
    <span class="stat-value${tone === 'ok' ? ' ok' : tone === 'warn' ? ' warn' : ''}">${value}</span>
    <span class="stat-sub">${sub}</span></div>`;
}
function kv(pairs) {
  return pairs.map(([k, v]) => `<div class="kv-row"><dt>${k}</dt><dd>${v}</dd></div>`).join('');
}
function passengerTable(rows, opts = {}) {
  const { compact = false, emptyText = 'No records to display.' } = opts;
  if (!rows.length) return `<div class="empty"><div class="empty-icon">▦</div><p>${emptyText}</p></div>`;
  const head = compact
    ? '<tr><th>PNR</th><th>Passenger</th><th>Age</th><th>Status</th></tr>'
    : '<tr><th>PNR</th><th>Passenger</th><th>Train</th><th>Age</th><th>Gender</th><th>Booked</th><th>Status</th><th class="th-actions">Actions</th></tr>';
  const body = rows.map((p) => compact
    ? `<tr data-pnr="${p.pnr}"><td class="mono">${p.pnr}</td><td>${esc(p.name)}</td><td>${p.age}</td><td>${badge('CONFIRMED')}</td></tr>`
    : `<tr data-pnr="${p.pnr}">
         <td class="mono">${p.pnr}</td><td>${esc(p.name)}</td><td class="mono">${p.trainNo}</td>
         <td>${p.age}</td><td>${p.gender}</td>
         <td class="mono" title="${esc(p.bookedAt || '')}">#${p.bookingTime}</td>
         <td>${badge('CONFIRMED')}</td>
         <td class="td-actions">
           <button class="btn-mini" data-view-pnr="${p.pnr}" type="button">View</button>
           <button class="btn-mini danger" data-cancel-pnr="${p.pnr}" type="button">Cancel</button>
         </td></tr>`).join('');
  return `<table class="tbl"><thead>${head}</thead><tbody>${body}</tbody></table>`;
}
function timeline(items) {
  if (!items || !items.length) return '<li class="tl-empty">No activity yet.</li>';
  const cls = { BOOK: 'ok', CANCEL: 'danger', PROMOTION: 'info', UNDO: 'warn', SYSTEM: 'muted', SORT: 'info', UPDATE: 'info' };
  return items.map((a) => `
    <li class="tl-item">
      <span class="tl-badge ${cls[a.type] || 'muted'}">${esc(a.type.slice(0, 5))}</span>
      <div class="tl-body"><p>${esc(a.message)}</p><span class="tl-time">${timeAgo(a.at)}</span></div>
    </li>`).join('');
}
function coCard(code, title, text, ops) {
  return `<div class="card co-card"><span class="co-code">${code}</span><h3>${title}</h3>
    <p>${text}</p><p class="co-ops"><b>Key operations:</b> ${ops}</p></div>`;
}
function timeAgo(iso) {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 10) return 'just now';
  if (s < 60) return s + 's ago';
  const m = Math.floor(s / 60);
  if (m < 60) return m + ' min ago';
  const h = Math.floor(m / 60);
  if (h < 24) return h + 'h ago';
  return new Date(iso).toLocaleDateString();
}
function fmtDuration(sec) {
  sec = Number(sec) || 0;
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return h ? `${h}h ${m}m` : (m ? `${m}m ${s}s` : `${s}s`);
}