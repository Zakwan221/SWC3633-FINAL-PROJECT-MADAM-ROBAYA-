<?php
// Bookings and ticket availability

class BookingController
{
    // Booking with event, customer and ticket type
    private const SELECT = 'SELECT b.*, e.title AS event_title, e.event_date, e.start_time, e.status AS event_status,
                                   e.organiser_id, u.name AS customer_name, tt.name AS ticket_type_name
                            FROM bookings b
                            JOIN events e ON e.id = b.event_id
                            JOIN users  u ON u.id = b.customer_id
                            LEFT JOIN ticket_types tt ON tt.id = b.ticket_type_id';


    public static function index(): void
    {
        $user = require_role(['admin', 'organiser', 'customer']);
        [$page, $limit, $offset] = get_pagination();

        $where = [];
        $params = [];

        // Limit by role
        if ($user['role'] === 'customer') {
            $where[] = 'b.customer_id = ?';
            $params[] = $user['id'];
        } elseif ($user['role'] === 'organiser') {
            $where[] = 'e.organiser_id = ?';
            $params[] = $user['id'];
        }

        // Optional filters
        if (!empty($_GET['event_id'])) {
            $where[] = 'b.event_id = ?';
            $params[] = (int) $_GET['event_id'];
        }
        if (!empty($_GET['status'])) {
            if (!in_array($_GET['status'], ['confirmed', 'cancelled'], true)) {
                fail_validation(['status' => 'status must be confirmed or cancelled']);
            }
            $where[] = 'b.status = ?';
            $params[] = $_GET['status'];
        }
        if (!empty($_GET['customer_id']) && $user['role'] === 'admin') {
            $where[] = 'b.customer_id = ?';
            $params[] = (int) $_GET['customer_id'];
        }
        $whereSql = $where ? 'WHERE ' . implode(' AND ', $where) : '';

        $db = getDB();
        $count = $db->prepare("SELECT COUNT(*) FROM bookings b JOIN events e ON e.id = b.event_id $whereSql");
        $count->execute($params);
        $total = (int) $count->fetchColumn();

        $stmt = $db->prepare(self::SELECT . " $whereSql ORDER BY b.booked_at DESC, b.id DESC LIMIT $limit OFFSET $offset");
        $stmt->execute($params);

        json_success(array_map([self::class, 'format'], $stmt->fetchAll()), 'Bookings retrieved', 200, pagination_meta($page, $limit, $total));
    }

    public static function show(int $id): void
    {
        $user = require_role(['admin', 'organiser', 'customer']);
        $booking = self::findOr404($id);
        self::assertCanView($user, $booking);
        json_success(self::format($booking), 'Booking retrieved');
    }


