<?php
// Users (admin only)

class UserController
{
    private const ROLES = ['admin', 'organiser', 'customer'];
    private const COLUMNS = 'id, name, email, role, created_at';

    public static function index(): void
    {
        require_role(['admin']);
        [$page, $limit, $offset] = get_pagination();

        // Build the filters
        $where = [];
        $params = [];
        if (!empty($_GET['search'])) {
            $where[] = '(name LIKE ? OR email LIKE ?)';
            $params[] = '%' . $_GET['search'] . '%';
            $params[] = '%' . $_GET['search'] . '%';
        }
        if (!empty($_GET['role'])) {
            if (!in_array($_GET['role'], self::ROLES, true)) {
                fail_validation(['role' => 'role must be admin, organiser or customer']);
            }
            $where[] = 'role = ?';
            $params[] = $_GET['role'];
        }
        $whereSql = $where ? 'WHERE ' . implode(' AND ', $where) : '';

        $db = getDB();
        $count = $db->prepare("SELECT COUNT(*) FROM users $whereSql");
        $count->execute($params);
        $total = (int) $count->fetchColumn();

        // Limit and offset are safe integers
        $stmt = $db->prepare('SELECT ' . self::COLUMNS . " FROM users $whereSql ORDER BY id LIMIT $limit OFFSET $offset");
        $stmt->execute($params);

        json_success($stmt->fetchAll(), 'Users retrieved', 200, pagination_meta($page, $limit, $total));
    }

    public static function show(int $id): void
    {
        require_role(['admin']);
        $stmt = getDB()->prepare('SELECT ' . self::COLUMNS . ' FROM users WHERE id = ?');
        $stmt->execute([$id]);
        $user = $stmt->fetch();
        if (!$user) {
            json_error(404, 'User not found');
        }
        json_success($user, 'User retrieved');
    }

    public static function store(): void
    {
        require_role(['admin']);
        $data = get_json_body();

        $errors = validate_required($data, ['name', 'email', 'password', 'role']);
        $errors += self::checkFields($data);
        if ($errors) {
            fail_validation($errors);
        }
        self::assertEmailFree($data['email'], 0);

        $db = getDB();
        $db->prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)')->execute([
            trim($data['name']),
            strtolower(trim($data['email'])),
            password_hash($data['password'], PASSWORD_DEFAULT),
            $data['role'],
        ]);

        $stmt = $db->prepare('SELECT ' . self::COLUMNS . ' FROM users WHERE id = ?');
        $stmt->execute([$db->lastInsertId()]);
        json_success($stmt->fetch(), 'User created', 201);
    }

    public static function update(int $id): void
    {
        $admin = require_role(['admin']);
        $existing = find_by_id('users', $id);
        if (!$existing) {
            json_error(404, 'User not found');
        }

        $data = get_json_body();
        $errors = self::checkFields($data);
        $allowed = array_intersect_key($data, array_flip(['name', 'email', 'password', 'role']));
        if (!$allowed) {
            $errors['body'] = 'send at least one of: name, email, password, role';
        }
        if ($errors) {
            fail_validation($errors);
        }

        // Admins cannot change their own role
        if (isset($data['role']) && $id === (int) $admin['id'] && $data['role'] !== 'admin') {
            json_error(409, 'You cannot change your own role');
        }
        if (isset($data['email'])) {
            self::assertEmailFree($data['email'], $id);
        }

        // Build the update from the sent fields
        $sets = [];
        $params = [];
        foreach ($allowed as $field => $value) {
            if ($field === 'password') {
                $sets[] = 'password_hash = ?';
                $params[] = password_hash($value, PASSWORD_DEFAULT);
            } else {
                $sets[] = "$field = ?";
                $params[] = ($field === 'email') ? strtolower(trim($value)) : (is_string($value) ? trim($value) : $value);
            }
        }
        $params[] = $id;
        getDB()->prepare('UPDATE users SET ' . implode(', ', $sets) . ' WHERE id = ?')->execute($params);

        $stmt = getDB()->prepare('SELECT ' . self::COLUMNS . ' FROM users WHERE id = ?');
        $stmt->execute([$id]);
        json_success($stmt->fetch(), 'User updated');
    }

    public static function destroy(int $id): void
    {
        $admin = require_role(['admin']);
        if (!find_by_id('users', $id)) {
            json_error(404, 'User not found');
        }
        if ($id === (int) $admin['id']) {
            json_error(409, 'You cannot delete your own account');
        }

        try {
            getDB()->prepare('DELETE FROM users WHERE id = ?')->execute([$id]);
        } catch (PDOException $e) {
            // Foreign key error: the user is still in use
            if ($e->getCode() === '23000') {
                json_error(409, 'User still has events or bookings and cannot be deleted');
            }
            throw $e;
        }
        json_success(null, 'User deleted');
    }

    // Check the sent fields
    private static function checkFields(array $data): array
    {
        $errors = [];
        if (isset($data['name']) && (!is_string($data['name']) || trim($data['name']) === '' || strlen($data['name']) > 100)) {
            $errors['name'] = 'name must be text of 1 to 100 characters';
        }
        if (isset($data['email']) && !is_valid_email($data['email'])) {
            $errors['email'] = 'email format is not valid';
        }
        if (isset($data['password']) && (!is_string($data['password']) || strlen($data['password']) < 8 || strlen($data['password']) > 72)) {
            $errors['password'] = 'password must be 8 to 72 characters';
        }
        if (isset($data['role']) && !in_array($data['role'], self::ROLES, true)) {
            $errors['role'] = 'role must be admin, organiser or customer';
        }
        return $errors;
    }

    // Return 409 when the email is taken
    private static function assertEmailFree(string $email, int $exceptId): void
    {
        $stmt = getDB()->prepare('SELECT id FROM users WHERE email = ? AND id <> ?');
        $stmt->execute([strtolower(trim($email)), $exceptId]);
        if ($stmt->fetch()) {
            json_error(409, 'This email is already used by another user');
        }
    }
}
