// TiketKita frontend: calls the REST API
const API = 'http://localhost/event-api/api';

const state = { token: null, user: null, view: 'home', infoTab: 'manual', page: 1, filters: { search: '', city: '', date: '' } };

// Helpers

const $ = (sel) => document.querySelector(sel);

// Sort rows by id
const byId = (rows) => [...rows].sort((a, b) => a.id - b.id);

// Escape text for HTML
function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
const money = (n) => 'RM ' + Number(n).toFixed(2);
const fmtDate = (d) => new Date(d + 'T00:00:00').toLocaleDateString('en-MY', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
const fmtTime = (t) => t.slice(0, 5);

function toast(msg, bad = false) {
  const t = $('#toast');
  t.textContent = msg;
  t.className = 'toast' + (bad ? ' bad' : '');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.add('hidden'), 3200);
}

// Call the API and return the JSON
async function api(method, path, body) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (state.token) headers['Authorization'] = 'Bearer ' + state.token;

  let res;
  try {
    res = await fetch(API + path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  } catch (e) {
    throw { message: 'Cannot reach the API at ' + API + '. Is Apache running?', code: 0 };
  }
  const json = await res.json().catch(() => null);
  if (!json || !json.success) {
    const err = (json && json.error) || { message: 'Unexpected response', code: res.status };
    if (res.status === 401 && state.token) { logoutLocal(); }   // Token is no longer valid
    throw err;
  }
  return json;
}

// Turn an API error into text
function errText(e) {
  const labels = { 401: 'Please log in', 403: 'Not allowed', 404: 'Not found', 409: 'Conflict', 422: 'Invalid input', 429: 'Too many requests' };
  let t = (labels[e.code] ? labels[e.code] + ' (' + e.code + '): ' : '') + (e.message || 'Something went wrong');
  if (e.details) t += ' - ' + Object.values(e.details).join('; ');
  return t;
}

