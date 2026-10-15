
const API = String(
  window.EVENTUSMY_CONFIG?.apiBaseUrl || '/event-api/api'
).replace(/\/+$/, '');

let token = null;
let user = null;
let evPage = 1;

const $ = (id) => document.getElementById(id);

// NEW: Sort newest records first
function newestFirst(records, dateField = 'created_at') {
  return [...(records || [])].sort((a, b) => {
    const aDate = String(a[dateField] || '');
    const bDate = String(b[dateField] || '');

    if (aDate && bDate && aDate !== bDate) {
      return bDate.localeCompare(aDate);
    }

    return Number(b.id) - Number(a.id);
  });
}

function esc(v) {
  return String(v == null ? '' : v).replace(
    /[&<>"']/g,
    (c) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[c])
  );
}

function getEventStatus(event) {
  const status = String(event.status || '').toLowerCase();

  if (status === 'cancelled') return 'cancelled';
  if (status === 'completed') return 'completed';

  const date = String(event.event_date || '');
  const time = String(event.start_time || '00:00:00').slice(0, 8);
  const eventStart = new Date(date + 'T' + time + '+08:00');

  if (
    !Number.isNaN(eventStart.getTime()) &&
    eventStart.getTime() <= Date.now()
  ) {
    return 'completed';
  }

  if (Number(event.tickets_available) <= 0) return 'sold-out';

  return 'upcoming';
}

function eventStatusBadge(event) {
  const status = getEventStatus(event);

  const labels = {
    upcoming: 'Upcoming',
    'sold-out': 'Sold Out',
    cancelled: 'Cancelled',
    completed: 'Completed'
  };

  return '<span class="status-badge status-' +
    status + '">' + labels[status] + '</span>';
}

// Featured upcoming event
async function loadFeaturedEvent() {
  const spot = $('heroFeatured');
  if (!spot) return;

  try {
    let featured = null;
    let page = 1;
    let totalPages = 1;

    do {
      const response = await api(
        'GET',
        '/events?status=upcoming&limit=100&page=' + page
      );

      featured = (response.data || []).find(
        event => getEventStatus(event) === 'upcoming'
      );

      totalPages = Number(response.pagination?.total_pages || 1);
      page += 1;
    } while (!featured && page <= totalPages);

    if (!featured) {
      spot.innerHTML =
        '<div class="feature-card-top">' +
        '<span class="feature-kicker">EVENT UPDATE</span>' +
        '<span aria-hidden="true">✳</span></div>' +
        '<h2>No upcoming events yet</h2>' +
        '<p>Please check back soon.</p>' +
        '<span class="feature-foot">EVENTUSMY ' +
        '<span>✧</span> EVENT PASS</span>';
      return;
    }

    const date = String(featured.event_date || '');

    const formattedDate = /^\d{4}-\d{2}-\d{2}$/.test(date)
      ? new Date(date + 'T12:00:00').toLocaleDateString(
          'en-MY',
          { day: 'numeric', month: 'short', year: 'numeric' }
        )
      : date;

    spot.innerHTML =
      '<div class="feature-card-top">' +
      '<span class="feature-kicker">ONE TO CHECK OUT</span>' +
      '<span aria-hidden="true">✳</span></div>' +
      '<span class="feature-intro">Upcoming event</span>' +
      '<h2>' + esc(featured.title) + '</h2>' +
      '<p>⌖ ' + esc(featured.venue_city || 'Malaysia') +
      ' &nbsp; · &nbsp; ' + esc(formattedDate) + '</p>' +
      '<span class="feature-foot">EVENTUSMY ' +
      '<span>✧</span> EVENT PASS</span>';

  } catch (error) {
    spot.innerHTML =
      '<div class="feature-card-top">' +
      '<span class="feature-kicker">EVENT UPDATE</span></div>' +
      '<h2>Events unavailable</h2>' +
      '<p>Please try again later.</p>';
  }
}

