<?php
// Ticket types of an event

class TicketTypeController
{

    // GET /events/{id}/ticket-types
    public static function forEvent(int $eventId): void
    {
        if (!find_by_id('events', $eventId)) {
            json_error(404, 'Event not found');
        }
        [$page, $limit, $offset] = get_pagination();

        $db = getDB();
        $count = $db->prepare('SELECT COUNT(*) FROM ticket_types WHERE event_id = ?');
        $count->execute([$eventId]);
        $total = (int) $count->fetchColumn();

        $stmt = $db->prepare("SELECT * FROM ticket_types WHERE event_id = ? ORDER BY price, id LIMIT $limit OFFSET $offset");
        $stmt->execute([$eventId]);

        json_success(array_map([self::class, 'format'], $stmt->fetchAll()), 'Ticket types retrieved', 200, pagination_meta($page, $limit, $total));
    }

    // GET /ticket-types/{id}
    public static function show(int $id): void
    {
        json_success(self::format(self::findOr404($id)), 'Ticket type retrieved');
    }


    // POST /events/{id}/ticket-types
    public static function store(int $eventId): void
    {
        $user = require_role(['admin', 'organiser']);
        $event = find_by_id('events', $eventId);
        if (!$event) {
            json_error(404, 'Event not found');
        }
        self::assertCanManage($user, $event);

        $data = get_json_body();
        $errors = validate_required($data, ['name', 'price', 'quantity']) + self::checkFields($data);
        if ($errors) {
            fail_validation($errors);
        }

        $db = getDB();
        $db->beginTransaction();
        $event = lock_event($db, $eventId);   // Lock the event
        self::assertEventOpen($db, $event);
        self::assertCapacity($db, $event, (int) $data['quantity'], 0);
        self::assertNameFree($db, $eventId, trim($data['name']), 0);

        $db->prepare('INSERT INTO ticket_types (event_id, name, price, quantity, quantity_available) VALUES (?, ?, ?, ?, ?)')->execute([
            $eventId, trim($data['name']), $data['price'], (int) $data['quantity'], (int) $data['quantity'],
        ]);
        $newId = (int) $db->lastInsertId();
        sync_event_totals($db, $eventId);
        $db->commit();

        json_success(self::format(self::findOr404($newId)), 'Ticket type created', 201);
    }


    // PUT /ticket-types/{id}
    public static function update(int $id): void
    {
        $user = require_role(['admin', 'organiser']);
        $type = self::findOr404($id);
        $event = find_by_id('events', (int) $type['event_id']);
        self::assertCanManage($user, $event);

        $data = get_json_body();
        $errors = self::checkFields($data);
        $changes = array_intersect_key($data, array_flip(['name', 'price', 'quantity']));
        if (!$changes) {
            $errors['body'] = 'send at least one of: name, price, quantity';
        }
        if ($errors) {
            fail_validation($errors);
        }

        $db = getDB();
        $db->beginTransaction();
        $event = lock_event($db, (int) $type['event_id']);
        $type = lock_ticket_type($db, $id);
        if (!$type) {   // Already deleted
            $db->rollBack();
            json_error(404, 'Ticket type not found');
        }
        self::assertEventOpen($db, $event);

        $name  = isset($changes['name'])  ? trim($changes['name']) : $type['name'];
        $price = $changes['price'] ?? $type['price'];
        $qty   = isset($changes['quantity']) ? (int) $changes['quantity'] : (int) $type['quantity'];

        // Quantity cannot go below the sold tickets
        $sold = (int) $type['quantity'] - (int) $type['quantity_available'];
        if ($qty < $sold) {
            $db->rollBack();
            json_error(409, "$sold tickets of this type are already sold, quantity cannot be lower than that");
        }
        self::assertCapacity($db, $event, $qty, $id);
        self::assertNameFree($db, (int) $type['event_id'], $name, $id);

        $db->prepare('UPDATE ticket_types SET name = ?, price = ?, quantity = ?, quantity_available = ? WHERE id = ?')
           ->execute([$name, $price, $qty, $qty - $sold, $id]);
        sync_event_totals($db, (int) $type['event_id']);
        $db->commit();

        json_success(self::format(self::findOr404($id)), 'Ticket type updated');
    }


