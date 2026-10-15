<?php
// Token login and role checks

require_once __DIR__ . '/../config/database.php';

// Get the Bearer token from the header
function get_bearer_token(): ?string
{
    $header = $_SERVER['HTTP_AUTHORIZATION']
        ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION']
        ?? null;

    // Try the header functions too
    if ($header === null && function_exists('getallheaders')) {
        foreach (getallheaders() as $name => $value) {
            if (strtolower($name) === 'authorization') {
                $header = $value;
            }
        }
    }

    if ($header !== null && preg_match('/^Bearer\s+(\S+)$/i', trim($header), $m)) {
        return $m[1];
    }
    return null;
}

// Get the logged in user
function current_user(): ?array
{
    static $loaded = false;
    static $user = null;

    if (!$loaded) {
        $loaded = true;
        $token = get_bearer_token();
        if ($token !== null) {
            $stmt = getDB()->prepare('SELECT id, name, email, role, created_at FROM users WHERE api_token = ?');
            $stmt->execute([$token]);
            $user = $stmt->fetch() ?: null;
        }
        // Save the id for the log
        $GLOBALS['log_user_id'] = $user['id'] ?? null;
    }
    return $user;
}

// Require a login
function require_auth(): array
{
    $user = current_user();
    if ($user === null) {
        header('WWW-Authenticate: Bearer');
        json_error(401, 'Authentication required. Send header "Authorization: Bearer <token>"');
    }
    return $user;
}

// Require a login and a role
function require_role(array $roles): array
{
    $user = require_auth();
    if (!in_array($user['role'], $roles, true)) {
        json_error(403, 'Forbidden: your role (' . $user['role'] . ') is not allowed to do this');
    }
    return $user;
}