function say(text, bad) {
  $('msg').textContent = text;
  $('msg').style.color = bad ? 'red' : 'green';
}

// Shared API function
async function api(method, path, body) {
  const headers = {};

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  if (token) {
    headers['Authorization'] = 'Bearer ' + token;
  }

  let res;
  try {
    res = await fetch(API + path, {
      method,
      headers,
      body: body === undefined
        ? undefined
        : JSON.stringify(body) 
      });
  } 
  catch (e) {
    console.error('[EventUsMy API] Connection failed:', API + path, e);
    say(
      'Cannot connect to the server. Please make sure Apache and MySQL are running.',
      true
    );
    throw e;
  }
  const json = await res.json().catch(() => null);

  if (!json || !json.success) {
    const err = (json && json.error) || {
      code: res.status,
      message: 'Unexpected response'
    };

    let t = 'Error ' + err.code + ': ' + err.message;

    if (err.details) {
      t += ' (' + Object.values(err.details).join('; ') + ')';
    }

    if (res.status === 404 && !json) {
      t += ' - Backend API not found. Check js/config.js and Apache rewrite settings.';
    }

    if (res.status === 500) {
      t += ' - Check MySQL, database.sql and DB_PASS in the backend configuration.';
    }

    console.error(
      '[EventUsMy API]',
      method,
      API + path,
      'HTTP ' + res.status,
      json || '(non-JSON response)'
    );

    say(t, true);

    if (res.status === 401 && token) {
      logoutLocal();
    }

    throw err;
  }

  return json;
}

// Create HTML table
function table(headers, rows) {
  if (!rows.length) return '<p>(nothing here)</p>';

  return '<table border="1" cellpadding="4"><tr>' +
    headers.map(h => '<th>' + h + '</th>').join('') +
    '</tr>' +
    rows.map(
      r => '<tr>' +
      r.map(c => '<td>' + c + '</td>').join('') +
      '</tr>'
    ).join('') +
    '</table>';
}

// Role-based navigation
function showSections() {
  const role = user ? user.role : null;

  $('secAuth').hidden = !!user;

  $('who').innerHTML = user
    ? '<div class="logged-user">' +
      '<span class="user-avatar">' +
      esc(user.name).charAt(0).toUpperCase() +
      '</span><div><small>Signed in as</small><b>' +
      esc(user.name) +
      '</b><span>' + esc(user.role) +
      '</span></div></div>' +
      '<button id="btnLogout" class="btn btn-outline fill">' +
      'Log out</button>'
    : '';

  const nav = [['events', '🎟️  Explore Events']];

  if (!user) {
    nav.push(
      ['login', '🔑  Login'],
      ['register', '📝  Register']
    );
  }

  if (role === 'customer') {
    nav.push(['my', '▤  My Bookings']);
  }

  if (role === 'organiser') {
    nav.push(
      ['manage', '▣  Manage Events'],
      ['form', '+  Add / Edit Event'],
      ['own-bookings', '▤  Event Bookings']
    );
  }

  if (role === 'admin') {
    nav.push(
      ['admin', '⚙  Users'],
      ['admin-venues', '⌖  Venues'],
      ['admin-events', '▣  Events'],
      ['admin-bookings', '▤  Bookings'],
      ['form', '+  Add Event']
    );
  }

  $('nav').innerHTML = nav.map(
    ([route, label]) =>
      '<button type="button" data-go="' +
      route + '">' + label + '</button>'
  ).join('');
}

