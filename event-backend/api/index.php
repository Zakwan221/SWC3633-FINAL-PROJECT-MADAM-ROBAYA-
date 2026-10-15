<?php
// Router: sends every request to the right controller

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../helpers/response.php';
require_once __DIR__ . '/../helpers/validation.php';
require_once __DIR__ . '/../helpers/auth.php';
require_once __DIR__ . '/../helpers/logger.php';
require_once __DIR__ . '/../helpers/ratelimit.php';
require_once __DIR__ . '/../helpers/tickets.php';
require_once __DIR__ . '/../controllers/AuthController.php';
require_once __DIR__ . '/../controllers/UserController.php';
require_once __DIR__ . '/../controllers/VenueController.php';
require_once __DIR__ . '/../controllers/EventController.php';
require_once __DIR__ . '/../controllers/BookingController.php';
require_once __DIR__ . '/../controllers/TicketTypeController.php';

// Hide PHP errors from the output
ini_set('display_errors', '0');

// Return a JSON 500 for any uncaught error
set_exception_handler(function (Throwable $e) {
    error_log('[event-api] ' . $e->getMessage() . ' in ' . $e->getFile() . ':' . $e->getLine());
    json_error(500, 'Internal server error');
});

// Logging, CORS and rate limit

start_request_logging();

header('Access-Control-Allow-Origin: ' . CORS_ALLOW_ORIGIN);
header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Access-Control-Expose-Headers: X-RateLimit-Limit, X-RateLimit-Remaining, Retry-After');

$method = $_SERVER['REQUEST_METHOD'];

// Answer the browser preflight request
if ($method === 'OPTIONS') {
    http_response_code(204);
    exit;
}

check_rate_limit();

// Find the logged in user for the log
current_user();

// Read the path from the URL

// Remove the folder part of the path
$path = rawurldecode(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH));
$base = rtrim(dirname($_SERVER['SCRIPT_NAME']), '/\\');
if ($base !== '' && strpos($path, $base) === 0) {
    $path = substr($path, strlen($base));
}
$segments = array_values(array_filter(explode('/', trim($path, '/')), 'strlen'));

$resource = $segments[0] ?? '';
$second   = $segments[1] ?? null;   // Id or action
$third    = $segments[2] ?? null;   // Action

// Send a 405 with the allowed methods
function method_not_allowed(array $allowed): void
{
    header('Allow: ' . implode(', ', $allowed));
    json_error(405, 'Method not allowed. Allowed: ' . implode(', ', $allowed));
}

// Welcome message

if ($resource === '') {
    json_success([
        'name'      => 'Event Ticketing and Venue Booking API',
        'resources' => ['auth', 'users', 'venues', 'events', 'ticket-types', 'bookings'],
    ], 'API is running');
}

// Auth routes

if ($resource === 'auth') {
    $routes = [
        'register' => ['POST', 'register'],
        'login'    => ['POST', 'login'],
        'logout'   => ['POST', 'logout'],
        'me'       => ['GET',  'me'],
    ];
    if ($second === null || !isset($routes[$second]) || $third !== null) {
        json_error(404, 'Auth endpoint not found');
    }
    [$allowedMethod, $action] = $routes[$second];
    if ($method !== $allowedMethod) {
        method_not_allowed([$allowedMethod]);
    }
    AuthController::$action();
    exit;
}

// Resource routes

$controllers = [
    'users'    => 'UserController',
    'venues'   => 'VenueController',
    'events'   => 'EventController',
    'bookings' => 'BookingController',
    'ticket-types' => 'TicketTypeController',
];

if (!isset($controllers[$resource])) {
    json_error(404, "Resource '$resource' not found");
}
$controller = $controllers[$resource];

// Ticket types are listed and created under an event
if ($resource === 'ticket-types' && $second === null) {
    json_error(404, 'Use GET or POST /events/{id}/ticket-types to list or create ticket types');
}

// List or create
if ($second === null) {
    if ($method === 'GET')  { $controller::index(); }
    if ($method === 'POST') { $controller::store(); }
    method_not_allowed(['GET', 'POST']);
}

// Everything below needs an id
$id = parse_id($second);

// Event sub routes
if ($third !== null) {
    if ($resource === 'events' && count($segments) === 3) {
        if ($third === 'weather') {
            if ($method !== 'GET') {
                method_not_allowed(['GET']);
            }
            EventController::weather($id);
        }
        if ($third === 'ticket-types') {
            if ($method === 'GET')  { TicketTypeController::forEvent($id); }
            if ($method === 'POST') { TicketTypeController::store($id); }
            method_not_allowed(['GET', 'POST']);
        }
    }
    json_error(404, 'Endpoint not found');
}

// Show, update or delete
if (count($segments) > 2) {
    json_error(404, 'Endpoint not found');
}
if ($method === 'GET')                      { $controller::show($id); }
if ($method === 'PUT' || $method === 'PATCH') { $controller::update($id); }
if ($method === 'DELETE')                   { $controller::destroy($id); }
method_not_allowed(['GET', 'PUT', 'PATCH', 'DELETE']);