    // DELETE /ticket-types/{id}
    public static function destroy(int $id): void
    {
        $user = require_role(['admin', 'organiser']);
        $type = self::findOr404($id);
        $event = find_by_id('events', (int) $type['event_id']);
        self::assertCanManage($user, $event);

        $db = getDB();
        $db->beginTransaction();
        lock_event($db, (int) $type['event_id']);

        $stmt = $db->prepare("SELECT COUNT(*) FROM bookings WHERE ticket_type_id = ? AND status = 'confirmed'");
        $stmt->execute([$id]);
        $confirmed = (int) $stmt->fetchColumn();
        if ($confirmed > 0) {
            $db->rollBack();
            json_error(409, "This ticket type has $confirmed confirmed booking(s) and cannot be deleted. Cancel those bookings first");
        }

        // Cancelled bookings stay in the history
        $db->prepare('DELETE FROM ticket_types WHERE id = ?')->execute([$id]);
        sync_event_totals($db, (int) $type['event_id']);
        $db->commit();

        json_success(null, 'Ticket type deleted');
    }


    private static function findOr404(int $id): array
    {
        $type = find_by_id('ticket_types', $id);
        if (!$type) {
            json_error(404, 'Ticket type not found');
        }
        return $type;
    }

    // Organisers can only manage their own events
    private static function assertCanManage(array $user, array $event): void
    {
        if ($user['role'] === 'organiser' && (int) $event['organiser_id'] !== (int) $user['id']) {
            json_error(403, 'Forbidden: you can only manage ticket types of your own events');
        }
    }

    // Cancelled or finished events cannot change
    private static function assertEventOpen(PDO $db, array $event): void
    {
        if ($event['status'] !== 'upcoming') {
            $db->rollBack();
            json_error(409, 'This event is ' . $event['status'] . ', its ticket types cannot be changed');
        }
    }

    // Ticket types must fit in the venue
    private static function assertCapacity(PDO $db, array $event, int $newQty, int $exceptTypeId): void
    {
        $stmt = $db->prepare('SELECT COALESCE(SUM(quantity), 0) FROM ticket_types WHERE event_id = ? AND id <> ?');
        $stmt->execute([$event['id'], $exceptTypeId]);
        $others = (int) $stmt->fetchColumn();

        $venue = find_by_id('venues', (int) $event['venue_id']);
        if ($others + $newQty > (int) $venue['capacity']) {
            $db->rollBack();
            fail_validation(['quantity' => 'all ticket types together would be ' . ($others + $newQty)
                . ' tickets, more than the venue capacity (' . $venue['capacity'] . '). Other ticket types already use ' . $others]);
        }
    }

    // Return 409 when the name is taken
    private static function assertNameFree(PDO $db, int $eventId, string $name, int $exceptTypeId): void
    {
        $stmt = $db->prepare('SELECT id FROM ticket_types WHERE event_id = ? AND name = ? AND id <> ?');
        $stmt->execute([$eventId, $name, $exceptTypeId]);
        if ($stmt->fetch()) {
            $db->rollBack();
            json_error(409, "This event already has a ticket type called '$name'");
        }
    }

    // Check the sent fields
    private static function checkFields(array $data): array
    {
        $errors = [];
        if (isset($data['name']) && (!is_string($data['name']) || trim($data['name']) === '' || strlen(trim($data['name'])) > 100)) {
            $errors['name'] = 'name must be text of 1 to 100 characters (e.g. Standard, VIP)';
        }
        if (isset($data['price']) && !is_non_negative_number($data['price'])) {
            $errors['price'] = 'price must be a number, 0 or more';
        }
        if (isset($data['quantity']) && !is_positive_int($data['quantity'])) {
            $errors['quantity'] = 'quantity must be a whole number greater than 0';
        }
        return $errors;
    }

    // Cast numbers and add the sold fields
    private static function format(array $t): array
    {
        foreach (['id', 'event_id', 'quantity', 'quantity_available'] as $col) {
            $t[$col] = (int) $t[$col];
        }
        $t['price'] = (float) $t['price'];
        $t['sold'] = $t['quantity'] - $t['quantity_available'];
        $t['sold_out'] = $t['quantity_available'] === 0;
        return $t;
    }
}