function go(where, skipDataLoad = false) {
  const role = user?.role || null;

  const adminViews = [
    'admin', 'admin-venues',
    'admin-events', 'admin-bookings'
  ];

  const organiserViews = [
    'manage', 'own-bookings', 'form'
  ];

  if (adminViews.includes(where) && role !== 'admin') {
    where = 'events';
  }

  if (
    organiserViews.includes(where) &&
    !['admin', 'organiser'].includes(role)
  ) {
    where = 'events';
  }

  if (where === 'my' && role !== 'customer') {
    where = 'events';
  }

  if (['login', 'register'].includes(where) && user) {
    where = 'events';
  }

  const managing = [
    'manage', 'form', 'own-bookings',
    'admin-events', 'admin-bookings'
  ].includes(where);

  const administering = [
    'admin', 'admin-venues'
  ].includes(where);

  [
    'secEvents', 'secBooking', 'secMy',
    'secManage', 'secAdmin', 'secLogin', 'secRegister'
  ].forEach(id => {
    $(id).hidden = true;
  });

  $('secEvents').hidden = where !== 'events';
  $('secBooking').hidden = where !== 'booking';
  $('secMy').hidden = where !== 'my';
  $('secManage').hidden = !managing;
  $('secAdmin').hidden = !administering;
  $('secLogin').hidden = where !== 'login';
  $('secRegister').hidden = where !== 'register';

  $('manageEventsPanel').hidden =
    !['manage', 'admin-events'].includes(where);

  $('manageFormPanel').hidden = where !== 'form';

  $('manageBookingsPanel').hidden =
    !['own-bookings', 'admin-bookings'].includes(where);

  $('ttBox').hidden = true;

  $('adminUsersPanel').hidden = where !== 'admin';
  $('adminVenuesPanel').hidden = where !== 'admin-venues';

  document.querySelectorAll('#nav [data-go]').forEach(button => {
    const active = button.dataset.go === where;

    button.classList.toggle('is-active', active);

    if (active) {
      button.setAttribute('aria-current', 'page');
    } else {
      button.removeAttribute('aria-current');
    }
  });

  if (where === 'events') {
    loadEvents();
    loadFeaturedEvent();
  }

  if (where === 'my') loadMyBookings();
  if (managing && !skipDataLoad) loadManage();
  if (administering && !skipDataLoad) loadAdmin();

  window.scrollTo({ top: 0, behavior: 'instant' });
}

function logoutLocal() {
  token = null;
  user = null;

  $('detail').innerHTML = '';

  showSections();
  go('events');
}

// Login
$('loginForm').onsubmit = async (ev) => {
  ev.preventDefault();

  const f = ev.target.elements;

  try {
    const r = await api('POST', '/auth/login', {
      email: f.email.value,
      password: f.password.value
    });

    token = r.data.token;
    user = r.data.user;

    say('Welcome ' + user.name, false);

    showSections();
    go('events');
  } catch (e) {}
};

// Register
$('registerForm').onsubmit = async (ev) => {
  ev.preventDefault();

  const f = ev.target.elements;

  try {
    await api('POST', '/auth/register', {
      name: f.name.value,
      email: f.email.value,
      password: f.password.value
    });

    say('Account created. You can log in now.', false);

    ev.target.reset();
    go('login');
  } catch (e) {}
};

// Navigation and logout
document.addEventListener('click', async (e) => {
  const t = e.target;

  if (t.id === 'btnLogout') {
    try {
      await api('POST', '/auth/logout');
    } catch (x) {}

    say('Logged out', false);
    logoutLocal();
  }

  const navButton = t.closest && t.closest('[data-go]');

  if (navButton) {
    if (navButton.dataset.go === 'form') {
      resetEventForm();
    }

    go(navButton.dataset.go);
  }
});