    public static function store(): void
    {
        $user = require_role(['customer']);
        $data = get_json_body();

        $errors = validate_required($data, ['event_id', 'ticket_type_id', 'quantity']);
        foreach (['event_id', 'ticket_type_id', 'quantity'] as $field) {
            if (!isset($errors[$field]) && !is_positive_int($data[$field])) {
                $errors[$field] = "$field must be a whole number greater than 0";
            }
        }
        if ($errors) {
            fail_validation($errors);
        }
        $quantity = (int) $data['quantity'];

        $db = getDB();
        $db->beginTransaction();

        // Lock the event and check it is open
        $event = lock_event($db, (int) $data['event_id']);
        if (!$event) {
            $db->rollBack();
            json_error(404, 'Event not found');
        }
        if ($event['status'] === 'cancelled') {
            $db->rollBack();
            json_error(409, 'This event has been cancelled and cannot be booked');
        }
        if ($event['status'] === 'completed' || strtotime($event['event_date'] . ' ' . $event['start_time']) <= time()) {
            $db->rollBack();
            json_error(409, 'This event has already started or finished and cannot be booked');
        }

        // Lock the ticket type and check the stock
        $type = lock_ticket_type($db, (int) $data['ticket_type_id']);
        if (!$type) {
            $db->rollBack();
            json_error(404, 'Ticket type not found');
        }
        if ((int) $type['event_id'] !== (int) $event['id']) {
            $db->rollBack();
            fail_validation(['ticket_type_id' => 'this ticket type does not belong to event ' . $event['id']]);
        }
        if ((int) $type['quantity_available'] === 0) {
            $db->rollBack();
            json_error(409, "Sold out: no '" . $type['name'] . "' tickets left for this event");
        }
        if ($quantity > (int) $type['quantity_available']) {
            $db->rollBack();
            json_error(409, 'Not enough tickets: only ' . $type['quantity_available'] . " '" . $type['name'] . "' ticket(s) left");
        }

        // Take the tickets
        $take = $db->prepare('UPDATE ticket_types SET quantity_available = quantity_available - ? WHERE id = ? AND quantity_available >= ?');
        $take->execute([$quantity, $type['id'], $quantity]);
        if ($take->rowCount() !== 1) {
            $db->rollBack();
            json_error(409, 'Tickets just sold out, please try again');
        }
        sync_event_totals($db, (int) $event['id']);

        // Save the booking with the ticket type price
        $db->prepare("INSERT INTO bookings (customer_id, event_id, ticket_type_id, quantity, total_price, status) VALUES (?, ?, ?, ?, ?, 'confirmed')")
           ->execute([$user['id'], $event['id'], $type['id'], $quantity, round($quantity * (float) $type['price'], 2)]);
        $newId = (int) $db->lastInsertId();
        $db->commit();

        json_success(self::format(self::findOr404($newId)), 'Booking confirmed', 201);
    }


    public static function update(int $id): void
    {
        $user = require_role(['admin', 'customer']);
        $booking = self::findOr404($id);
        self::assertCanChange($user, $booking);

        $data = get_json_body();
        $errors = [];
        if (!isset($data['status']) && !isset($data['quantity'])) {
            $errors['body'] = 'send "status": "cancelled" and/or "quantity"';
        }
        if (isset($data['status']) && !in_array($data['status'], ['confirmed', 'cancelled'], true)) {
            $errors['status'] = 'status must be confirmed or cancelled';
        }
        if (isset($data['status']) && $data['status'] === 'confirmed' && !isset($errors['status']) && $booking['status'] === 'cancelled') {
            $errors['status'] = 'a cancelled booking cannot be re-confirmed, please make a new booking';
        }
        if (isset($data['quantity']) && !is_positive_int($data['quantity'])) {
            $errors['quantity'] = 'quantity must be a whole number greater than 0';
        }
        if ($errors) {
            fail_validation($errors);
        }
        if ($booking['status'] === 'cancelled') {
            json_error(409, 'This booking is already cancelled');
        }

        $db = getDB();
        $db->beginTransaction();
        $event = lock_event($db, (int) $booking['event_id']);

        // Cancel
        if (isset($data['status']) && $data['status'] === 'cancelled') {
            self::cancel($db, $booking, $event);
            $db->commit();
            json_success(self::format(self::findOr404($id)), 'Booking cancelled');
        }

        // Nothing to change
        if (!isset($data['quantity'])) {
            $db->rollBack();
            json_success(self::format($booking), 'Booking unchanged');
        }

        // Change quantity
        if ($booking['ticket_type_id'] === null) {
            $db->rollBack();
            json_error(409, 'The ticket type of this booking no longer exists, so the quantity cannot be changed');
        }
        $type = lock_ticket_type($db, (int) $booking['ticket_type_id']);
        $newQty = (int) $data['quantity'];
        $diff = $newQty - (int) $booking['quantity'];
        if ($event['status'] !== 'upcoming' || strtotime($event['event_date'] . ' ' . $event['start_time']) <= time()) {
            $db->rollBack();
            json_error(409, 'Quantity can only be changed before an upcoming event starts');
        }
        if ($diff > 0) {
            if ($diff > (int) $type['quantity_available']) {
                $db->rollBack();
                json_error(409, 'Not enough tickets: only ' . $type['quantity_available'] . " more '" . $type['name'] . "' ticket(s) can be added");
            }
            $take = $db->prepare('UPDATE ticket_types SET quantity_available = quantity_available - ? WHERE id = ? AND quantity_available >= ?');
            $take->execute([$diff, $type['id'], $diff]);
            if ($take->rowCount() !== 1) {
                $db->rollBack();
                json_error(409, 'Tickets just sold out, please try again');
            }
        } elseif ($diff < 0) {
            release_tickets($db, (int) $type['id'], -$diff);
        }
        sync_event_totals($db, (int) $event['id']);

        // Keep the unit price the customer paid
        $unitPrice = (float) $booking['total_price'] / (int) $booking['quantity'];
        $db->prepare('UPDATE bookings SET quantity = ?, total_price = ? WHERE id = ?')
           ->execute([$newQty, round($newQty * $unitPrice, 2), $id]);
        $db->commit();

        json_success(self::format(self::findOr404($id)), 'Booking updated');
    }


