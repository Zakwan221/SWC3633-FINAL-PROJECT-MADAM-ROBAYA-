<?php
// Events, weather and venue rules

class EventController
{
    private const STATUSES = ['upcoming', 'cancelled', 'completed'];

    // Select an event with its venue and organiser
    private const SELECT = 'SELECT e.*, v.name AS venue_name, v.city AS venue_city, v.address AS venue_address,
                                   u.name AS organiser_name
                            FROM events e
                            JOIN venues v ON v.id = e.venue_id
                            JOIN users  u ON u.id = e.organiser_id';


    public static function index(): void
    {
        [$page, $limit, $offset] = get_pagination();

        // Build the filters
        $where = [];
        $params = [];

        if (!empty($_GET['search'])) {
            $where[] = '(e.title LIKE ? OR e.description LIKE ? OR v.name LIKE ?)';
            $like = '%' . $_GET['search'] . '%';
            array_push($params, $like, $like, $like);
        }
        if (!empty($_GET['city'])) {
            $where[] = 'v.city = ?';
            $params[] = $_GET['city'];
        }
        if (!empty($_GET['date'])) {
            if (!is_valid_date($_GET['date'])) {
                fail_validation(['date' => 'date must be a real date in YYYY-MM-DD format']);
            }
            $where[] = 'e.event_date = ?';
            $params[] = $_GET['date'];
        }
        if (!empty($_GET['status'])) {
            if (!in_array($_GET['status'], self::STATUSES, true)) {
                fail_validation(['status' => 'status must be upcoming, cancelled or completed']);
            }
            $where[] = 'e.status = ?';
            $params[] = $_GET['status'];
        }
        if (!empty($_GET['organiser_id'])) {
            $where[] = 'e.organiser_id = ?';
            $params[] = (int) $_GET['organiser_id'];
        }
        $whereSql = $where ? 'WHERE ' . implode(' AND ', $where) : '';

        $db = getDB();
        $count = $db->prepare("SELECT COUNT(*) FROM events e JOIN venues v ON v.id = e.venue_id $whereSql");
        $count->execute($params);
        $total = (int) $count->fetchColumn();

        $stmt = $db->prepare(self::SELECT . " $whereSql ORDER BY e.event_date, e.start_time LIMIT $limit OFFSET $offset");
        $stmt->execute($params);

        json_success(array_map([self::class, 'format'], $stmt->fetchAll()), 'Events retrieved', 200, pagination_meta($page, $limit, $total));
    }

    public static function show(int $id): void
    {
        json_success(self::format(self::findOr404($id)), 'Event retrieved');
    }

    // Weather from Open-Meteo

    // GET /events/{id}/weather
    public static function weather(int $id): void
    {
        $event = self::findOr404($id);
        $city = $event['venue_city'];

        // Get the city coordinates
        $geo = self::httpGetJson('https://geocoding-api.open-meteo.com/v1/search?' . http_build_query([
            'name' => $city, 'count' => 1, 'language' => 'en', 'format' => 'json', 'country_code' => 'MY',
        ]));
        if (empty($geo['results'][0])) {
            json_error(404, "Could not find the location of '$city' for the weather forecast");
        }
        $place = $geo['results'][0];

        // Choose which days to ask for
        $today = date('Y-m-d');
        $daysAway = (int) floor((strtotime($event['event_date']) - strtotime($today)) / 86400);

        if ($daysAway < 0) {
            self::weatherResponse($event, $place, 'none', [], 'This event date has already passed, no forecast available');
        }
        if ($daysAway <= 15) {
            $type = 'event_date';
            $start = $end = $event['event_date'];
            $note = 'Forecast for the event day';
        } else {
            $type = 'outlook';
            $start = $today;
            $end = date('Y-m-d', strtotime('+6 days'));
            $note = 'Event is more than 16 days away, so here is the 7-day outlook for the venue city instead';
        }

        // Get the daily forecast
        $forecast = self::httpGetJson('https://api.open-meteo.com/v1/forecast?' . http_build_query([
            'latitude'   => $place['latitude'],
            'longitude'  => $place['longitude'],
            'daily'      => 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max',
            'timezone'   => 'Asia/Kuala_Lumpur',
            'start_date' => $start,
            'end_date'   => $end,
        ]));
        if (empty($forecast['daily']['time'])) {
            json_error(500, 'Weather service returned no data');
        }

        $d = $forecast['daily'];
        $days = [];
        foreach ($d['time'] as $i => $date) {
            $days[] = [
                'date'                 => $date,
                'condition'            => self::weatherText($d['weather_code'][$i] ?? null),
                'temp_max_c'           => $d['temperature_2m_max'][$i] ?? null,
                'temp_min_c'           => $d['temperature_2m_min'][$i] ?? null,
                'rain_chance_percent'  => $d['precipitation_probability_max'][$i] ?? null,
                'rain_mm'              => $d['precipitation_sum'][$i] ?? null,
                'wind_max_kmh'         => $d['wind_speed_10m_max'][$i] ?? null,
            ];
        }
        self::weatherResponse($event, $place, $type, $days, $note);
    }

