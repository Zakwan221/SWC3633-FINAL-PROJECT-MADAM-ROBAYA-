<?php
// PDO database connection

require_once __DIR__ . '/config.php';

function getDB(): PDO
{
    static $pdo = null;

    if ($pdo === null) {
        $dsn = 'mysql:host=' . DB_HOST . ';port=' . DB_PORT . ';dbname=' . DB_NAME . ';charset=utf8mb4';
        $pdo = new PDO($dsn, DB_USER, DB_PASS, [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,   // Throw errors as exceptions
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,         // Return rows as arrays
            PDO::ATTR_EMULATE_PREPARES   => false,                    // Use real prepared statements
        ]);
    }

    return $pdo;
}

// Get one row by id
function find_by_id(string $table, int $id): ?array
{
    $stmt = getDB()->prepare("SELECT * FROM `$table` WHERE id = ?");
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    return $row ?: null;
}