    public static function destroy(int $id): void
    {
        $user = require_role(['admin', 'customer']);
        $booking = self::findOr404($id);
        self::assertCanChange($user, $booking);

        $db = getDB();
        $db->beginTransaction();
        $event = lock_event($db, (int) $booking['event_id']);

        if ($user['role'] === 'customer') {
            // Customers cancel and the record stays
            if ($booking['status'] === 'cancelled') {
                $db->rollBack();
                json_error(409, 'This booking is already cancelled');
            }
            self::cancel($db, $booking, $event);
            $db->commit();
            json_success(self::format(self::findOr404($id)), 'Booking cancelled');
        }

        // Admins delete the record and return the tickets
        if ($booking['status'] === 'confirmed') {
            self::giveBack($db, $booking);
        }
        $db->prepare('DELETE FROM bookings WHERE id = ?')->execute([$id]);
        $db->commit();
        json_success(null, 'Booking deleted');
    }


    private static function findOr404(int $id): array
    {
        $stmt = getDB()->prepare(self::SELECT . ' WHERE b.id = ?');
        $stmt->execute([$id]);
        $booking = $stmt->fetch();
        if (!$booking) {
            json_error(404, 'Booking not found');
        }
        return $booking;
    }

    // Cancel the booking and return the tickets
    private static function cancel(PDO $db, array $booking, array $event): void
    {
        if ($event['status'] === 'completed') {
            $db->rollBack();
            json_error(409, 'Bookings for a completed event cannot be cancelled');
        }
        $db->prepare("UPDATE bookings SET status = 'cancelled' WHERE id = ?")->execute([$booking['id']]);
        self::giveBack($db, $booking);
    }

    // Return the tickets and update the event totals
    private static function giveBack(PDO $db, array $booking): void
    {
        if ($booking['ticket_type_id'] !== null) {
            lock_ticket_type($db, (int) $booking['ticket_type_id']);
            release_tickets($db, (int) $booking['ticket_type_id'], (int) $booking['quantity']);
            sync_event_totals($db, (int) $booking['event_id']);
        }
    }

    // Customer, event organiser or admin can view
    private static function assertCanView(array $user, array $booking): void
    {
        $ok = $user['role'] === 'admin'
            || ($user['role'] === 'customer'  && (int) $booking['customer_id']  === (int) $user['id'])
            || ($user['role'] === 'organiser' && (int) $booking['organiser_id'] === (int) $user['id']);
        if (!$ok) {
            json_error(403, 'Forbidden: this booking is not yours');
        }
    }

    // Customer or admin can change
    private static function assertCanChange(array $user, array $booking): void
    {
        if ($user['role'] === 'customer' && (int) $booking['customer_id'] !== (int) $user['id']) {
            json_error(403, 'Forbidden: you can only change your own bookings');
        }
    }

    private static function format(array $b): array
    {
        foreach (['id', 'customer_id', 'event_id', 'quantity', 'organiser_id'] as $col) {
            $b[$col] = (int) $b[$col];
        }
        $b['ticket_type_id'] = $b['ticket_type_id'] === null ? null : (int) $b['ticket_type_id'];
        $b['total_price'] = (float) $b['total_price'];
        unset($b['organiser_id']);   // Hide the internal field
        return $b;
    }
}