    private static function weatherResponse(array $event, array $place, string $type, array $days, string $note): void
    {
        json_success([
            'event_id'      => (int) $event['id'],
            'event_title'   => $event['title'],
            'event_date'    => $event['event_date'],
            'location'      => [
                'city'      => $event['venue_city'],
                'matched'   => $place['name'] ?? $event['venue_city'],
                'latitude'  => $place['latitude'],
                'longitude' => $place['longitude'],
            ],
            'forecast_type' => $type,   // event_date, outlook or none
            'forecast'      => $days,
            'source'        => 'Open-Meteo (open-meteo.com)',
        ], $note);
    }

    // Call a URL and read the JSON
    private static function httpGetJson(string $url): array
    {
        $data = null;
        // Try twice because the weather service can time out
        for ($try = 1; $try <= 2 && !is_array($data); $try++) {
            $ch = curl_init($url);
            curl_setopt_array($ch, [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_TIMEOUT        => 6,
                CURLOPT_CONNECTTIMEOUT => 3,
                CURLOPT_HTTPHEADER     => ['Accept: application/json'],
            ]);
            $body = curl_exec($ch);
            $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            if ($body === false) {
                error_log('[event-api] weather curl error: ' . curl_error($ch));
            }
            curl_close($ch);
            $data = ($body !== false && $status === 200) ? json_decode($body, true) : null;
        }

        if (!is_array($data)) {
            json_error(500, 'Weather service is not available right now. Please try again later');
        }
        return $data;
    }

    // Convert weather codes to text
    private static function weatherText($code): string
    {
        $map = [
            0 => 'Clear sky', 1 => 'Mainly clear', 2 => 'Partly cloudy', 3 => 'Overcast',
            45 => 'Fog', 48 => 'Freezing fog',
            51 => 'Light drizzle', 53 => 'Drizzle', 55 => 'Heavy drizzle',
            61 => 'Light rain', 63 => 'Rain', 65 => 'Heavy rain',
            80 => 'Light rain showers', 81 => 'Rain showers', 82 => 'Violent rain showers',
            95 => 'Thunderstorm', 96 => 'Thunderstorm with hail', 99 => 'Thunderstorm with heavy hail',
        ];
        return $map[$code] ?? 'Unknown (code ' . ($code ?? 'n/a') . ')';
    }