// Explore Events
async function loadEvents() {
  const f = $('filterForm').elements;

  const q = new URLSearchParams({
    page: evPage,
    limit: 6
  });

  if (f.search.value) q.set('search', f.search.value);
  if (f.city.value) q.set('city', f.city.value);
  if (f.date.value) q.set('date', f.date.value);

  $('eventList').innerHTML =
    '<div class="loading-box">Loading events...</div>';

  try {
    const r = await api('GET', '/events?' + q);
    const colors = ['blue', 'pink', 'green', 'cream'];

    $('eventList').innerHTML = r.data.length
      ? r.data.map((e, idx) => {
          const date = String(e.event_date || '');

          const formattedDate = /^\d{4}-\d{2}-\d{2}$/.test(date)
            ? new Date(date + 'T12:00:00').toLocaleDateString(
                'en-MY',
                {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric'
                }
              )
            : date;

          const price = Number(e.ticket_price);

          const money = Number.isFinite(price)
            ? price.toFixed(2)
            : esc(e.ticket_price);

          const tone = colors[idx % colors.length];

          return '<article class="event-card">' +
            '<div class="card-cover cover-' + tone + '">' +
            '<span class="cover-label">EVENT ' +
            String((evPage - 1) * 6 + idx + 1).padStart(2, '0') +
            '</span>' +
            '<span class="cover-symbol" aria-hidden="true">' +
            (['✳', '✿', '✦', '❋'][idx % 4]) +
            '</span>' +
            '<span class="cover-poster-title">' +
            esc(e.title) +
            '</span>' +
            '<span class="cover-city">⌖ ' +
            esc(e.venue_city || 'Malaysia') +
            '</span></div>' +
            '<div class="card-body">' +
            '<div class="card-topline">' +
            '<span>' + esc(formattedDate) + '</span>' +
            eventStatusBadge(e) +
            '</div>' +
            '<h3>' + esc(e.title) + '</h3>' +
            '<p class="card-location">⌖ ' +
            esc(e.venue_name) + ', ' +
            esc(e.venue_city) +
            '</p>' +
            '<div class="card-bottom">' +
            '<div><small>From</small><b>RM ' +
            money + '</b></div>' +
            '<button class="btn btn-outline" data-view="' +
            Number(e.id) +
            '">View details →</button></div>' +
            '</div></article>';
        }).join('')
      : '<div class="empty-box">' +
        '<h3>No events found</h3>' +
        '<p>Try changing your search filters.</p></div>';

    const p = r.pagination || {
      page: evPage,
      total_pages: 1,
      total: r.data.length
    };

    $('eventPager').innerHTML =
      '<span>Page ' + Number(p.page) +
      ' of ' + Number(p.total_pages) +
      ' · ' + Number(p.total) + ' events</span>' +
      '<span class="pager-buttons">' +
      (
        p.page > 1
          ? '<button data-page="' + (p.page - 1) +
            '">← Previous</button>'
          : ''
      ) +
      (
        p.page < p.total_pages
          ? '<button data-page="' + (p.page + 1) +
            '">Next →</button>'
          : ''
      ) +
      '</span>';

  } catch (e) {
    $('eventList').innerHTML =
      '<div class="empty-box">' +
      '<h3>Unable to load events</h3>' +
      '<p>Please check that XAMPP and the shared API are running.</p>' +
      '</div>';
  }
}

$('filterForm').onsubmit = (ev) => {
  ev.preventDefault();
  evPage = 1;
  loadEvents();
};

$('btnClear').onclick = () => {
  $('filterForm').reset();
  evPage = 1;
  loadEvents();
};

$('secEvents').addEventListener('click', (e) => {
  if (e.target.dataset.page) {
    evPage = +e.target.dataset.page;
    loadEvents();
  }

  if (e.target.dataset.view) {
    showEvent(+e.target.dataset.view);
  }
});

