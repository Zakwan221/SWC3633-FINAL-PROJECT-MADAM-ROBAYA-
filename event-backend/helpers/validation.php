<?php
// Input reading and validation helpers

// Read the JSON body
function get_json_body(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || trim($raw) === '') {
        return [];
    }
    $data = json_decode($raw, true);
    if (!is_array($data)) {
        json_error(400, 'Request body must be valid JSON object');
    }
    return $data;
}

// Check the route id
function parse_id($value): int
{
    if (!ctype_digit((string) $value) || (int) $value < 1) {
        json_error(400, 'ID must be a positive integer');
    }
    return (int) $value;
}

// List the missing required fields
function validate_required(array $data, array $fields): array
{
    $errors = [];
    foreach ($fields as $field) {
        if (!isset($data[$field]) || (is_string($data[$field]) && trim($data[$field]) === '')) {
            $errors[$field] = "$field is required";
        }
    }
    return $errors;
}

function is_valid_email($email): bool
{
    return is_string($email) && filter_var($email, FILTER_VALIDATE_EMAIL) !== false;
}

// Check a real date (YYYY-MM-DD)
function is_valid_date($date): bool
{
    if (!is_string($date) || !preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $date, $m)) {
        return false;
    }
    return checkdate((int) $m[2], (int) $m[3], (int) $m[1]);
}

// Check a time (HH:MM or HH:MM:SS)
function is_valid_time($time): bool
{
    return is_string($time) && preg_match('/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/', $time) === 1;
}

// Add seconds to a time
function normalise_time(string $time): string
{
    return strlen($time) === 5 ? $time . ':00' : $time;
}

// Check a whole number above 0
function is_positive_int($value): bool
{
    return (is_int($value) && $value > 0) || (is_string($value) && ctype_digit($value) && (int) $value > 0);
}

// Check a number of 0 or more
function is_non_negative_number($value): bool
{
    return (is_int($value) || is_float($value) || (is_string($value) && is_numeric($value))) && $value >= 0;
}

// Stop with a 422 error
function fail_validation(array $errors): void
{
    json_error(422, 'Validation failed', $errors);
}

// Read page and limit from the URL
function get_pagination(): array
{
    $page  = isset($_GET['page'])  && ctype_digit((string) $_GET['page'])  ? max(1, (int) $_GET['page'])  : 1;
    $limit = isset($_GET['limit']) && ctype_digit((string) $_GET['limit']) ? (int) $_GET['limit'] : 10;
    $limit = min(max($limit, 1), 100);   // Limit is 1 to 100
    return [$page, $limit, ($page - 1) * $limit];
}

// Build the pagination block
function pagination_meta(int $page, int $limit, int $total): array
{
    return [
        'pagination' => [
            'page'        => $page,
            'limit'       => $limit,
            'total'       => $total,
            'total_pages' => (int) ceil($total / $limit),
        ],
    ];
}