// Icons (Lucide-style inline SVG)
const ICONS = {
  ticket: '<path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><path d="M13 5v2M13 17v2M13 11v2"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  pin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
  calendar: '<rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
  moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
  shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
  layout: '<rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/>',
  inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
  zap: '<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/>',
  cloud: '<path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/>',
  music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
  briefcase: '<rect width="20" height="14" x="2" y="7" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>',
  tent: '<path d="M3.5 21 14 3M20.5 21 10 3M15.5 21 12 15l-3.5 6M2 21h20"/>',
  trophy: '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22M18 2H6v7a6 6 0 0 0 12 0V2Z"/>',
  utensils: '<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2M7 2v20M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/>',
  mic: '<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v3"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  book: '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
  help: '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01"/>',
  chevron: '<path d="m6 9 6 6 6-6"/>',
  arrow: '<path d="M5 12h14M12 5l7 7-7 7"/>',
  building: '<rect width="16" height="20" x="4" y="2" rx="2"/><path d="M9 22v-4h6v4M8 6h.01M16 6h.01M12 6h.01M12 10h.01M12 14h.01M16 10h.01M16 14h.01M8 10h.01M8 14h.01"/>',
  grid: '<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>',
};
const ic = (name, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ''}</svg>`;
// Fill static <i data-ic="name"> placeholders
function paintIcons(root = document) {
  root.querySelectorAll('i[data-ic]').forEach((el) => { el.outerHTML = ic(el.dataset.ic); });
}

// Event photos: matched to the seeded events, other events cycle through the set
const PHOTOS = ['image 1.jpg', 'image 2.jpg', 'image 3.jpg', 'image 4.jpg', 'image 5.jpg', 'image 6.jpg', 'image 7.jpg', 'image 8.jpg'];
const PHOTO_BY_EVENT = { 1: 0, 2: 3, 3: 7, 4: 2, 5: 6, 6: 4, 7: 5 };
const photoUrl = (e) => encodeURI(PHOTOS[PHOTO_BY_EVENT[e.id] ?? (e.id % PHOTOS.length)]);

// Category tag (icon + label) guessed from the title and description
function eventTheme(e) {
  const t = (e.title + ' ' + (e.description || '')).toLowerCase();
  const rules = [
    [/concert|konsert|symphony|orchestra|jazz|band|gig|dj/, 'music', 'Concert'],
    [/festival|fest|carnival|fair|cultural/, 'tent', 'Festival'],
    [/conference|summit|tech|startup|expo|seminar|workshop|forum/, 'briefcase', 'Conference'],
    [/marathon|run|football|sport|futsal|badminton|race|cup/, 'trophy', 'Sports'],
    [/food|cook|culinary|dinner/, 'utensils', 'Food'],
    [/comedy|stand-up|theatre|theater|dance|show/, 'mic', 'Show'],
  ];
  const hit = rules.find(([re]) => re.test(t));
  return { icon: hit ? hit[1] : 'ticket', label: hit ? hit[2] : 'Event' };
}
const emptyState = (icon, title, text = '') => `<div class="empty"><span class="big">${ic(icon)}</span><b>${esc(title)}</b>${text ? '<br>' + esc(text) : ''}</div>`;
const skeletons = (n = 6) => `<div class="grid">${'<div class="skel"></div>'.repeat(n)}</div>`;
const pageHead = (icon, title, sub) => `<div class="page-head"><span class="ico">${ic(icon)}</span><h1>${title}</h1></div><p class="sub">${sub}</p>`;

function badge(status) { return `<span class="badge b-${esc(status)}">${esc(status)}</span>`; }

// Session

function saveSession() {
  try { localStorage.setItem('tk_session', JSON.stringify({ token: state.token, user: state.user })); } catch (e) {}
}
function logoutLocal() {
  state.token = null; state.user = null; saveSession(); renderChrome();
  if (['mybookings', 'organiser', 'admin'].includes(state.view)) go('events');
}
function loadSession() {
  try {
    const s = JSON.parse(localStorage.getItem('tk_session') || 'null');
    if (s && s.token) { state.token = s.token; state.user = s.user; }
  } catch (e) {}
}

// Theme (light / dark), saved in the browser only

function applyTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
  const b = $('#themeToggle');
  if (b) {
    b.innerHTML = ic(t === 'dark' ? 'sun' : 'moon');
    b.setAttribute('aria-label', t === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
  }
}
function toggleTheme() {
  const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  try { localStorage.setItem('tk_theme', next); } catch (e) {}
  applyTheme(next);
}

// Header and navigation

function renderChrome() {
  const u = state.user;
  const links = [['home', 'Home'], ['events', 'Events'], ['info', 'Info']];
  if (u && u.role === 'customer') links.push(['mybookings', 'My bookings']);
  if (u && (u.role === 'organiser' || u.role === 'admin')) links.push(['organiser', 'Manage events']);
  if (u && u.role === 'admin') links.push(['admin', 'Admin']);

  $('#nav').innerHTML = links.map(([v, label]) =>
    `<a href="#" data-view="${v}" class="${state.view === v ? 'active' : ''}">${label}</a>`).join('');

  $('#userbox').innerHTML = u
    ? `<span>${esc(u.name.split(' ')[0])}</span><span class="role">${esc(u.role)}</span><button class="ghost small" id="btnLogout">Log out</button>`
    : `<button class="ghost small" id="btnLogin">Log in</button><button class="small" id="btnRegister">Sign up</button>`;
}

const VIEWS = () => ({ home: viewHome, events: viewEvents, info: viewInfo, mybookings: viewMyBookings, organiser: viewOrganiser, admin: viewAdmin });

function go(view, fromHistory = false) {
  const views = VIEWS();
  if (!views[view]) view = 'home';
  state.page = 1;
  state.view = view;
  document.documentElement.setAttribute('data-route', view); // the live wallpaper only shows on home and events (wallpaper.js, style.css). Not data-view: the click handler below treats every [data-view] as a nav link, <html> included.
  if (!fromHistory && location.hash !== '#' + view) history.pushState(null, '', '#' + view);
  renderChrome();
  window.scrollTo(0, 0);
  views[view]();
}
window.addEventListener('popstate', () => go(location.hash.slice(1) || 'home', true));

// Handle all link and header clicks
document.addEventListener('click', (e) => {
  const info = e.target.closest('[data-info]');
  if (info) { e.preventDefault(); state.infoTab = info.dataset.info; go('info'); return; }
  const link = e.target.closest('[data-view]');
  if (link) { e.preventDefault(); go(link.dataset.view); return; }
  if (e.target.id === 'btnLogin') showAuth('login');
  if (e.target.id === 'btnRegister') showAuth('register');
  if (e.target.id === 'btnLogout') doLogout();
  if (e.target.closest('#themeToggle')) toggleTheme();
  if (e.target.id === 'modalClose' || e.target.id === 'modal') closeModal();
});

async function doLogout() {
  try { await api('POST', '/auth/logout'); } catch (e) {}
  logoutLocal();
  toast('Logged out');
}

// Modal

function openModal(html) { $('#modalBody').innerHTML = html; $('#modal').classList.remove('hidden'); }
function closeModal() { $('#modal').classList.add('hidden'); $('#modalBody').innerHTML = ''; }

function showAuth(mode) {
  const reg = mode === 'register';
  openModal(`
    <h2 style="margin-top:0">${reg ? 'Create account' : 'Log in'}</h2>
    <form id="authForm">
      ${reg ? '<label>Full name</label><input name="name" required maxlength="100">' : ''}
      <label>Email</label><input name="email" type="email" required>
      <label>Password</label><input name="password" type="password" required ${reg ? 'minlength="8"' : ''}>
      ${reg ? '<div class="hint">At least 8 characters. New accounts are customers.</div>' : ''}
      <div id="authErr" class="err"></div>
      <p><button type="submit">${reg ? 'Sign up' : 'Log in'}</button>
         <button type="button" class="ghost" id="switchAuth">${reg ? 'I have an account' : 'Create an account'}</button></p>
      ${reg ? '' : `<div class="hint"><b>Demo accounts</b> (password in README):<br>
        <a href="#" class="demo" data-e="admin@eventapi.my" data-p="Admin@123">admin</a> ·
        <a href="#" class="demo" data-e="weiming@eventapi.my" data-p="Organiser@123">organiser</a> ·
        <a href="#" class="demo" data-e="haziq@eventapi.my" data-p="Customer@123">customer</a></div>`}
    </form>`);

  $('#switchAuth').onclick = () => showAuth(reg ? 'login' : 'register');
  document.querySelectorAll('.demo').forEach((a) => a.onclick = (ev) => {
    ev.preventDefault();
    const f = $('#authForm'); f.email.value = a.dataset.e; f.password.value = a.dataset.p;
  });

  $('#authForm').onsubmit = async (ev) => {
    ev.preventDefault();
    const f = ev.target;
    $('#authErr').textContent = '';
    try {
      if (reg) {
        await api('POST', '/auth/register', { name: f.elements.name.value, email: f.email.value, password: f.password.value });
      }
      const r = await api('POST', '/auth/login', { email: f.email.value, password: f.password.value });
      state.token = r.data.token; state.user = r.data.user; saveSession();
      closeModal(); toast('Welcome, ' + state.user.name.split(' ')[0] + '!');
      go(state.user.role === 'customer' ? 'events' : state.user.role === 'admin' ? 'admin' : 'organiser');
    } catch (e) { $('#authErr').textContent = errText(e); }
  };
}

// Pager

function pagerHtml(p) {
  if (!p || p.total_pages <= 1) return `<div class="pager">${p ? p.total : 0} result(s)</div>`;
  return `<div class="pager">
    <button class="ghost small" data-page="${p.page - 1}" ${p.page <= 1 ? 'disabled' : ''}>&larr; Prev</button>
    <span>Page ${p.page} of ${p.total_pages} (${p.total} total)</span>
    <button class="ghost small" data-page="${p.page + 1}" ${p.page >= p.total_pages ? 'disabled' : ''}>Next &rarr;</button></div>`;
}

// Events view

async function viewEvents() {
  const f = state.filters;
  $('#app').innerHTML = `
    <div class="hero-band">
      <section class="hero" style="--hero:url('${photoUrl({ id: 1 })}')">
        <h1>Find your next <em>unforgettable</em> event</h1>
        <p>Concerts, festivals and conferences across Malaysia, all in one place.</p>
      </section>
      <div class="search-wrap">
        <div class="cat-tabs">${[['grid', 'All', ''], ['music', 'Concerts', 'Concert'], ['tent', 'Festivals', 'Festival'], ['briefcase', 'Conferences', 'Conference'], ['mic', 'Shows', 'Show']].map(([i, label, q]) =>
          `<button type="button" class="${f.search.toLowerCase() === q.toLowerCase() ? 'on' : ''}" data-q="${q}">${ic(i)}${label}</button>`).join('')}</div>
        <form class="filters" id="filterForm">
          <div class="field">${ic('search')}<div><label>Search</label><input name="search" placeholder="Event, artist or venue" value="${esc(f.search)}"></div></div>
          <div class="field">${ic('pin')}<div><label>City</label><select name="city"><option value="">All cities</option></select></div></div>
          <div class="field">${ic('calendar')}<div><label>Date</label><input name="date" type="date" value="${esc(f.date)}"></div></div>
          <div class="actions"><button type="submit" class="go">${ic('search')}Search</button><button type="button" class="ghost" id="clearF">Clear</button></div>
        </form>
      </div>
    </div>
    <div class="perks">
      <div class="perk"><span class="pi">${ic('zap')}</span><div><b>Instant confirmation</b><span>Your booking is confirmed straight away</span></div></div>
      <div class="perk"><span class="pi">${ic('cloud')}</span><div><b>Weather forecast</b><span>Plan ahead with the forecast for every event</span></div></div>
      <div class="perk"><span class="pi">${ic('ticket')}</span><div><b>Flexible tickets</b><span>Cancel a booking and the tickets are released</span></div></div>
    </div>
    <div class="section-title"><h2>Upcoming events</h2></div>
    <div id="list"></div>`;

  document.querySelectorAll('.cat-tabs button').forEach((c) => c.onclick = () => {
    state.filters.search = c.dataset.q; state.page = 1; viewEvents();
  });

  // Fill the city list
  try {
    const v = await api('GET', '/venues?limit=100');
    const cities = [...new Set(v.data.map((x) => x.city))].sort();
    const sel = $('#filterForm').city;
    sel.innerHTML += cities.map((c) => `<option ${c === f.city ? 'selected' : ''}>${esc(c)}</option>`).join('');
  } catch (e) {}

  $('#filterForm').onsubmit = (ev) => {
    ev.preventDefault();
    const fm = ev.target;
    state.filters = { search: fm.search.value.trim(), city: fm.city.value, date: fm.date.value };
    state.page = 1; loadEvents();
  };
  $('#clearF').onclick = () => { state.filters = { search: '', city: '', date: '' }; state.page = 1; viewEvents(); };
  loadEvents();
}

async function loadEvents() {
  const f = state.filters;
  const q = new URLSearchParams({ page: state.page, limit: 6 });
  if (f.search) q.set('search', f.search);
  if (f.city) q.set('city', f.city);
  if (f.date) q.set('date', f.date);

  const box = $('#list');
  box.innerHTML = skeletons();
  try {
    const r = await api('GET', '/events?' + q);
    if (!r.data.length) { box.innerHTML = emptyState('search', 'No events found', 'Try a different search or clear the filters.'); return; }
    box.innerHTML = `<div class="grid">${r.data.map(eventCard).join('')}</div>${pagerHtml(r.pagination)}`;
    bindCards(box);
    box.querySelectorAll('[data-page]').forEach((b) => b.onclick = () => { state.page = +b.dataset.page; loadEvents(); window.scrollTo(0, 0); });
  } catch (e) { box.innerHTML = `<div class="empty err">${esc(errText(e))}</div>`; }
}

function eventCard(e) {
  const sold = e.status === 'upcoming' && e.tickets_available === 0;
  const th = eventTheme(e);
  const low = !sold && e.status === 'upcoming' && e.total_tickets && e.tickets_available / e.total_tickets <= 0.1;
  return `<div class="card" data-id="${e.id}" tabindex="0" role="button" aria-label="${esc(e.title)}">
    <div class="photo">
      <img src="${photoUrl(e)}" alt="" loading="lazy">
      <span class="tag">${ic(th.icon)}${th.label}</span>
      <span class="when">${ic('calendar')}${fmtDate(e.event_date)}</span>
    </div>
    <div class="body">
      <h3>${esc(e.title)}</h3>
      <div class="meta">${ic('pin')}${esc(e.venue_name)}, ${esc(e.venue_city)}</div>
      <div class="meta">${ic('clock')}${fmtTime(e.start_time)}</div>
    </div>
    <div class="foot">
      <div class="price">${e.ticket_price > 0 ? '<small class="from">from</small>' + money(e.ticket_price) : 'Free'}
        ${e.status === 'upcoming' && !sold ? `<div class="left ${low ? 'low' : ''}">${e.tickets_available} left</div>` : ''}</div>
      ${sold ? '<span class="badge b-soldout">sold out</span>' : badge(e.status)}
    </div></div>`;
}

// Event details, booking and weather

async function showEvent(id) {
  openModal('<div class="empty">Loading...</div>');
  try {
    const [evRes, ttRes] = await Promise.all([api('GET', '/events/' + id), api('GET', `/events/${id}/ticket-types?limit=100`)]);
    const e = evRes.data, types = ttRes.data;
    const u = state.user;
    const open = types.filter((t) => !t.sold_out);
    const canBook = e.status === 'upcoming' && open.length > 0;

    const typeTable = types.length
      ? `<table><tr><th>Ticket</th><th class="c-num">Price</th><th class="c-num">Seats left</th></tr>${types.map((t) =>
          `<tr><td>${esc(t.name)}</td><td class="c-num">${t.price > 0 ? money(t.price) : 'Free'}</td>
           <td class="c-num">${t.sold_out ? '<span class="badge b-soldout">sold out</span>' : t.quantity_available + ' / ' + t.quantity}</td></tr>`).join('')}</table>`
      : '<p class="hint">The organiser has not added any ticket types yet.</p>';

    let action = '';
    if (!canBook) {
      action = `<p class="err">${e.status !== 'upcoming' ? 'This event is ' + esc(e.status) + '.' : 'Sold out.'}</p>`;
    } else if (!u) {
      action = '<p><button id="loginToBook">Log in to book tickets</button></p>';
    } else if (u.role === 'customer') {
      action = `<form id="bookForm">
          <label>Ticket type</label>
          <select name="ticket_type_id">${types.map((t) =>
            `<option value="${t.id}" ${t.sold_out ? 'disabled' : ''} ${t.id === open[0].id ? 'selected' : ''}>${esc(t.name)} - ${t.price > 0 ? money(t.price) : 'Free'} (${t.sold_out ? 'sold out' : t.quantity_available + ' left'})</option>`).join('')}</select>
          <div class="row2">
            <div><label>Quantity</label><input type="number" name="quantity" min="1" max="${open[0].quantity_available}" value="1" required></div>
            <div><label>Total</label><input id="bookTotal" readonly></div></div>
          <div id="bookErr" class="err"></div><p><button type="submit">Book now</button></p></form>`;
    } else {
      action = '<p class="hint">Only customer accounts can book tickets.</p>';
    }

    const th = eventTheme(e);
    openModal(`
      <div class="m-photo"><img src="${photoUrl(e)}" alt=""><span class="tag">${ic(th.icon)}${th.label}</span></div>
      <div class="date-chip">${ic('calendar')}${fmtDate(e.event_date)}</div>
      <h2 style="margin:4px 0">${esc(e.title)} ${badge(e.status)}</h2>
      <div class="pills"><span class="pill">${ic('pin')}${esc(e.venue_city)}</span><span class="pill">${ic('clock')}${fmtTime(e.start_time)}</span><span class="pill">${ic('ticket')}${e.tickets_available} left</span></div>
      <p>${esc(e.description || '')}</p>
      <div class="detail-grid">
        <div><b>Time</b>${fmtTime(e.start_time)} - ${fmtTime(e.end_time)}</div>
        <div><b>Organiser</b>${esc(e.organiser_name)}</div>
        <div><b>Venue</b>${esc(e.venue_name)}</div>
        <div><b>Tickets left (all types)</b>${e.tickets_available} / ${e.total_tickets}</div>
        <div style="grid-column:1/-1"><b>Address</b>${esc(e.venue_address)}, ${esc(e.venue_city)}</div>
      </div>
      <h3 style="margin:14px 0 6px">Tickets</h3>
      ${typeTable}
      <button class="ghost small" id="btnWeather" style="margin-top:12px">Show weather forecast</button>
      <div id="weatherBox"></div>
      <hr style="border:0;border-top:1px solid var(--line);margin:16px 0">
      ${action}`);

    $('#btnWeather').onclick = () => loadWeather(e.id);
    if ($('#loginToBook')) $('#loginToBook').onclick = () => showAuth('login');
    if ($('#bookForm')) {
      const form = $('#bookForm');
      const chosen = () => types.find((t) => t.id === +form.ticket_type_id.value);
      const refresh = () => {
        const t = chosen();
        form.quantity.max = t.quantity_available;
        if (+form.quantity.value > t.quantity_available) form.quantity.value = t.quantity_available;
        $('#bookTotal').value = money((+form.quantity.value || 0) * t.price);
      };
      form.ticket_type_id.onchange = refresh;
      form.quantity.oninput = refresh;
      refresh();
      form.onsubmit = async (ev) => {
        ev.preventDefault();
        $('#bookErr').textContent = '';
        try {
          await api('POST', '/bookings', { event_id: e.id, ticket_type_id: +form.ticket_type_id.value, quantity: +form.quantity.value });
          closeModal(); toast('Booking confirmed!'); go('mybookings');
        } catch (err) { $('#bookErr').textContent = errText(err); }
      };
    }
  } catch (err) { openModal(`<p class="err">${esc(errText(err))}</p>`); }
}

async function loadWeather(id) {
  const box = $('#weatherBox');
  box.innerHTML = '<div class="weather">Loading forecast...</div>';
  try {
    const w = await api('GET', `/events/${id}/weather`);
    const d = w.data;
    const days = d.forecast.map((x) => `<div class="day"><span>${fmtDate(x.date)}</span><span>${esc(x.condition)}</span>
      <span>${x.temp_min_c}&ndash;${x.temp_max_c}&deg;C</span><span>${x.rain_chance_percent ?? '-'}% rain</span></div>`).join('');
    box.innerHTML = `<div class="weather"><b>${esc(d.location.city)}</b> <span class="hint">${esc(w.message)}</span>${days}
      <div class="hint">Source: ${esc(d.source)}</div></div>`;
  } catch (e) { box.innerHTML = `<div class="weather err">${esc(errText(e))}</div>`; }
}

// My bookings view

async function viewMyBookings() {
  if (!state.user) return go('events');
  $('#app').innerHTML = pageHead('ticket', 'My bookings', 'Tickets you have booked.') + '<div id="list"></div>';
  loadBookings();
}

async function loadBookings() {
  const box = $('#list');
  try {
    const r = await api('GET', `/bookings?page=${state.page}&limit=10`);
    if (!r.data.length) { box.innerHTML = emptyState('ticket', 'No bookings yet', 'Browse events to get started.'); return; }
    box.innerHTML = `<div class="table-wrap"><table>
      <tr><th class="c-no">No.</th><th>Event</th><th class="c-nw">Date</th><th>Ticket</th><th class="c-num">Qty</th><th class="c-num">Total</th><th class="c-nw">Status</th><th class="c-act"></th></tr>
      ${byId(r.data).map((b, i) => `<tr><td class="c-no">${i + 1}</td><td>${esc(b.event_title)}</td><td class="c-nw">${fmtDate(b.event_date)}</td>
        <td>${esc(b.ticket_type_name || '(removed)')}</td><td class="c-num">${b.quantity}</td><td class="c-num">${money(b.total_price)}</td><td class="c-nw">${badge(b.status)}</td>
        <td class="c-act">${b.status === 'confirmed' && b.event_status !== 'completed' ? `<div class="row-actions"><button class="danger small" data-cancel="${b.id}">Cancel</button></div>` : ''}</td></tr>`).join('')}
    </table></div>${pagerHtml(r.pagination)}`;
    box.querySelectorAll('[data-page]').forEach((b) => b.onclick = () => { state.page = +b.dataset.page; loadBookings(); });
    box.querySelectorAll('[data-cancel]').forEach((b) => b.onclick = async () => {
      if (!confirm('Cancel this booking?')) return;
      try { await api('DELETE', '/bookings/' + b.dataset.cancel); toast('Booking cancelled, tickets released'); loadBookings(); }
      catch (e) { toast(errText(e), true); }
    });
  } catch (e) { box.innerHTML = `<div class="empty err">${esc(errText(e))}</div>`; }
}

// Manage events view

async function viewOrganiser() {
  const u = state.user;
  if (!u || u.role === 'customer') return go('events');

  $('#app').innerHTML = `
    ${pageHead('layout', 'Manage events', u.role === 'admin' ? 'All events in the system.' : 'Events you organise and who booked them.')}
    <div class="tabs"><button class="on" data-tab="events">Events</button><button data-tab="bookings">Bookings</button><button data-tab="new">+ New event</button></div>
    <div id="tabBody"></div>`;
  document.querySelectorAll('[data-tab]').forEach((b) => b.onclick = () => {
    document.querySelectorAll('[data-tab]').forEach((x) => x.classList.toggle('on', x === b));
    ({ events: orgEvents, bookings: orgBookings, new: orgNew })[b.dataset.tab]();
  });
  orgEvents();
}

async function orgEvents() {
  const u = state.user, box = $('#tabBody');
  box.innerHTML = '<div class="empty">Loading...</div>';
  try {
    const q = u.role === 'organiser' ? `&organiser_id=${u.id}` : '';
    const r = await api('GET', '/events?limit=100' + q);
    if (!r.data.length) { box.innerHTML = emptyState('inbox', 'No events yet', 'Create one with "+ New event".'); return; }
    box.innerHTML = `<div class="table-wrap"><table>
      <tr><th class="c-no">No.</th><th>Event</th><th class="c-nw">Date</th><th>Venue</th><th class="c-num">Sold</th><th class="c-nw">Status</th><th class="c-act"></th></tr>
      ${byId(r.data).map((e, i) => `<tr><td class="c-no">${i + 1}</td><td>${esc(e.title)}</td><td class="c-nw">${fmtDate(e.event_date)}</td><td>${esc(e.venue_name)}</td>
        <td class="c-num">${e.total_tickets - e.tickets_available} / ${e.total_tickets}</td><td class="c-nw">${badge(e.status)}</td>
        <td class="c-act"><div class="row-actions"><button class="ghost small" data-tickets="${e.id}">Ticket types</button>
            ${e.status === 'upcoming' ? `<button class="ghost small" data-cancel="${e.id}">Cancel event</button>` : ''}
            <button class="danger small" data-del="${e.id}">Delete</button></div></td></tr>`).join('')}
    </table></div>`;
    box.querySelectorAll('[data-tickets]').forEach((b) => b.onclick = () => showTicketTypes(+b.dataset.tickets));
    box.querySelectorAll('[data-cancel]').forEach((b) => b.onclick = async () => {
      if (!confirm('Cancel this event? All its bookings will be cancelled too.')) return;
      try { await api('PUT', '/events/' + b.dataset.cancel, { status: 'cancelled' }); toast('Event cancelled'); orgEvents(); }
      catch (e) { toast(errText(e), true); }
    });
    box.querySelectorAll('[data-del]').forEach((b) => b.onclick = async () => {
      if (!confirm('Delete this event and all its bookings permanently?')) return;
      try { await api('DELETE', '/events/' + b.dataset.del); toast('Event deleted'); orgEvents(); }
      catch (e) { toast(errText(e), true); }
    });
  } catch (e) { box.innerHTML = `<div class="empty err">${esc(errText(e))}</div>`; }
}

async function orgBookings() {
  const box = $('#tabBody');
  box.innerHTML = '<div class="empty">Loading...</div>';
  try {
    const r = await api('GET', '/bookings?limit=100');
    if (!r.data.length) { box.innerHTML = '<div class="empty">No bookings yet.</div>'; return; }
    box.innerHTML = bookingsTable(r.data, state.user.role === 'admin');
    bindAdminDelete(box, orgBookings);
  } catch (e) { box.innerHTML = `<div class="empty err">${esc(errText(e))}</div>`; }
}

// Manage the ticket types of an event
async function showTicketTypes(eventId) {
  openModal('<div class="empty">Loading...</div>');
  try {
    const [evRes, ttRes] = await Promise.all([api('GET', '/events/' + eventId), api('GET', `/events/${eventId}/ticket-types?limit=100`)]);
    const e = evRes.data, types = ttRes.data;
    const editable = e.status === 'upcoming';

    openModal(`
      <h2 style="margin-top:0">Ticket types</h2>
      <p class="sub">${esc(e.title)} - ${types.reduce((n, t) => n + t.quantity, 0)} tickets in total</p>
      ${types.length ? `<div class="table-wrap"><table>
        <tr><th class="c-no">No.</th><th>Name</th><th class="c-num">Price</th><th class="c-num">Sold</th><th class="c-num">Left</th><th class="c-act"></th></tr>
        ${byId(types).map((t, i) => `<tr><td class="c-no">${i + 1}</td><td>${esc(t.name)}</td><td class="c-num">${money(t.price)}</td><td class="c-num">${t.sold} / ${t.quantity}</td><td class="c-num">${t.quantity_available}</td>
          <td class="c-act">${editable ? `<div class="row-actions"><button class="ghost small" data-tedit="${t.id}">Edit</button><button class="danger small" data-tdel="${t.id}">Delete</button></div>` : ''}</td></tr>`).join('')}
        </table></div>` : '<div class="empty">No ticket types yet.</div>'}
      ${editable ? `<h3 id="ttTitle" style="margin:18px 0 0">Add ticket type</h3>
        <form id="ttForm"><input type="hidden" name="id">
          <label>Name (e.g. VIP)</label><input name="name" required maxlength="100">
          <div class="row2"><div><label>Price (RM)</label><input type="number" name="price" min="0" step="0.01" required></div>
            <div><label>Quantity</label><input type="number" name="quantity" min="1" required></div></div>
          <div class="hint">All ticket types together cannot be more than the venue capacity. Quantity cannot go below what is already sold.</div>
          <div id="ttErr" class="err"></div>
          <p><button type="submit" id="ttSave">Add ticket type</button> <button type="button" class="ghost hidden" id="ttCancel">Cancel edit</button></p></form>`
        : `<p class="hint">This event is ${esc(e.status)}, so its ticket types cannot be changed.</p>`}`);

    if (!editable) return;
    const form = $('#ttForm');
    const resetForm = () => { form.reset(); form.elements.id.value = ''; $('#ttTitle').textContent = 'Add ticket type'; $('#ttSave').textContent = 'Add ticket type'; $('#ttCancel').classList.add('hidden'); };
    $('#ttCancel').onclick = resetForm;

    document.querySelectorAll('[data-tedit]').forEach((b) => b.onclick = () => {
      const t = types.find((x) => x.id === +b.dataset.tedit);
      form.elements.id.value = t.id; form.elements.name.value = t.name; form.price.value = t.price; form.quantity.value = t.quantity;
      $('#ttTitle').textContent = 'Edit ticket type'; $('#ttSave').textContent = 'Save changes'; $('#ttCancel').classList.remove('hidden');
      $('#ttErr').textContent = '';
    });
    document.querySelectorAll('[data-tdel]').forEach((b) => b.onclick = async () => {
      if (!confirm('Delete this ticket type?')) return;
      try { await api('DELETE', '/ticket-types/' + b.dataset.tdel); toast('Ticket type deleted'); showTicketTypes(eventId); if ($('#tabBody')) orgEvents(); }
      catch (err) { $('#ttErr').textContent = errText(err); }
    });
    form.onsubmit = async (ev) => {
      ev.preventDefault();
      $('#ttErr').textContent = '';
      const body = { name: form.elements.name.value, price: +form.price.value, quantity: +form.quantity.value };
      try {
        if (form.elements.id.value) await api('PUT', '/ticket-types/' + form.elements.id.value, body);
        else await api('POST', `/events/${eventId}/ticket-types`, body);
        toast(form.elements.id.value ? 'Ticket type updated' : 'Ticket type added');
        showTicketTypes(eventId); if ($('#tabBody')) orgEvents();
      } catch (err) { $('#ttErr').textContent = errText(err); }
    };
  } catch (err) { openModal(`<p class="err">${esc(errText(err))}</p>`); }
}

function bookingsTable(rows, withDelete) {
  return `<div class="table-wrap"><table>
    <tr><th class="c-no">No.</th><th>Event</th><th>Customer</th><th>Ticket</th><th class="c-num">Qty</th><th class="c-num">Total</th><th class="c-nw">Status</th>${withDelete ? '<th class="c-act"></th>' : ''}</tr>
    ${byId(rows).map((b, i) => `<tr><td class="c-no">${i + 1}</td><td>${esc(b.event_title)}</td><td>${esc(b.customer_name)}</td><td>${esc(b.ticket_type_name || '(removed)')}</td><td class="c-num">${b.quantity}</td>
      <td class="c-num">${money(b.total_price)}</td><td class="c-nw">${badge(b.status)}</td>
      ${withDelete ? `<td class="c-act"><div class="row-actions"><button class="danger small" data-delbooking="${b.id}">Delete</button></div></td>` : ''}</tr>`).join('')}
  </table></div>`;
}

function bindAdminDelete(box, reload) {
  box.querySelectorAll('[data-delbooking]').forEach((b) => b.onclick = async () => {
    if (!confirm('Delete this booking record?')) return;
    try { await api('DELETE', '/bookings/' + b.dataset.delbooking); toast('Booking deleted'); reload(); }
    catch (e) { toast(errText(e), true); }
  });
}

async function orgNew() {
  const box = $('#tabBody');
  const isAdmin = state.user.role === 'admin';
  let venues = [], organisers = [];
  try {
    venues = (await api('GET', '/venues?limit=100')).data;
    if (isAdmin) organisers = (await api('GET', '/users?role=organiser&limit=100')).data;
  } catch (e) {}

  box.innerHTML = `<div class="panel"><form id="evForm">
    ${isAdmin ? `<label>Organiser</label><select name="organiser_id">${organisers.map((o) => `<option value="${o.id}">${esc(o.name)}</option>`).join('')}</select>` : ''}
    <label>Title</label><input name="title" required maxlength="200">
    <label>Description</label><textarea name="description" rows="3"></textarea>
    <div class="row2"><div><label>Venue</label><select name="venue_id">${venues.map((v) => `<option value="${v.id}">${esc(v.name)} (${esc(v.city)}, cap. ${v.capacity})</option>`).join('')}</select></div>
      <div><label>Date</label><input type="date" name="event_date" required></div></div>
    <div class="row3"><div><label>Start</label><input type="time" name="start_time" required value="19:00"></div>
      <div><label>End</label><input type="time" name="end_time" required value="22:00"></div>
      <div><label>Standard ticket price (RM)</label><input type="number" name="ticket_price" min="0" step="0.01" required value="50"></div></div>
    <label>Standard ticket quantity</label><input type="number" name="total_tickets" min="1" required value="100">
    <div class="hint">This creates a "Standard" ticket type. Add VIP or other types afterwards with "Ticket types" in the events list.</div>
    <div id="evErr" class="err"></div>
    <p><button type="submit">Create event</button></p></form></div>`;

  $('#evForm').onsubmit = async (ev) => {
    ev.preventDefault();
    const f = ev.target;
    const body = {
      venue_id: +f.venue_id.value, title: f.elements.title.value, description: f.description.value, event_date: f.event_date.value,
      start_time: f.start_time.value, end_time: f.end_time.value, ticket_price: +f.ticket_price.value, total_tickets: +f.total_tickets.value,
    };
    if (isAdmin) body.organiser_id = +f.organiser_id.value;
    $('#evErr').textContent = '';
    try {
      await api('POST', '/events', body);
      toast('Event created'); viewOrganiser();
    } catch (e) { $('#evErr').textContent = errText(e); }
  };
}

// Admin view

function viewAdmin() {
  if (!state.user || state.user.role !== 'admin') return go('events');
  $('#app').innerHTML = `
    ${pageHead('shield', 'Admin', 'Users, venues and all bookings.')}
    <div class="tabs"><button class="on" data-tab="users">Users</button><button data-tab="venues">Venues</button><button data-tab="bookings">Bookings</button></div>
    <div id="tabBody"></div>`;
  document.querySelectorAll('[data-tab]').forEach((b) => b.onclick = () => {
    document.querySelectorAll('[data-tab]').forEach((x) => x.classList.toggle('on', x === b));
    ({ users: adminUsers, venues: adminVenues, bookings: orgBookings })[b.dataset.tab]();
  });
  adminUsers();
}

async function adminUsers() {
  const box = $('#tabBody');
  try {
    const r = await api('GET', '/users?limit=100');
    box.innerHTML = `<div class="table-wrap"><table>
      <tr><th class="c-no">No.</th><th>Name</th><th>Email</th><th class="c-nw">Role</th><th class="c-act"></th></tr>
      ${byId(r.data).map((u, i) => `<tr><td class="c-no">${i + 1}</td><td>${esc(u.name)}</td><td>${esc(u.email)}</td><td class="c-nw"><span class="role">${esc(u.role)}</span></td>
        <td class="c-act">${u.id === state.user.id ? '' : `<div class="row-actions"><button class="danger small" data-deluser="${u.id}">Delete</button></div>`}</td></tr>`).join('')}
    </table></div>
    <h2>Add user</h2><div class="panel"><form id="userForm"><div class="row2">
      <div><label>Name</label><input name="name" required></div><div><label>Email</label><input name="email" type="email" required></div>
      <div><label>Password</label><input name="password" type="password" minlength="8" required></div>
      <div><label>Role</label><select name="role"><option>customer</option><option>organiser</option><option>admin</option></select></div></div>
      <div id="uErr" class="err"></div><p><button type="submit">Create user</button></p></form></div>`;
    box.querySelectorAll('[data-deluser]').forEach((b) => b.onclick = async () => {
      if (!confirm('Delete this user?')) return;
      try { await api('DELETE', '/users/' + b.dataset.deluser); toast('User deleted'); adminUsers(); }
      catch (e) { toast(errText(e), true); }
    });
    $('#userForm').onsubmit = async (ev) => {
      ev.preventDefault(); const f = ev.target;
      try {
        await api('POST', '/users', { name: f.elements.name.value, email: f.email.value, password: f.password.value, role: f.role.value });
        toast('User created'); adminUsers();
      } catch (e) { $('#uErr').textContent = errText(e); }
    };
  } catch (e) { box.innerHTML = `<div class="empty err">${esc(errText(e))}</div>`; }
}

async function adminVenues() {
  const box = $('#tabBody');
  try {
    const r = await api('GET', '/venues?limit=100');
    box.innerHTML = `<div class="table-wrap"><table>
      <tr><th class="c-no">No.</th><th>Name</th><th>City</th><th class="c-num">Capacity</th><th class="c-act"></th></tr>
      ${byId(r.data).map((v, i) => `<tr><td class="c-no">${i + 1}</td><td>${esc(v.name)}</td><td>${esc(v.city)}</td><td class="c-num">${v.capacity}</td>
        <td class="c-act"><div class="row-actions"><button class="danger small" data-delvenue="${v.id}">Delete</button></div></td></tr>`).join('')}
    </table></div>
    <h2>Add venue</h2><div class="panel"><form id="venueForm"><div class="row2">
      <div><label>Name</label><input name="name" required></div><div><label>City</label><input name="city" required></div>
      <div><label>Address</label><input name="address" required></div><div><label>Capacity</label><input name="capacity" type="number" min="1" required></div></div>
      <div id="vErr" class="err"></div><p><button type="submit">Create venue</button></p></form></div>`;
    box.querySelectorAll('[data-delvenue]').forEach((b) => b.onclick = async () => {
      if (!confirm('Delete this venue?')) return;
      try { await api('DELETE', '/venues/' + b.dataset.delvenue); toast('Venue deleted'); adminVenues(); }
      catch (e) { toast(errText(e), true); }
    });
    $('#venueForm').onsubmit = async (ev) => {
      ev.preventDefault(); const f = ev.target;
      try {
        await api('POST', '/venues', { name: f.elements.name.value, city: f.city.value, address: f.address.value, capacity: +f.capacity.value });
        toast('Venue created'); adminVenues();
      } catch (e) { $('#vErr').textContent = errText(e); }
    };
  } catch (e) { box.innerHTML = `<div class="empty err">${esc(errText(e))}</div>`; }
}

// Home view (about the website)

function photoAt(i) { return encodeURI(PHOTOS[i % PHOTOS.length]); }

function bindCards(box) {
  box.querySelectorAll('.card').forEach((c) => {
    c.onclick = () => showEvent(c.dataset.id);
    c.onkeydown = (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); showEvent(c.dataset.id); } };
  });
}

async function viewHome() {
  const features = [
    ['search', 'Find events fast', 'Search by name, venue, city or date, or jump straight to a category.'],
    ['ticket', 'Flexible ticket types', 'Standard, VIP and more. Each type has its own price and seats left.'],
    ['zap', 'Instant booking', 'Choose a ticket and quantity and your booking is confirmed straight away.'],
    ['cloud', 'Weather forecast', 'See the forecast for the event day before you decide to go.'],
    ['ticket', 'Easy cancellation', 'Change of plan? Cancel a booking and the tickets go back on sale.'],
    ['layout', 'Tools for organisers', 'Create events, set ticket types and see who booked, all in one place.'],
  ];
  const roles = [
    ['user', 'Customer', ['Browse and search events', 'Book tickets in a few clicks', 'View and cancel your bookings']],
    ['layout', 'Organiser', ['Create and manage your events', 'Add VIP and other ticket types', 'See every booking for your events']],
    ['shield', 'Admin', ['Manage users and venues', 'See all events and bookings', 'Keep the platform tidy']],
  ];

  $('#app').innerHTML = `
    <section class="hero tilted">
      <tilted-grid-hero axis="52" tile-height="24" images="${esc(JSON.stringify(PHOTOS.map((_, i) => photoAt(i))))}"></tilted-grid-hero>
      <div class="hero-content">
        <div class="hero-top">
          <h1>Your ticket to <em>events</em> across Malaysia</h1>
        </div>
        <div class="hero-bottom">
          <p>TiketKita is a friendly place to discover concerts, festivals and conferences, and book your seat in seconds.</p>
          <div class="hero-cta">
            <button type="button" class="cta-main" data-view="events">Browse events ${ic('arrow')}</button>
            <button type="button" class="cta-ghost" data-view="info">How it works</button>
          </div>
        </div>
      </div>
    </section>

    <halftone-wordmark-footer
      wordmark="welcome to|tiketkita" text="false"
      background="transparent" ink-dark="#e2e8f0" ink-light="#0f172a" warm-dark="#22c55e" warm-light="#16a34a"
      grain="0" dot-gap="4" dot-gap-narrow="3" word-width="80"></halftone-wordmark-footer>

    <div class="home-body">
    <div class="perks live">
      <div class="perk"><span class="pi">${ic('calendar')}</span><div><b id="hmEvents">-</b><span>Events listed</span></div></div>
      <div class="perk"><span class="pi">${ic('pin')}</span><div><b id="hmVenues">-</b><span>Venues</span></div></div>
      <div class="perk"><span class="pi">${ic('building')}</span><div><b id="hmCities">-</b><span>Cities</span></div></div>
    </div>

    <section class="about">
      <div class="about-text">
        <span class="kicker">About TiketKita</span>
        <h2>One place to discover, book and manage events</h2>
        <p>TiketKita brings event listings, ticket sales and venues together. Customers find something to do and book it. Organisers publish events and manage their tickets. Admins keep the people and places in order.</p>
        <ul class="ticks">
          <li>${ic('check')}Clear prices, with seats left shown on every ticket type</li>
          <li>${ic('check')}Works on phones, tablets and computers</li>
          <li>${ic('check')}Light and dark mode, remembered for your next visit</li>
        </ul>
        <div class="about-links"><button type="button" data-view="info">User manual</button><button type="button" class="ghost" data-info="faq">Read the FAQ</button></div>
      </div>
      <div class="about-photo"><img src="${photoAt(1)}" alt="" loading="lazy"></div>
    </section>

    <div class="section-title"><h2>What you can do</h2></div>
    <div class="feature-grid">${features.map(([i, t, d]) => `<div class="feature"><span class="pi">${ic(i)}</span><h3>${t}</h3><p>${d}</p></div>`).join('')}</div>

    <div class="section-title"><h2>Built for everyone involved</h2></div>
    <div class="role-grid">${roles.map(([i, t, items]) => `<div class="who"><div class="role-head"><span class="pi">${ic(i)}</span><h3>${t}</h3></div>
      <ul>${items.map((x) => `<li>${ic('check')}${x}</li>`).join('')}</ul></div>`).join('')}</div>

    <div class="section-title"><h2>Coming up</h2><a href="#" data-view="events" class="more">View all events ${ic('arrow')}</a></div>
    <div id="featured">${skeletons(3)}</div>

    <div class="cta-band">
      <div><h2>Ready to find your next event?</h2><p>Browse what is on, pick your tickets and you are done.</p></div>
      <div class="cta-actions"><button type="button" class="cta-main" data-view="events">Browse events</button><button type="button" class="cta-ghost" data-view="info">Read the guide</button></div>
    </div>
    </div>`;

  // Live numbers and featured events from the API
  const feat = $('#featured');
  api('GET', '/events?limit=3').then((r) => {
    $('#hmEvents').textContent = r.pagination ? r.pagination.total : r.data.length;
    feat.innerHTML = r.data.length ? `<div class="grid">${r.data.map(eventCard).join('')}</div>` : emptyState('search', 'No events yet', 'Check back soon.');
    bindCards(feat);
  }).catch((e) => { feat.innerHTML = `<div class="empty err">${esc(errText(e))}</div>`; });
  api('GET', '/venues?limit=100').then((v) => {
    $('#hmVenues').textContent = v.data.length;
    $('#hmCities').textContent = new Set(v.data.map((x) => x.city)).size;
  }).catch(() => {});
}

// Info view (user manual and FAQ)

const MANUAL = [
  ['user', 'Getting started', [
    'Open the site and press <b>Sign up</b> in the top right. Enter your name, email and a password of at least 8 characters.',
    'You are logged in straight away. New accounts are <b>customer</b> accounts.',
    'Next time, press <b>Log in</b>. On the login box you can also use the demo account links to fill in the form quickly.',
    'Use the moon or sun button to switch between light and dark mode.',
  ]],
  ['ticket', 'Book tickets', [
    'Go to <b>Events</b>. Use the search card to look by name, city or date, or press a category tab.',
    'Click an event card to open its details: date, time, venue, address and every ticket type with the seats left.',
    'Press <b>Show weather forecast</b> if you want to check the weather for the event day.',
    'Log in if you have not yet, choose a <b>ticket type</b> and a <b>quantity</b>. The total is worked out for you.',
    'Press <b>Book now</b>. You will see a confirmation and land on <b>My bookings</b>.',
  ]],
  ['inbox', 'Manage your bookings', [
    'Open <b>My bookings</b> in the top menu to see every ticket you booked, with date, quantity, total and status.',
    'To cancel, press <b>Cancel</b> on a confirmed booking and confirm. The tickets are released for other people.',
    'Bookings for events that are already completed cannot be cancelled.',
  ]],
  ['layout', 'For organisers', [
    'Log in with an organiser account and open <b>Manage events</b>.',
    'Choose <b>+ New event</b>, fill in the title, venue, date, times, price and number of tickets, then press <b>Create event</b>. A Standard ticket type is created for you.',
    'Press <b>Ticket types</b> on an event to add VIP or other types, or to edit or delete them. Together they cannot go over the venue capacity, and a quantity cannot go below what is already sold.',
    'Use the <b>Bookings</b> tab to see who booked your events.',
    'You can <b>cancel</b> an upcoming event (its bookings are cancelled too) or <b>delete</b> it completely.',
  ]],
  ['shield', 'For admins', [
    'Log in with an admin account and open <b>Admin</b>.',
    'The <b>Users</b> tab lists everyone. Add a user with any role, or delete one.',
    'The <b>Venues</b> tab lets you add venues (name, city, address, capacity) or delete them.',
    'The <b>Bookings</b> tab shows every booking and lets you delete a record.',
    'Admins can also open <b>Manage events</b> to work on any event.',
  ]],
];

const FAQ = [
  ['Getting started', [
    ['Do I need an account to look at events?', 'No. Anyone can browse and search. You only need to log in when you want to book.'],
    ['How do I create an account?', 'Press <b>Sign up</b>, enter your name, email and a password with at least 8 characters. New accounts are customer accounts.'],
    ['Can organisers or admins book tickets?', 'Booking is for customer accounts. If you are logged in as an organiser or admin you will see a note instead of the booking form.'],
    ['I forgot what the demo accounts are.', 'Open <b>Log in</b>. Under the form you will find demo links for an admin, an organiser and a customer that fill the form for you.'],
  ]],
  ['Booking and tickets', [
    ['How many tickets can I book?', 'As many as are left for the ticket type you choose. The quantity box will not let you go above that number.'],
    ['What does "sold out" mean?', 'Every seat of that ticket type has been booked. If all types are sold out, the whole event shows as sold out and cannot be booked.'],
    ['Do you take payment online?', 'Not in this version. A booking is confirmed straight away when you press <b>Book now</b>.'],
    ['Are free events really free?', 'Yes. Events with a price of 0 show <b>Free</b> and you book them the same way.'],
    ['Where is the weather forecast?', 'Open any event and press <b>Show weather forecast</b>. It shows the forecast for the event city, and where the data came from.'],
  ]],
  ['Changes and cancellations', [
    ['Can I cancel a booking?', 'Yes. Go to <b>My bookings</b> and press <b>Cancel</b> next to a confirmed booking. The tickets are released.'],
    ['What happens if an event is cancelled?', 'The event is marked <b>cancelled</b> and its bookings are cancelled too. Cancelled and completed events cannot be booked.'],
    ['Why can an organiser not change a ticket type?', 'Ticket types can only be changed while the event is upcoming. Once it is completed or cancelled they are locked.'],
  ]],
  ['Troubleshooting', [
    ['I see "Cannot reach the API".', 'The site could not talk to the server. Make sure Apache and MySQL are running in the XAMPP control panel, then reload the page.'],
    ['I see "Too many requests".', 'You have sent a lot of requests in a short time. Wait a minute and try again.'],
    ['The page looks old after an update.', 'Your browser kept an old copy. Reload with Ctrl+F5.'],
    ['I was logged out by itself.', 'Your login expired or is no longer valid. Log in again to continue.'],
  ]],
];

function viewInfo() {
  const tab = state.infoTab || 'manual';
  $('#app').innerHTML = `
    ${pageHead('book', 'Help centre', 'Learn how to use TiketKita, and find quick answers to common questions.')}
    <div class="tabs info-tabs">
      <button type="button" data-itab="manual" class="${tab === 'manual' ? 'on' : ''}">User manual</button>
      <button type="button" data-itab="faq" class="${tab === 'faq' ? 'on' : ''}">FAQ</button>
    </div>
    <div id="infoBody"></div>`;
  document.querySelectorAll('[data-itab]').forEach((b) => b.onclick = () => { state.infoTab = b.dataset.itab; viewInfo(); });
  tab === 'faq' ? renderFaq() : renderManual();
}

function renderManual() {
  $('#infoBody').innerHTML = `
    <div class="manual">
      <aside class="toc"><b>On this page</b>${MANUAL.map(([i, t], n) => `<a href="#m${n}" data-jump="m${n}">${ic(i)}${t}</a>`).join('')}</aside>
      <div class="manual-body">${MANUAL.map(([i, t, steps], n) => `
        <section class="panel guide" id="m${n}">
          <div class="guide-head"><span class="pi">${ic(i)}</span><h2>${t}</h2></div>
          <ol class="steps-list">${steps.map((s) => `<li>${s}</li>`).join('')}</ol>
        </section>`).join('')}
        <div class="panel help-note">${ic('help')}<div><b>Still stuck?</b><span>Check the <a href="#" data-info="faq">FAQ</a> for quick answers.</span></div></div>
      </div>
    </div>`;
  document.querySelectorAll('[data-jump]').forEach((a) => a.onclick = (ev) => {
    ev.preventDefault();
    const t = document.getElementById(a.dataset.jump);
    if (t) window.scrollTo({ top: t.getBoundingClientRect().top + window.scrollY - 84, behavior: 'smooth' });
  });
}

function renderFaq() {
  $('#infoBody').innerHTML = `
    <div class="faq-search">${ic('search')}<input id="faqQ" type="search" placeholder="Search the FAQ" aria-label="Search the FAQ"></div>
    <div id="faqList">${FAQ.map(([group, items]) => `
      <div class="faq-group"><h2>${group}</h2>
        ${items.map(([q, a]) => `<details class="faq-item" data-t="${esc((q + ' ' + a.replace(/<[^>]+>/g, '')).toLowerCase())}">
          <summary><span>${q}</span>${ic('chevron')}</summary><div class="faq-a">${a}</div></details>`).join('')}
      </div>`).join('')}</div>
    <div id="faqNone" class="hidden">${emptyState('search', 'No matching questions', 'Try a different word.')}</div>`;
  $('#faqQ').oninput = (ev) => {
    const q = ev.target.value.trim().toLowerCase();
    let shown = 0;
    document.querySelectorAll('.faq-item').forEach((d) => { const ok = !q || d.dataset.t.includes(q); d.classList.toggle('hidden', !ok); if (ok) shown++; });
    document.querySelectorAll('.faq-group').forEach((g) => g.classList.toggle('hidden', !g.querySelector('.faq-item:not(.hidden)')));
    $('#faqNone').classList.toggle('hidden', shown > 0);
  };
}

// Start

(async function init() {
  paintIcons();
  applyTheme(document.documentElement.getAttribute('data-theme') || 'light');
  loadSession();
  if (state.token) {
    // Check the saved token
    try { state.user = (await api('GET', '/auth/me')).data; saveSession(); } catch (e) { state.token = null; state.user = null; }
  }
  go(location.hash.slice(1) || 'home', true);
})();