// Event Details
async function showEvent(id) {
  try {
    const e = (await api('GET', '/events/' + id)).data;

    const types = (
      await api('GET', '/events/' + id + '/ticket-types?limit=100')
    ).data;

    const displayStatus = getEventStatus(e);

    let html =
      '<div class="detail-header">' +
      '<span class="eyebrow">EVENT DETAILS</span>' +
      '<h3>' + esc(e.title) + '</h3></div>' +
      '<p>' + esc(e.description) + '</p>' +
      '<p>' + e.event_date + ', ' +
      e.start_time.slice(0, 5) + ' - ' +
      e.end_time.slice(0, 5) + '<br>' +
      esc(e.venue_name) + ', ' +
      esc(e.venue_address) + ', ' +
      esc(e.venue_city) +
      '<br>Organiser: ' + esc(e.organiser_name) +
      '<br>Status: ' + eventStatusBadge(e) + '</p>' +
      '<button class="btn btn-soft" id="btnWeather">' +
      'Check weather</button>' +
      '<pre id="weather"></pre>' +
      '<h4>Ticket types</h4>' +
      table(
        ['Name', 'Price (RM)', 'Left', 'Total'],
        newestFirst(types).map(t => [
          esc(t.name),
          t.price,
          t.sold_out ? 'SOLD OUT' : t.quantity_available,
          t.quantity
        ])
      );

    const open = types.filter(t => !t.sold_out);

    if (displayStatus !== 'upcoming') {
      html += '<p>This event is ' +
        displayStatus.replace('-', ' ') +
        ' - booking closed.</p>';

    } else if (!open.length) {
      html += '<p>Sold out.</p>';

    } else if (!user) {
      html += '<p>Log in as a customer to book.</p>';

    } else if (user.role !== 'customer') {
      html += '<p>Only customers can book.</p>';

    } else {
      html +=
        '<h4>Book tickets</h4>' +
        '<form id="bookForm" class="booking-form">' +
        'Ticket type <select name="ticket_type_id">' +
        open.map(
          t => '<option value="' + t.id + '">' +
            esc(t.name) + ' - RM ' + t.price +
            ' (' + t.quantity_available + ' left)</option>'
        ).join('') +
        '</select> Quantity ' +
        '<input name="quantity" type="number" min="1" ' +
        'value="1" required>' +
        '<button type="submit" class="btn btn-main">' +
        'Book tickets →</button></form>';
    }

    $('detail').innerHTML = html;

    go('booking');

    $('detail').scrollIntoView({
      behavior: window.matchMedia(
        '(prefers-reduced-motion: reduce)'
      ).matches ? 'auto' : 'smooth',
      block: 'start'
    });

    $('btnWeather').onclick = async () => {
      try {
        const w = await api(
          'GET',
          '/events/' + id + '/weather'
        );

        $('weather').textContent =
          w.message + '\n' +
          w.data.forecast.map(
            d => d.date + '  ' + d.condition +
              '  ' + d.temp_min_c + '-' +
              d.temp_max_c + 'C  rain ' +
              d.rain_chance_percent + '%'
          ).join('\n');

      } catch (x) {}
    };

    if ($('bookForm')) {
      $('bookForm').onsubmit = async (ev) => {
        ev.preventDefault();

        const f = ev.target.elements;

        try {
          await api('POST', '/bookings', {
            event_id: id,
            ticket_type_id: +f.ticket_type_id.value,
            quantity: +f.quantity.value
          });

          say('Booking confirmed!', false);
          go('my');

        } catch (x) {}
      };
    }

  } catch (x) {}
}

// Customer My Bookings - newest booking first
async function loadMyBookings() {
  try {
    const r = await api('GET', '/bookings?limit=100');

    const bookings = newestFirst(r.data, 'booked_at');

    $('myList').innerHTML = table(
      [
        'Booking ID', 'Event', 'Date', 'Ticket type',
        'Qty', 'Total (RM)', 'Status', ''
      ],
      bookings.map(b => [
        b.id,
        esc(b.event_title),
        b.event_date,
        esc(b.ticket_type_name || '(removed)'),
        b.quantity,
        b.total_price,
        b.status,
        b.status === 'confirmed'
          ? '<button data-cancel="' + b.id + '">Cancel</button>'
          : ''
      ])
    );

  } catch (e) {}
}

$('secMy').addEventListener('click', async (e) => {
  if (!e.target.dataset.cancel) return;
  if (!confirm('Cancel this booking?')) return;

  try {
    await api(
      'DELETE',
      '/bookings/' + e.target.dataset.cancel
    );

    say('Booking cancelled', false);
    loadMyBookings();

  } catch (x) {}
});

