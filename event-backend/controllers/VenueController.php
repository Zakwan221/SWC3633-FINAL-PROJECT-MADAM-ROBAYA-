<?php
// Venues (read is public, write is admin only)

class VenueController
{
    public static function index(): void
    {
        [$page, $limit, $offset] = get_pagination();

        $where = [];
        $params = [];
        if (!empty($_GET['search'])) {
            $where[] = '(name LIKE ? OR address LIKE ?)';
            $params[] = '%' . $_GET['search'] . '%';
            $params[] = '%' . $_GET['search'] . '%';
        }
        if (!empty($_GET['city'])) {
            $where[] = 'city = ?';
            $params[] = $_GET['city'];
        }
        $whereSql = $where ? 'WHERE ' . implode(' AND ', $where) : '';

        $db = getDB();
        $count = $db->prepare("SELECT COUNT(*) FROM venues $whereSql");
        $count->execute($params);
        $total = (int) $count->fetchColumn();

        $stmt = $db->prepare("SELECT * FROM venues $whereSql ORDER BY name LIMIT $limit OFFSET $offset");
        $stmt->execute($params);

        json_success(array_map([self::class, 'format'], $stmt->fetchAll()), 'Venues retrieved', 200, pagination_meta($page, $limit, $total));
    }

    public static function show(int $id): void
    {
        $venue = find_by_id('venues', $id);
        if (!$venue) {
            json_error(404, 'Venue not found');
        }
        json_success(self::format($venue), 'Venue retrieved');
    }

    public static function store(): void
    {
        require_role(['admin']);
        $data = get_json_body();

        $errors = validate_required($data, ['name', 'address', 'city', 'capacity']);
        $errors += self::checkFields($data);
        if ($errors) {
            fail_validation($errors);
        }

        $db = getDB();
        $db->prepare('INSERT INTO venues (name, address, city, capacity) VALUES (?, ?, ?, ?)')->execute([
            trim($data['name']), trim($data['address']), trim($data['city']), (int) $data['capacity'],
        ]);

        json_success(self::format(find_by_id('venues', (int) $db->lastInsertId())), 'Venue created', 201);
    }

    public static function update(int $id): void
    {
        require_role(['admin']);
        $venue = find_by_id('venues', $id);
        if (!$venue) {
            json_error(404, 'Venue not found');
        }

        $data = get_json_body();
        $errors = self::checkFields($data);
        $allowed = array_intersect_key($data, array_flip(['name', 'address', 'city', 'capacity']));
        if (!$allowed) {
            $errors['body'] = 'send at least one of: name, address, city, capacity';
        }
        if ($errors) {
            fail_validation($errors);
        }

        // Keep the capacity above the biggest upcoming event
        if (isset($data['capacity'])) {
            $stmt = getDB()->prepare("SELECT MAX(total_tickets) FROM events WHERE venue_id = ? AND status = 'upcoming'");
            $stmt->execute([$id]);
            $biggest = (int) $stmt->fetchColumn();
            if ((int) $data['capacity'] < $biggest) {
                json_error(409, "An upcoming event at this venue has $biggest tickets, capacity cannot be lower");
            }
        }

        $sets = [];
        $params = [];
        foreach ($allowed as $field => $value) {
            $sets[] = "$field = ?";
            $params[] = ($field === 'capacity') ? (int) $value : trim($value);
        }
        $params[] = $id;
        getDB()->prepare('UPDATE venues SET ' . implode(', ', $sets) . ' WHERE id = ?')->execute($params);

        json_success(self::format(find_by_id('venues', $id)), 'Venue updated');
    }

    public static function destroy(int $id): void
    {
        require_role(['admin']);
        if (!find_by_id('venues', $id)) {
            json_error(404, 'Venue not found');
        }

        try {
            getDB()->prepare('DELETE FROM venues WHERE id = ?')->execute([$id]);
        } catch (PDOException $e) {
            if ($e->getCode() === '23000') {   // Venue is still in use
                json_error(409, 'Venue is used by events and cannot be deleted');
            }
            throw $e;
        }
        json_success(null, 'Venue deleted');
    }

    private static function checkFields(array $data): array
    {
        $errors = [];
        foreach (['name' => 150, 'address' => 255, 'city' => 100] as $field => $max) {
            if (isset($data[$field]) && (!is_string($data[$field]) || trim($data[$field]) === '' || strlen($data[$field]) > $max)) {
                $errors[$field] = "$field must be text of 1 to $max characters";
            }
        }
        if (isset($data['capacity']) && !is_positive_int($data['capacity'])) {
            $errors['capacity'] = 'capacity must be a whole number greater than 0';
        }
        return $errors;
    }

    // Cast numbers for the JSON
    private static function format(array $venue): array
    {
        $venue['id'] = (int) $venue['id'];
        $venue['capacity'] = (int) $venue['capacity'];
        return $venue;
    }
}
