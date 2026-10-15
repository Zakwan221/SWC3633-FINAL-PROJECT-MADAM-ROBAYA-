<?php
// Register, login, logout and current user

class AuthController
{
    // POST /auth/register
    public static function register(): void
    {
        $data = get_json_body();
        $errors = validate_required($data, ['name', 'email', 'password']);

        if (!isset($errors['name']) && (!is_string($data['name']) || strlen(trim($data['name'])) > 100)) {
            $errors['name'] = 'name must be text of at most 100 characters';
        }
        if (!isset($errors['email']) && !is_valid_email($data['email'])) {
            $errors['email'] = 'email format is not valid';
        }
        if (!isset($errors['password']) && (!is_string($data['password']) || strlen($data['password']) < 8 || strlen($data['password']) > 72)) {
            $errors['password'] = 'password must be 8 to 72 characters';
        }
        if ($errors) {
            fail_validation($errors);
        }

        // Only customers can register
        if (isset($data['role']) && $data['role'] !== 'customer') {
            json_error(403, 'Only customer accounts can be registered here. Ask an admin for other roles');
        }

        $db = getDB();
        $check = $db->prepare('SELECT id FROM users WHERE email = ?');
        $check->execute([strtolower(trim($data['email']))]);
        if ($check->fetch()) {
            json_error(409, 'This email is already registered');
        }

        $stmt = $db->prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)');
        $stmt->execute([
            trim($data['name']),
            strtolower(trim($data['email'])),
            password_hash($data['password'], PASSWORD_DEFAULT),
            'customer',
        ]);

        $user = $db->prepare('SELECT id, name, email, role, created_at FROM users WHERE id = ?');
        $user->execute([$db->lastInsertId()]);
        json_success($user->fetch(), 'Account created. You can now log in', 201);
    }

    // POST /auth/login
    public static function login(): void
    {
        $data = get_json_body();
        $errors = validate_required($data, ['email', 'password']);
        if (!isset($errors['email']) && !is_valid_email($data['email'])) {
            $errors['email'] = 'email format is not valid';
        }
        if ($errors) {
            fail_validation($errors);
        }

        $db = getDB();
        $stmt = $db->prepare('SELECT * FROM users WHERE email = ?');
        $stmt->execute([strtolower(trim($data['email']))]);
        $user = $stmt->fetch();

        // Use the same error for both failures
        if (!$user || !is_string($data['password']) || !password_verify($data['password'], $user['password_hash'])) {
            json_error(401, 'Invalid email or password');
        }

        // Create a new token
        $token = bin2hex(random_bytes(32));
        $db->prepare('UPDATE users SET api_token = ? WHERE id = ?')->execute([$token, $user['id']]);

        $GLOBALS['log_user_id'] = $user['id'];
        json_success([
            'token'      => $token,
            'token_type' => 'Bearer',
            'user'       => [
                'id'    => (int) $user['id'],
                'name'  => $user['name'],
                'email' => $user['email'],
                'role'  => $user['role'],
            ],
        ], 'Login successful');
    }

    // POST /auth/logout
    public static function logout(): void
    {
        $user = require_auth();
        getDB()->prepare('UPDATE users SET api_token = NULL WHERE id = ?')->execute([$user['id']]);
        json_success(null, 'Logged out');
    }

    // GET /auth/me
    public static function me(): void
    {
        json_success(require_auth(), 'Current user');
    }
}