// Organiser and Admin Management
async function loadManage(keepTicketBox) {
  $('organiserField').hidden = user.role !== 'admin';

  $('newEventForm').elements.organiser_id.disabled =
    user.role !== 'admin';

  if (!keepTicketBox) {
    $('ttBox').innerHTML = '';
  }

  try {
    const q = user.role === 'organiser'
      ? '&organiser_id=' + user.id
      : '';

    const r = await api(
      'GET',
      '/events?limit=100' + q
    );

    // NEW: Newest events first
    const events = newestFirst(r.data);

    $('manageEvents').innerHTML = table(
      ['Event ID', 'Title', 'Date', 'Sold', 'Status', ''],
      events.map(e => [
        e.id,
        esc(e.title),
        e.event_date,
        (e.total_tickets - e.tickets_available) +
          '/' + e.total_tickets,
        eventStatusBadge(e),
        '<button data-edit="' + e.id + '">Edit</button> ' +
        '<button data-tt="' + e.id + '">Ticket types</button> ' +
        (
          e.status === 'upcoming'
            ? '<button data-cancelevent="' + e.id +
              '">Cancel event</button> '
            : ''
        ) +
        '<button data-delevent="' + e.id + '">Delete</button>'
      ])
    );

    const v = await api('GET', '/venues?limit=100');

    $('newEventForm').elements.venue_id.innerHTML =
      v.data.map(
        x => '<option value="' + x.id + '">' +
          esc(x.name) + ' (' +
          esc(x.city) + ', capacity ' +
          x.capacity + ')</option>'
      ).join('');

    if (user.role === 'admin') {
      const usersResult = await api(
        'GET',
        '/users?limit=100'
      );

      $('newEventForm').elements.organiser_id.innerHTML =
        '<option value="">Select organiser</option>' +
        usersResult.data
          .filter(person =>
            ['admin', 'organiser'].includes(person.role)
          )
          .map(person =>
            '<option value="' + Number(person.id) + '">' +
            esc(person.name) +
            ' (' + esc(person.role) + ')</option>'
          ).join('');
    }

    const b = await api('GET', '/bookings?limit=100');

    // NEW: Newest bookings first
    const bookings = newestFirst(b.data, 'booked_at');

    $('manageBookings').innerHTML = table(
      [
        'Booking ID', 'Event', 'Customer', 'Ticket type',
        'Qty', 'Total (RM)', 'Status', ''
      ],
      bookings.map(x => [
        x.id,
        esc(x.event_title),
        esc(x.customer_name),
        esc(x.ticket_type_name || '(removed)'),
        x.quantity,
        x.total_price,
        x.status,
        user.role === 'admin'
          ? '<button data-delbooking="' + x.id +
            '">Delete</button>'
          : ''
      ])
    );

  } catch (e) {}
}

$('secManage').addEventListener('click', async (e) => {
  const d = e.target.dataset;

  try {
    if (
      d.cancelevent &&
      confirm('Cancel this event? Its bookings are cancelled too.')
    ) {
      await api('PUT', '/events/' + d.cancelevent, {
        status: 'cancelled'
      });

      say('Event cancelled', false);
      loadManage();
    }

    if (
      d.delevent &&
      confirm('Delete this event and its bookings?')
    ) {
      await api(
        'DELETE',
        '/events/' + d.delevent
      );

      say('Event deleted', false);
      loadManage();
    }

    if (
      d.delbooking &&
      confirm('Delete this booking record?')
    ) {
      await api(
        'DELETE',
        '/bookings/' + d.delbooking
      );

      say('Booking deleted', false);
      loadManage();
    }

    if (d.edit) {
      editEvent(+d.edit);
    }

    if (d.tt) {
      $('ttBox').hidden = false;
      showTicketTypes(+d.tt);
    }

  } catch (x) {}
});