    public static function store(): void
    {
        $user = require_role(['admin', 'organiser']);
        $data = get_json_body();

        $required = ['venue_id', 'title', 'event_date', 'start_time', 'end_time', 'ticket_price', 'total_tickets'];
        if ($user['role'] === 'admin') {
            $required[] = 'organiser_id';   // Admin must give the organiser
        }
        $errors = validate_required($data, $required) + self::checkFields($data);
        if (!isset($errors['event_date']) && $data['event_date'] < date('Y-m-d')) {
            $errors['event_date'] = 'event_date cannot be in the past';
        }
        if (!isset($errors['start_time']) && !isset($errors['end_time']) && normalise_time($data['end_time']) <= normalise_time($data['start_time'])) {
            $errors['end_time'] = 'end_time must be after start_time';
        }
        if ($errors) {
            fail_validation($errors);
        }

        $organiserId = ($user['role'] === 'admin') ? self::checkOrganiser((int) $data['organiser_id']) : (int) $user['id'];
        $venue = self::checkVenue((int) $data['venue_id'], (int) $data['total_tickets']);

        $db = getDB();
        $db->beginTransaction();
        // Lock the venue row
        $db->prepare('SELECT id FROM venues WHERE id = ? FOR UPDATE')->execute([$venue['id']]);
        self::assertVenueFree($venue['id'], $data['event_date'], normalise_time($data['start_time']), normalise_time($data['end_time']), 0);

        $db->prepare('INSERT INTO events (organiser_id, venue_id, title, description, event_date, start_time, end_time,
                                          ticket_price, total_tickets, tickets_available, status)
                      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')->execute([
            $organiserId,
            $venue['id'],
            trim($data['title']),
            isset($data['description']) ? trim($data['description']) : null,
            $data['event_date'],
            normalise_time($data['start_time']),
            normalise_time($data['end_time']),
            $data['ticket_price'],
            (int) $data['total_tickets'],
            (int) $data['total_tickets'],   // Nothing is sold yet
            'upcoming',
        ]);
        $eventId = (int) $db->lastInsertId();

        // Create the default ticket type
        $db->prepare('INSERT INTO ticket_types (event_id, name, price, quantity, quantity_available) VALUES (?, ?, ?, ?, ?)')
           ->execute([$eventId, 'Standard', $data['ticket_price'], (int) $data['total_tickets'], (int) $data['total_tickets']]);
        sync_event_totals($db, $eventId);
        $db->commit();

        json_success(self::format(self::findOr404($eventId)), 'Event created', 201);
    }

    public static function update(int $id): void
    {
        $user = require_role(['admin', 'organiser']);
        $event = self::findOr404($id);
        self::assertCanManage($user, $event);

        $data = get_json_body();
        $errors = self::checkFields($data);
        $fields = ['venue_id', 'title', 'description', 'event_date', 'start_time', 'end_time', 'ticket_price', 'total_tickets', 'status'];
        if ($user['role'] === 'admin') {
            $fields[] = 'organiser_id';   // Only admin can change the organiser
        }
        $changes = array_intersect_key($data, array_flip($fields));
        if (!$changes) {
            $errors['body'] = 'send at least one of: ' . implode(', ', $fields);
        }
        if ($errors) {
            fail_validation($errors);
        }

        // Ticket fields come from the ticket types
        $typeCount = self::countTicketTypes($id);
        if ($typeCount > 0 && (isset($changes['ticket_price']) || isset($changes['total_tickets']))) {
            json_error(409, 'This event uses ticket types, so ticket_price and total_tickets cannot be set here. Use PUT /ticket-types/{id} instead');
        }

        // Merge the old and new values
        $new = array_merge($event, $changes);
        $new['start_time'] = normalise_time($new['start_time']);
        $new['end_time']   = normalise_time($new['end_time']);
        if ($new['end_time'] <= $new['start_time']) {
            fail_validation(['end_time' => 'end_time must be after start_time']);
        }

        $organiserId = isset($changes['organiser_id']) ? self::checkOrganiser((int) $changes['organiser_id']) : (int) $event['organiser_id'];
        $venue = self::checkVenue((int) $new['venue_id'], (int) $new['total_tickets']);

        // Total cannot go below the sold tickets
        $sold = (int) $event['total_tickets'] - (int) $event['tickets_available'];
        if ((int) $new['total_tickets'] < $sold) {
            json_error(409, "$sold tickets are already sold, total_tickets cannot be lower than that");
        }
        $available = (int) $new['total_tickets'] - $sold;

        $db = getDB();
        $db->beginTransaction();
        // Lock the venue and check the time slot
        $db->prepare('SELECT id FROM venues WHERE id = ? FOR UPDATE')->execute([$venue['id']]);
        if ($new['status'] !== 'cancelled') {
            self::assertVenueFree($venue['id'], $new['event_date'], $new['start_time'], $new['end_time'], $id);
        }
        $cancelling = ($new['status'] === 'cancelled' && $event['status'] !== 'cancelled');
        if ($cancelling) {
            // Cancel the bookings and free the tickets
            $db->prepare("UPDATE bookings SET status = 'cancelled' WHERE event_id = ? AND status = 'confirmed'")->execute([$id]);
            $db->prepare('UPDATE ticket_types SET quantity_available = quantity WHERE event_id = ?')->execute([$id]);
            $available = (int) $new['total_tickets'];
        }
        $db->prepare('UPDATE events SET organiser_id = ?, venue_id = ?, title = ?, description = ?, event_date = ?,
                             start_time = ?, end_time = ?, ticket_price = ?, total_tickets = ?, tickets_available = ?, status = ?
                      WHERE id = ?')->execute([
            $organiserId, $venue['id'], trim($new['title']), $new['description'], $new['event_date'],
            $new['start_time'], $new['end_time'], $new['ticket_price'], (int) $new['total_tickets'], $available, $new['status'],
            $id,
        ]);
        if ($typeCount > 0) {
            sync_event_totals($db, $id);   // Totals follow the ticket types
        }
        $db->commit();

        json_success(self::format(self::findOr404($id)), $cancelling ? 'Event updated and its bookings were cancelled' : 'Event updated');
    }

    public static function destroy(int $id): void
    {
        $user = require_role(['admin', 'organiser']);
        $event = self::findOr404($id);
        self::assertCanManage($user, $event);

        // Bookings are deleted by the database cascade
        getDB()->prepare('DELETE FROM events WHERE id = ?')->execute([$id]);
        json_success(null, 'Event deleted');
    }


    private static function findOr404(int $id): array
    {
        $stmt = getDB()->prepare(self::SELECT . ' WHERE e.id = ?');
        $stmt->execute([$id]);
        $event = $stmt->fetch();
        if (!$event) {
            json_error(404, 'Event not found');
        }
        return $event;
    }

    private static function countTicketTypes(int $eventId): int
    {
        $stmt = getDB()->prepare('SELECT COUNT(*) FROM ticket_types WHERE event_id = ?');
        $stmt->execute([$eventId]);
        return (int) $stmt->fetchColumn();
    }

    // Organisers can only manage their own events
    private static function assertCanManage(array $user, array $event): void
    {
        if ($user['role'] === 'organiser' && (int) $event['organiser_id'] !== (int) $user['id']) {
            json_error(403, 'Forbidden: you can only manage your own events');
        }
    }

    // Check the sent fields
    private static function checkFields(array $data): array
    {
        $errors = [];
        if (isset($data['title']) && (!is_string($data['title']) || trim($data['title']) === '' || strlen($data['title']) > 200)) {
            $errors['title'] = 'title must be text of 1 to 200 characters';
        }
        if (isset($data['description']) && !is_string($data['description'])) {
            $errors['description'] = 'description must be text';
        }
        if (isset($data['event_date']) && !is_valid_date($data['event_date'])) {
            $errors['event_date'] = 'event_date must be a real date in YYYY-MM-DD format';
        }
        foreach (['start_time', 'end_time'] as $field) {
            if (isset($data[$field]) && !is_valid_time($data[$field])) {
                $errors[$field] = "$field must be a time like 19:30 or 19:30:00";
            }
        }
        if (isset($data['ticket_price']) && !is_non_negative_number($data['ticket_price'])) {
            $errors['ticket_price'] = 'ticket_price must be a number, 0 or more';
        }
        foreach (['total_tickets', 'venue_id', 'organiser_id'] as $field) {
            if (isset($data[$field]) && !is_positive_int($data[$field])) {
                $errors[$field] = "$field must be a whole number greater than 0";
            }
        }
        if (isset($data['status']) && !in_array($data['status'], self::STATUSES, true)) {
            $errors['status'] = 'status must be upcoming, cancelled or completed';
        }
        return $errors;
    }

    // Check the venue exists and is big enough
    private static function checkVenue(int $venueId, int $tickets): array
    {
        $venue = find_by_id('venues', $venueId);
        if (!$venue) {
            fail_validation(['venue_id' => 'venue does not exist']);
        }
        if ($tickets > (int) $venue['capacity']) {
            fail_validation(['total_tickets' => 'total tickets (' . $tickets . ') is more than the venue capacity (' . $venue['capacity'] . ')']);
        }
        return $venue;
    }

    // Check the organiser id
    private static function checkOrganiser(int $userId): int
    {
        $u = find_by_id('users', $userId);
        if (!$u || !in_array($u['role'], ['organiser', 'admin'], true)) {
            fail_validation(['organiser_id' => 'organiser_id must be the id of an organiser or admin user']);
        }
        return $userId;
    }

    // Return 409 when the time slot is taken
    private static function assertVenueFree(int $venueId, string $date, string $start, string $end, int $exceptEventId): void
    {
        $stmt = getDB()->prepare("SELECT title FROM events
                                  WHERE venue_id = ? AND event_date = ? AND status <> 'cancelled' AND id <> ?
                                    AND start_time < ? AND end_time > ?");
        $stmt->execute([$venueId, $date, $exceptEventId, $end, $start]);
        if ($row = $stmt->fetch()) {
            if (getDB()->inTransaction()) {
                getDB()->rollBack();
            }
            json_error(409, 'Venue is already booked at that time by: ' . $row['title']);
        }
    }

    // Cast numbers for the JSON
    private static function format(array $e): array
    {
        foreach (['id', 'organiser_id', 'venue_id', 'total_tickets', 'tickets_available'] as $col) {
            $e[$col] = (int) $e[$col];
        }
        $e['ticket_price'] = (float) $e['ticket_price'];
        return $e;
    }
}
