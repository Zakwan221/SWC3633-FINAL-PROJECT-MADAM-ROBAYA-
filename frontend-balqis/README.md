# EventUsMy — Section 7.4 Frontend (Balqis)

A multi-view, pastel frontend for the shared PHP REST API. It uses one `index.html` with separate **screens/views** and navigation for three roles. It does **not** change the shared backend or database. Frontend pages are separate sections within a single-page application, not separate HTML files.

## Setup in XAMPP

1. Make sure your backend folder is `C:\xampp\htdocs\event-api\` and includes `api\index.php`. Import the shared `event-api/database.sql` into MySQL **only if it hasn't already been imported**. The SQL script may overwrite existing data, so back up first.
2. Extract the folder `event-frontend-balqis` next to `event-api` in `C:\xampp\htdocs\`.
3. Open `js/config.js`; the base URL must match your actual backend name. Default: `/event-api/api`.
4. Start XAMPP Apache and MySQL. Open `http://localhost/event-api/api`, then `http://localhost/event-api/api/events` in Chrome to check the backend.
5. Open `http://localhost/event-frontend-balqis/` in Chrome. Hard refresh with Ctrl + F5 if it shows old files.
6. Log in using the existing test credentials **kept privately**. The frontend deliberately does not display demo passwords.

## Screenshot checklist for PDF Section 7.4

| PDF figure | Where to navigate | What to capture |
| --- | --- | --- |
| 7.4.1-1 Login | Sidebar -> Login | Empty login form |
| 7.4.1-2 Register | Sidebar -> Register | Registration form |
| 7.4.2-1 Users | Log in as Admin -> Users | Users list and Add User form |
| 7.4.2-2 Venues | Admin -> Venues | Venues list and Add Venue form |
| 7.4.2-3 Events | Admin -> Events | Events list, actions |
| 7.4.2-4 Bookings | Admin -> Bookings | All bookings |
| 7.4.3-1 Manage Events | Log in as Organiser -> Manage Events | Own event list |
| 7.4.3-2 Add/edit event form | Organiser -> Add/Edit Event or click Edit | Create/edit event form |
| 7.4.3-3 Bookings of own events | Organiser -> Event Bookings | Filtered booking list returned by shared API |
| 7.4.4-1 Events list with search | Customer -> Explore Events | Filter box and actual event cards |
| 7.4.4-2 Booking form | Customer -> Explore Events -> View details | Event details + available ticket types + form |
| 7.4.4-3 My bookings and cancel | Customer -> My Bookings | Booking list and Cancel action |
| 7.4.5-1 API call code | VS Code -> `js/app.js` | `api()` and a real `fetch`/booking call |
| 7.4.5-2 Browser Network tab | Chrome -> F12 -> Network -> Fetch/XHR -> run an action | Request and JSON response; **redact the bearer token** |

**Important:** Only use screenshots captured from your own *running* system for the assignment. Do not use simulated data or a mock screenshot as evidence. Screenshot testing can be done without creating new pages for Section 7.4.5; that is developer-tool evidence, not a frontend page.

## Feature notes

- Customer: browse/search events, open event details, view ticket types, book available tickets, view/cancel own bookings.
- Organiser: manage own events, create/edit events, manage ticket types, view bookings for events they own.
- Admin: users, venues, events, bookings, create/edit events and manage ticket types.
- **Editing an event** uses `PUT /events/{id}` only for permitted fields. Price/quantity are intentionally disabled on edit because the backend requires ticket type edits (`PUT /ticket-types/{id}`) for those fields.
- Availability-based `Sold Out` is a **frontend display label**, not a new database status.
- Interface navigation changes which HTML sections are shown; the server still enforces authorization.
- Auth bearer token stays in memory and is lost on page reload; log in again after refreshing.
- Actual integration testing with Apache, MySQL and your live Postman collection is still needed.

## Files

- `index.html` — interface and all Section 7.4 screens
- `css/style.css` — pastel blue, pink, sage green and cream styling
- `js/config.js` — frontend/backend API path
- `js/app.js` — API requests, navigation and CRUD handlers
