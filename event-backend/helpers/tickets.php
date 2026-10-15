<?php
// Keeps event totals in step with ticket types

function sync_event_totals(PDO $db, int $eventId): void
{
    $db->prepare(
        'UPDATE events SET
            total_tickets     = (SELECT COALESCE(SUM(quantity), 0)           FROM ticket_types WHERE event_id = ?),
            tickets_available = (SELECT COALESCE(SUM(quantity_available), 0) FROM ticket_types WHERE event_id = ?),
            ticket_price      = COALESCE((SELECT MIN(price) FROM ticket_types WHERE event_id = ?), ticket_price)
         WHERE id = ?'
    )->execute([$eventId, $eventId, $eventId, $eventId]);
}

// Lock an event row
function lock_event(PDO $db, int $eventId): ?array
{
    $stmt = $db->prepare('SELECT * FROM events WHERE id = ? FOR UPDATE');
    $stmt->execute([$eventId]);
    return $stmt->fetch() ?: null;
}

// Lock a ticket type row
function lock_ticket_type(PDO $db, int $ticketTypeId): ?array
{
    $stmt = $db->prepare('SELECT * FROM ticket_types WHERE id = ? FOR UPDATE');
    $stmt->execute([$ticketTypeId]);
    return $stmt->fetch() ?: null;
}

// Give tickets back to a ticket type
function release_tickets(PDO $db, int $ticketTypeId, int $count): void
{
    $db->prepare('UPDATE ticket_types SET quantity_available = LEAST(quantity, quantity_available + ?) WHERE id = ?')
       ->execute([$count, $ticketTypeId]);
}
