<?php
// Writes one log line per request

require_once __DIR__ . '/../config/config.php';

// Write one log line when the request ends
function start_request_logging(): void
{
    register_shutdown_function(function () {
        if (!is_dir(LOG_DIR)) {
            @mkdir(LOG_DIR, 0777, true);
        }
        $line = sprintf(
            "%s | %s | %s | %s | user:%s | %d\n",
            date('Y-m-d H:i:s'),
            $_SERVER['REMOTE_ADDR'] ?? '-',
            $_SERVER['REQUEST_METHOD'] ?? '-',
            $_SERVER['REQUEST_URI'] ?? '-',
            $GLOBALS['log_user_id'] ?? '-',
            http_response_code() ?: 200
        );
        @file_put_contents(LOG_DIR . '/api.log', $line, FILE_APPEND | LOCK_EX);
    });
}
