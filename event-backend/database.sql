-- Event Ticketing database (WARNING: drops and recreates event_api)

DROP DATABASE IF EXISTS event_api;
CREATE DATABASE event_api CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE event_api;

-- users: admins, organisers and customers
CREATE TABLE users (
    id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
    name          VARCHAR(100) NOT NULL,
    email         VARCHAR(150) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role          ENUM('admin','organiser','customer') NOT NULL DEFAULT 'customer',
    api_token     VARCHAR(64) NULL,
    created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_users_email (email),
    KEY idx_users_token (api_token)
) ENGINE=InnoDB;

-- venues: places where events are held
CREATE TABLE venues (
    id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
    name       VARCHAR(150) NOT NULL,
    address    VARCHAR(255) NOT NULL,
    city       VARCHAR(100) NOT NULL,
    capacity   INT UNSIGNED NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
) ENGINE=InnoDB;

-- events: created by an organiser, held at a venue
CREATE TABLE events (
    id                INT UNSIGNED NOT NULL AUTO_INCREMENT,
    organiser_id      INT UNSIGNED NOT NULL,
    venue_id          INT UNSIGNED NOT NULL,
    title             VARCHAR(200) NOT NULL,
    description       TEXT NULL,
    event_date        DATE NOT NULL,
    start_time        TIME NOT NULL,
    end_time          TIME NOT NULL,
    ticket_price      DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    total_tickets     INT UNSIGNED NOT NULL,
    tickets_available INT UNSIGNED NOT NULL,
    status            ENUM('upcoming','cancelled','completed') NOT NULL DEFAULT 'upcoming',
    created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_events_date (event_date),
    CONSTRAINT fk_events_organiser FOREIGN KEY (organiser_id) REFERENCES users(id)  ON DELETE RESTRICT,
    CONSTRAINT fk_events_venue     FOREIGN KEY (venue_id)     REFERENCES venues(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- ticket_types: ticket kinds of an event (Standard, VIP)
CREATE TABLE ticket_types (
    id                 INT UNSIGNED NOT NULL AUTO_INCREMENT,
    event_id           INT UNSIGNED NOT NULL,
    name               VARCHAR(100) NOT NULL,
    price              DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    quantity           INT UNSIGNED NOT NULL,
    quantity_available INT UNSIGNED NOT NULL,
    created_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_ticket_event_name (event_id, name),
    CONSTRAINT chk_ticket_qty CHECK (quantity > 0 AND quantity_available <= quantity),
    CONSTRAINT fk_ticket_types_event FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- bookings: tickets a customer bought
CREATE TABLE bookings (
    id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
    customer_id    INT UNSIGNED NOT NULL,
    event_id       INT UNSIGNED NOT NULL,
    ticket_type_id INT UNSIGNED NULL,
    quantity       INT UNSIGNED NOT NULL,
    total_price    DECIMAL(10,2) NOT NULL,
    status         ENUM('confirmed','cancelled') NOT NULL DEFAULT 'confirmed',
    booked_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT fk_bookings_customer    FOREIGN KEY (customer_id)    REFERENCES users(id)        ON DELETE RESTRICT,
    CONSTRAINT fk_bookings_event       FOREIGN KEY (event_id)       REFERENCES events(id)       ON DELETE CASCADE,
    CONSTRAINT fk_bookings_ticket_type FOREIGN KEY (ticket_type_id) REFERENCES ticket_types(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- Sample data. Passwords: admin Admin@123, organiser Organiser@123, customer Customer@123

INSERT INTO users (id, name, email, password_hash, role) VALUES
(1, 'Aisyah binti Rahman',          'admin@eventapi.my',       '$2y$10$3O0.XNsUfI8HAJB2EoFhQO1kKkGSMYMQ4MW3Ys.YvZMK4fXm4vFjS', 'admin'),
(2, 'Tan Wei Ming',                 'weiming@eventapi.my',     '$2y$10$atfLhTwX/3R9j7BWP9AY0O//GH2dhL/dUAz/iiVhBXOtF.JR4TyD2', 'organiser'),
(3, 'Lakshmi a/p Subramaniam',      'lakshmi@eventapi.my',     '$2y$10$atfLhTwX/3R9j7BWP9AY0O//GH2dhL/dUAz/iiVhBXOtF.JR4TyD2', 'organiser'),
(4, 'Muhammad Haziq bin Abdullah',  'haziq@eventapi.my',       '$2y$10$YY9K14smq5DjMSwSxa3vD.HetqUQaCmKyrYUsiVSH3R7UlTVC4s5.', 'customer'),
(5, 'Nurul Izzati binti Hassan',    'izzati@eventapi.my',      '$2y$10$YY9K14smq5DjMSwSxa3vD.HetqUQaCmKyrYUsiVSH3R7UlTVC4s5.', 'customer'),
(6, 'Chong Mei Ling',               'meiling@eventapi.my',     '$2y$10$YY9K14smq5DjMSwSxa3vD.HetqUQaCmKyrYUsiVSH3R7UlTVC4s5.', 'customer'),
(7, 'Rajesh Kumar a/l Nair',        'rajesh@eventapi.my',      '$2y$10$YY9K14smq5DjMSwSxa3vD.HetqUQaCmKyrYUsiVSH3R7UlTVC4s5.', 'customer');

INSERT INTO venues (id, name, address, city, capacity) VALUES
(1, 'Axiata Arena',                              'Bukit Jalil Sports City, Jalan Barat, Bukit Jalil',      'Kuala Lumpur',  16000),
(2, 'Dewan Filharmonik Petronas',                'Level 2, Petronas Twin Towers, Jalan Ampang',            'Kuala Lumpur',  860),
(3, 'Setia SPICE Arena',                         'Jalan Tun Dr Awang, Bayan Lepas',                        'George Town',   10000),
(4, 'Persada Johor International Convention Centre', 'Jalan Abdullah Ibrahim, Bandar Johor Bahru',         'Johor Bahru',   3000),
(5, 'Borneo Convention Centre Kuching',          'Jalan Tun Abdul Rahman Yaakub, Isthmus',                 'Kuching',       5000),
(6, 'Dewan Jubli Perak Sultan Haji Ahmad Shah',  'Jalan Gambut, Bandar Kuantan',                           'Kuantan',       1500);

-- Event totals match the ticket types below
INSERT INTO events (id, organiser_id, venue_id, title, description, event_date, start_time, end_time, ticket_price, total_tickets, tickets_available, status) VALUES
(1, 2, 1, 'Konsert Raya Fest 2026',           'Malam konsert Hari Raya dengan artis popular tanah air.',                   '2026-12-20', '20:00:00', '23:30:00', 150.00, 500,  494, 'upcoming'),
(2, 2, 2, 'Malaysian Symphony Gala Night',    'An evening of classical and local orchestral favourites.',                  '2026-11-15', '19:30:00', '22:00:00', 120.00, 300,  297, 'upcoming'),
(3, 3, 3, 'Penang Food & Music Festival',     'Street food from across Penang with live bands all night.',                 '2026-12-05', '16:00:00', '23:00:00',  45.00, 1000, 995, 'upcoming'),
(4, 3, 4, 'Johor Tech Summit 2027',           'Two-day conference on AI, cloud and startups in southern Malaysia.',        '2027-01-18', '09:00:00', '17:00:00', 200.00, 200,  198, 'upcoming'),
(5, 2, 5, 'Borneo Cultural Night',            'Traditional Sarawak dance and music showcase.',                             '2026-08-22', '19:00:00', '22:00:00',  80.00, 400,  396, 'completed'),
(6, 3, 6, 'Kuantan Stand-up Comedy Night',    'Top Malaysian comedians live in Kuantan. (Cancelled due to venue issues.)', '2026-11-30', '20:00:00', '22:30:00',  60.00, 300,  300, 'cancelled'),
(7, 2, 2, 'Midnight Jazz Session (SOLD OUT)', 'Intimate jazz night. All tickets are sold - handy for testing sold-out errors.', '2026-11-28', '21:00:00', '23:30:00', 90.00, 20, 0, 'upcoming');

INSERT INTO ticket_types (id, event_id, name, price, quantity, quantity_available) VALUES
(1,  1, 'Standard',          150.00, 400, 394),
(2,  1, 'VIP',               300.00, 100, 100),
(3,  2, 'Standard',          120.00, 250, 247),
(4,  2, 'Premium',           200.00,  50,  50),
(5,  3, 'General Admission',  45.00, 900, 895),
(6,  3, 'VIP Table',         120.00, 100, 100),
(7,  4, 'Early Bird',        200.00,  50,  50),
(8,  4, 'Standard',          250.00, 150, 148),
(9,  5, 'Standard',           80.00, 400, 396),
(10, 6, 'Standard',           60.00, 300, 300),
(11, 7, 'Standard',           90.00,  20,   0);

INSERT INTO bookings (id, customer_id, event_id, ticket_type_id, quantity, total_price, status, booked_at) VALUES
(1, 4, 1, 1,  2,  300.00, 'confirmed', '2026-09-20 10:15:00'),
(2, 5, 1, 1,  4,  600.00, 'confirmed', '2026-09-21 14:30:00'),
(3, 4, 2, 3,  3,  360.00, 'confirmed', '2026-09-25 09:00:00'),
(4, 5, 2, 3,  1,  120.00, 'cancelled', '2026-09-26 11:45:00'),
(5, 6, 3, 5,  5,  225.00, 'confirmed', '2026-09-28 16:20:00'),
(6, 7, 4, 8,  2,  500.00, 'confirmed', '2026-10-01 08:10:00'),
(7, 4, 5, 9,  4,  320.00, 'confirmed', '2026-07-30 13:00:00'),
(8, 6, 6, 10, 2,  120.00, 'cancelled', '2026-09-30 19:05:00'),
(9, 6, 7, 11, 20, 1800.00,'confirmed', '2026-10-02 12:00:00');
