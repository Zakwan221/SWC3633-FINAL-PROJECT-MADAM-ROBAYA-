<?php
// App settings: database, rate limit, logs and CORS

date_default_timezone_set('Asia/Kuala_Lumpur');

// Database settings
define('DB_HOST', '127.0.0.1');   // Faster than localhost on Windows
define('DB_PORT', 3306);
define('DB_NAME', 'event_api');
define('DB_USER', 'root');
define('DB_PASS', '');

// Rate limit per IP
define('RATE_LIMIT_MAX', 60);
define('RATE_LIMIT_WINDOW', 60);

// Log folder
define('LOG_DIR', __DIR__ . '/../logs');

// Allowed frontend origin
define('CORS_ALLOW_ORIGIN', '*');
