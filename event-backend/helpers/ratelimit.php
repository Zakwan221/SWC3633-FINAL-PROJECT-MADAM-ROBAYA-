<?php
// Limits requests per IP

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/response.php';

function check_rate_limit(): void
{
    $dir = LOG_DIR . '/ratelimit';
    if (!is_dir($dir)) {
        @mkdir($dir, 0777, true);
    }

    $ip   = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    $file = $dir . '/' . md5($ip) . '.json';
    $now  = time();

    // Lock the file while counting
    $fp = fopen($file, 'c+');
    if ($fp === false) {
        return;   // Skip the limit if the file cannot be written
    }
    flock($fp, LOCK_EX);

    $state = json_decode((string) stream_get_contents($fp), true);
    if (!is_array($state) || $now - $state['start'] >= RATE_LIMIT_WINDOW) {
        $state = ['start' => $now, 'count' => 0];   // Start a new window
    }
    $state['count']++;

    ftruncate($fp, 0);
    rewind($fp);
    fwrite($fp, json_encode($state));
    flock($fp, LOCK_UN);
    fclose($fp);

    $remaining = max(0, RATE_LIMIT_MAX - $state['count']);
    header('X-RateLimit-Limit: ' . RATE_LIMIT_MAX);
    header('X-RateLimit-Remaining: ' . $remaining);

    if ($state['count'] > RATE_LIMIT_MAX) {
        $retry = RATE_LIMIT_WINDOW - ($now - $state['start']);
        header('Retry-After: ' . $retry);
        json_error(429, "Too many requests. Try again in $retry seconds");
    }
}