// Create and Edit Event
function resetEventForm() {
  const f = $('newEventForm');

  f.reset();
  f.elements.event_id.value = '';

  $('eventFormHeading').textContent = 'Create New Event';
  $('eventSaveButton').textContent = 'Create Event';

  $('eventFormHint').textContent =
    'A Standard ticket type is created automatically. ' +
    'You can add VIP types later.';

  f.elements.ticket_price.disabled = false;
  f.elements.total_tickets.disabled = false;
  f.elements.organiser_id.disabled = user?.role !== 'admin';
}

$('eventFormClear').onclick = resetEventForm;

async function editEvent(id) {
  try {
    const e = (
      await api('GET', '/events/' + id)
    ).data;

    if (
      user.role === 'organiser' &&
      Number(e.organiser_id) !== Number(user.id)
    ) {
      say('You may only edit your own events.', true);
      return;
    }

    go('form', true);

    await loadManage();

    const f = $('newEventForm').elements;

    f.event_id.value = e.id;
    f.title.value = e.title || '';
    f.description.value = e.description || '';
    f.venue_id.value = e.venue_id;
    f.event_date.value = e.event_date;

    f.start_time.value = String(e.start_time).slice(0, 5);
    f.end_time.value = String(e.end_time).slice(0, 5);

    f.ticket_price.value = e.ticket_price;
    f.total_tickets.value = e.total_tickets;

    if (user.role === 'admin') {
      f.organiser_id.value = e.organiser_id;
    }

    f.ticket_price.disabled = true;
    f.total_tickets.disabled = true;
    f.organiser_id.disabled = true;

    $('eventFormHeading').textContent = 'Edit Event #' + e.id;
    $('eventSaveButton').textContent = 'Save Changes';

    $('eventFormHint').textContent =
      'Edit event title, venue, date or time. ' +
      'Ticket prices and quantities must be edited ' +
      'from the Ticket Types section.';

  } catch (error) {}
}

$('newEventForm').onsubmit = async (ev) => {
  ev.preventDefault();

  const f = ev.target.elements;
  const id = Number(f.event_id.value) || null;

  const body = {
    venue_id: Number(f.venue_id.value),
    title: f.title.value,
    description: f.description.value,
    event_date: f.event_date.value,
    start_time: f.start_time.value,
    end_time: f.end_time.value
  };

  if (!id) {
    body.ticket_price = Number(f.ticket_price.value);
    body.total_tickets = Number(f.total_tickets.value);

    if (user.role === 'admin') {
      body.organiser_id = Number(f.organiser_id.value);
    }
  }

  try {
    if (id) {
      await api('PUT', '/events/' + id, body);
    } else {
      await api('POST', '/events', body);
    }

    say(
      id
        ? 'Event updated successfully.'
        : 'Event created successfully.',
      false
    );

    resetEventForm();

    go(
      user.role === 'admin'
        ? 'admin-events'
        : 'manage'
    );

  } catch (error) {}
}

