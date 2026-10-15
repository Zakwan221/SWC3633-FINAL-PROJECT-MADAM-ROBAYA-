<?php
// JSON response helpers

function json_response(array $payload, int $code): void
{
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
    exit;
}

// Send a success response
function json_success($data = null, string $message = 'OK', int $code = 200, array $extra = []): void
{
    $payload = ['success' => true, 'data' => $data, 'message' => $message];
    json_response($payload + $extra, $code);
}

// Send an error response
function json_error(int $code, string $message, $details = null): void
{
    $error = ['code' => $code, 'message' => $message];
    if ($details !== null) {
        $error['details'] = $details;
    }
    json_response(['success' => false, 'error' => $error], $code);
}