// Manage Ticket Types
async function showTicketTypes(eventId) {
  try {
    const types = (
      await api(
        'GET',
        '/events/' + eventId + '/ticket-types?limit=100'
      )
    ).data;

    // NEW: Newest ticket types first
    const sortedTypes = newestFirst(types);

    $('ttBox').innerHTML =
      '<hr><h3>Ticket types of event ' +
      eventId + '</h3>' +

      table(
        [
          'Ticket Type ID', 'Name', 'Price (RM)',
          'Sold', 'Left', 'Total', ''
        ],
        sortedTypes.map(t => [
          t.id,
          esc(t.name),
          t.price,
          t.sold,
          t.quantity_available,
          t.quantity,
          '<button data-ttedit="' + t.id + '">Edit</button> ' +
          '<button data-ttdel="' + t.id + '">Delete</button>'
        ])
      ) +

      '<form id="ttForm">' +
      '<input type="hidden" name="id">' +
      'Name <input name="name" required> ' +
      'Price <input name="price" type="number" ' +
      'min="0" step="0.01" required> ' +
      'Quantity <input name="quantity" type="number" ' +
      'min="1" required> ' +
      '<button type="submit">Save ticket type</button> ' +
      '<button type="button" id="ttReset">' +
      'Clear form</button></form><hr>';

    $('ttReset').onclick = () => {
      $('ttForm').reset();
    };

    $('ttBox').onclick = async (e) => {
      const d = e.target.dataset;

      if (d.ttedit) {
        const t = types.find(
          x => x.id === +d.ttedit
        );

        const f = $('ttForm').elements;

        f.id.value = t.id;
        f.name.value = t.name;
        f.price.value = t.price;
        f.quantity.value = t.quantity;
      }

      if (
        d.ttdel &&
        confirm('Delete this ticket type?')
      ) {
        try {
          await api(
            'DELETE',
            '/ticket-types/' + d.ttdel
          );

          say('Ticket type deleted', false);

          showTicketTypes(eventId);
          loadManage(true);

        } catch (x) {}
      }
    };

    $('ttForm').onsubmit = async (ev) => {
      ev.preventDefault();

      const f = ev.target.elements;

      const body = {
        name: f.name.value,
        price: +f.price.value,
        quantity: +f.quantity.value
      };

      try {
        if (f.id.value) {
          await api(
            'PUT',
            '/ticket-types/' + f.id.value,
            body
          );
        } else {
          await api(
            'POST',
            '/events/' + eventId + '/ticket-types',
            body
          );
        }

        say('Ticket type saved', false);

        showTicketTypes(eventId);
        loadManage(true);

      } catch (x) {}
    };

  } catch (x) {}
}

// Admin Users and Venues
async function loadAdmin() {
  try {
    const u = await api(
      'GET',
      '/users?limit=100'
    );

    // NEW: Newest users first
    const users = newestFirst(u.data);

    $('userList').innerHTML = table(
      ['User ID', 'Name', 'Email', 'Role', ''],
      users.map(x => [
        x.id,
        esc(x.name),
        esc(x.email),
        x.role,
        x.id === user.id
          ? ''
          : '<button data-deluser="' + x.id +
            '">Delete</button>'
      ])
    );

    const v = await api(
      'GET',
      '/venues?limit=100'
    );

    // NEW: Newest venues first
    const venues = newestFirst(v.data);

    $('venueList').innerHTML = table(
      ['Venue ID', 'Name', 'City', 'Capacity', ''],
      venues.map(x => [
        x.id,
        esc(x.name),
        esc(x.city),
        x.capacity,
        '<button data-delvenue="' + x.id +
        '">Delete</button>'
      ])
    );

  } catch (e) {}
}

$('secAdmin').addEventListener('click', async (e) => {
  const d = e.target.dataset;

  try {
    if (
      d.deluser &&
      confirm('Delete this user?')
    ) {
      await api(
        'DELETE',
        '/users/' + d.deluser
      );

      say('User deleted', false);
      loadAdmin();
    }

    if (
      d.delvenue &&
      confirm('Delete this venue?')
    ) {
      await api(
        'DELETE',
        '/venues/' + d.delvenue
      );

      say('Venue deleted', false);
      loadAdmin();
    }

  } catch (x) {}
});

// Add User
$('userForm').onsubmit = async (ev) => {
  ev.preventDefault();

  const f = ev.target.elements;

  try {
    await api('POST', '/users', {
      name: f.name.value,
      email: f.email.value,
      password: f.password.value,
      role: f.role.value
    });

    say('User created', false);

    ev.target.reset();
    loadAdmin();

  } catch (x) {}
};

// Add Venue
$('venueForm').onsubmit = async (ev) => {
  ev.preventDefault();

  const f = ev.target.elements;

  try {
    await api('POST', '/venues', {
      name: f.name.value,
      address: f.address.value,
      city: f.city.value,
      capacity: +f.capacity.value
    });

    say('Venue created', false);

    ev.target.reset();
    loadAdmin();

  } catch (x) {}
};

// Initialise website
showSections();
go('events');
