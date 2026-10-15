const API = "/event-api/api";

const content = document.getElementById("content");
const navigation = document.getElementById("navigation");
const account = document.getElementById("account");
const message = document.getElementById("message");
const loading = document.getElementById("loading");

let token = sessionStorage.getItem("eventToken") || "";
let user = null;
let section = "events";
let busy = false;


// shared page 

function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, function (character) {
        const characters = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        };

        return characters[character];
    });
}

function money(value) {
    return "RM " + Number(value).toFixed(2);
}

function notify(text, isError = false) {
    message.textContent = text;
    message.className = isError ? "error" : "success";
    message.hidden = false;
}

function button(label, action, danger = false) {
    return `
        <button type="button"
            class="${danger ? "danger" : ""}"
            onclick="run(() => ${escapeHtml(action)})">
            ${escapeHtml(label)}
        </button>
    `;
}

function table(headings, rows) {
    if (rows.length === 0) {
        return '<p class="note">No records found.</p>';
    }

    return `
        <div class="table-container">
            <table>
                <thead>
                    <tr>
                        ${headings.map(function (heading) {
                            return `<th scope="col">${escapeHtml(heading)}</th>`;
                        }).join("")}
                    </tr>
                </thead>

                <tbody>
                    ${rows.map(function (cells) {
                        return `
                            <tr>
                                ${cells.map(function (cell) {
                                    return `<td>${cell}</td>`;
                                }).join("")}
                            </tr>
                        `;
                    }).join("")}
                </tbody>
            </table>
        </div>
    `;
}

async function run(action) {
    if (busy) {
        return;
    }

    busy = true;
    message.hidden = true;
    loading.hidden = false;
    content.setAttribute("aria-busy", "true");

    const enabledButtons = Array.from(
        document.querySelectorAll("button:not(:disabled)")
    );

    enabledButtons.forEach(function (item) {
        item.disabled = true;
    });

    try {
        await action();
    } catch (error) {
        notify(error.message, true);
    } finally {
        busy = false;
        loading.hidden = true;
        content.removeAttribute("aria-busy");

        enabledButtons.forEach(function (item) {
            if (item.isConnected) {
                item.disabled = false;
            }
        });
    }
}


// api connection

async function api(path, method = "GET", data = null) {
    const headers = {
        "Accept": "application/json"
    };

    if (token) {
        headers.Authorization = "Bearer " + token;
    }

    const options = {
        method: method,
        headers: headers
    };

    if (data !== null) {
        headers["Content-Type"] = "application/json";
        options.body = JSON.stringify(data);
    }

    let response;

    try {
        response = await fetch(API + path, options);
    } catch (error) {
        throw new Error(
            "Cannot reach the API. Check Apache and your connection. " +
            "If you were saving a record, check the records before submitting again."
        );
    }

    let result;

    try {
        result = await response.json();
    } catch (error) {
        throw new Error(
            "The API did not return JSON. Check the API URL and Apache error log."
        );
    }

    if (!response.ok || result.success !== true) {
        if (response.status === 401 && path !== "/auth/login") {
            clearLogin();
        }

        let text = result.error?.message || "The request failed.";

        if (result.error?.details) {
            text += "\n" + Object.values(result.error.details).join("\n");
        }

        throw new Error(response.status + ": " + text);
    }

    return result;
}

async function getAll(path) {
    let records = [];
    let page = 1;
    let totalPages = 1;

    do {
        const separator = path.includes("?") ? "&" : "?";
        const result = await api(
            path + separator + "page=" + page + "&limit=100"
        );

        records = records.concat(result.data);
        totalPages = result.pagination.total_pages;
        page++;
    } while (page <= totalPages);

    return records;
}

async function finish(result, nextSection = section) {
    content.innerHTML = `
        <p>The change was saved.</p>
        ${button("Reload records", `showList('${nextSection}')`)}
    `;

    try {
        await showList(nextSection);
        notify(result.message);
    } catch (error) {
        notify(
            result.message + "\nThe list could not refresh: " + error.message,
            true
        );
    }
}


// form helper

function field(label, name, type = "text", value = "", attributes = "") {
    return `
        <label>
            ${escapeHtml(label)}
            <input
                name="${name}"
                type="${type}"
                value="${escapeHtml(value)}"
                ${attributes}>
        </label>
    `;
}

function selectField(label, name, options, selected = "") {
    return `
        <label>
            ${escapeHtml(label)}
            <select name="${name}" required>
                <option value="">Select an option</option>

                ${options.map(function (option) {
                    const isSelected =
                        String(option[0]) === String(selected);

                    return `
                        <option
                            value="${escapeHtml(option[0])}"
                            ${isSelected ? "selected" : ""}>
                            ${escapeHtml(option[1])}
                        </option>
                    `;
                }).join("")}
            </select>
        </label>
    `;
}

function showForm(title, fields, onSave, back = "showList(section)") {
    content.innerHTML = `
        <h2>${escapeHtml(title)}</h2>

        <form id="recordForm">
            <div class="form-fields">
                ${fields}
            </div>

            <button type="submit">Save</button>
            ${back ? button("Back", back) : ""}
        </form>
    `;

    const form = document.getElementById("recordForm");

    form.onsubmit = function (event) {
        event.preventDefault();

        run(async function () {
            const data = Object.fromEntries(new FormData(form));

            for (const name in data) {
                if (name !== "password") {
                    data[name] = data[name].trim();
                }
            }

            for (const input of form.querySelectorAll("[required]")) {
                if (!String(data[input.name] ?? "").trim()) {
                    input.focus();
                    throw new Error("Please complete all required fields.");
                }
            }

            for (const input of form.querySelectorAll('input[type="number"]')) {
                if (data[input.name] !== "") {
                    data[input.name] = Number(data[input.name]);
                }
            }

            await onSave(data);
        });
    };

    return form;
}


// login and registration

function renderNavigation() {
    navigation.hidden = !user;

    if (!user) {
        navigation.innerHTML = "";
        account.textContent = "";
        return;
    }

    account.textContent = user.name + " (" + user.role + ")";

    let links = button("Events", "showList('events')");

    links += button(
        user.role === "customer" ? "My bookings" : "Bookings",
        "showList('bookings')"
    );

    if (user.role === "admin") {
        links += button("Venues", "showList('venues')");
        links += button("Users", "showList('users')");
    }

    links += button("Log out", "logout()");

    navigation.innerHTML = links;
}

function clearLogin() {
    token = "";
    user = null;

    sessionStorage.removeItem("eventToken");
    renderNavigation();
    showLogin();
}

function showLogin() {
    const form = showForm(
        "Log in",
        field("Email", "email", "email", "", "required autocomplete='username'") +
        field(
            "Password",
            "password",
            "password",
            "",
            "required autocomplete='current-password'"
        ),
        async function (data) {
            const result = await api("/auth/login", "POST", data);

            token = result.data.token;
            user = result.data.user;

            sessionStorage.setItem("eventToken", token);
            renderNavigation();

            await finish(result, "events");
        },
        null
    );

    form.querySelector('button[type="submit"]').textContent = "Log in";

    content.insertAdjacentHTML(
        "beforeend",
        `<p>New customer?</p>${button("Create an account", "showRegister()")}`
    );
}

function showRegister() {
    const form = showForm(
        "Create a customer account",
        field("Name", "name", "text", "", "required maxlength='100'") +
        field("Email", "email", "email", "", "required maxlength='150'") +
        field(
            "Password",
            "password",
            "password",
            "",
            "required minlength='8' maxlength='72' autocomplete='new-password'"
        ),
        async function (data) {
            const result = await api("/auth/register", "POST", data);

            showLogin();
            notify(result.message);
        },
        "showLogin()"
    );

    form.querySelector('button[type="submit"]').textContent = "Register";
}

async function logout() {
    const result = await api("/auth/logout", "POST");

    clearLogin();
    notify(result.message);
}


// Lists, searching and pagination

async function showList(kind, page = 1, search = "") {
    if (!user) {
        showLogin();
        return;
    }

    if (["users", "venues"].includes(kind) && user.role !== "admin") {
        throw new Error("Only administrators can open this management page.");
    }

    const parameters = new URLSearchParams({
        page: page,
        limit: 10
    });

    if (search && kind !== "bookings") {
        parameters.set("search", search);
    }

    if (kind === "events" && user.role === "organiser") {
        parameters.set("organiser_id", user.id);
    }

    const result = await api("/" + kind + "?" + parameters);
    section = kind;

    const titles = {
        events: user.role === "organiser" ? "My events" : "Events",
        bookings: user.role === "customer" ? "My bookings" : "Bookings",
        venues: "Venues",
        users: "Users"
    };

    let createButton = "";

    if (kind === "events" && user.role !== "customer") {
        createButton = button("Add event", "editEvent()");
    }

    if (kind === "venues") {
        createButton = button("Add venue", "editVenue()");
    }

    if (kind === "users") {
        createButton = button("Add user", "editUser()");
    }

    const searchForm = kind !== "bookings" ? `
        <form id="searchForm" class="search-form">
            <label>
                Search
                <input
                    id="searchInput"
                    name="search"
                    value="${escapeHtml(search)}"
                    placeholder="Enter a name or keyword">
            </label>

            <button type="submit">Search</button>
            ${button("Clear", `showList('${kind}')`)}
        </form>
    ` : "";

    const pagination = result.pagination;
    const totalPages = Math.max(1, pagination.total_pages);

    content.innerHTML = `
        <h2>${escapeHtml(titles[kind])}</h2>

        ${createButton}
        ${searchForm}
        ${renderRecords(kind, result.data)}

        <div class="pagination">
            <button type="button" id="previousPage"
                ${page <= 1 ? "disabled" : ""}>
                Previous
            </button>

            <span>
                Page ${page} of ${totalPages}
                · ${pagination.total} records
            </span>

            <button type="button" id="nextPage"
                ${page >= totalPages ? "disabled" : ""}>
                Next
            </button>
        </div>
    `;

    if (kind !== "bookings") {
        document.getElementById("searchForm").onsubmit = function (event) {
            event.preventDefault();

            const value = document.getElementById("searchInput").value.trim();

            run(() => showList(kind, 1, value));
        };
    }

    document.getElementById("previousPage").onclick = function () {
        run(() => showList(kind, page - 1, search));
    };

    document.getElementById("nextPage").onclick = function () {
        run(() => showList(kind, page + 1, search));
    };
}

function renderRecords(kind, records) {
    if (kind === "events") {
        return table(
            ["Event", "Venue", "Schedule", "Available", "Status", "Actions"],
            records.map(function (event) {
                const id = Number(event.id);

                let actions = button("View", `showEvent(${id})`);

                if (canManage(event)) {
                    actions += button("Edit", `editEvent(${id})`);
                    actions += button(
                        "Delete",
                        `removeRecord('events', ${id})`,
                        true
                    );
                }

                return [
                    escapeHtml(event.title),
                    escapeHtml(event.venue_name),
                    escapeHtml(event.event_date) + "<br>" +
                        escapeHtml(event.start_time.slice(0, 5)) + " – " +
                        escapeHtml(event.end_time.slice(0, 5)),
                    escapeHtml(event.tickets_available),
                    escapeHtml(event.status),
                    `<div class="actions">${actions}</div>`
                ];
            })
        );
    }

    if (kind === "venues") {
        return table(
            ["Name", "Address", "City", "Capacity", "Actions"],
            records.map(function (venue) {
                const id = Number(venue.id);

                return [
                    escapeHtml(venue.name),
                    escapeHtml(venue.address),
                    escapeHtml(venue.city),
                    escapeHtml(venue.capacity),
                    button("Edit", `editVenue(${id})`) +
                    button("Delete", `removeRecord('venues', ${id})`, true)
                ];
            })
        );
    }

    if (kind === "users") {
        return table(
            ["Name", "Email", "Role", "Actions"],
            records.map(function (record) {
                const id = Number(record.id);

                let actions = button("Edit", `editUser(${id})`);

                if (id !== Number(user.id)) {
                    actions += button(
                        "Delete",
                        `removeRecord('users', ${id})`,
                        true
                    );
                }

                return [
                    escapeHtml(record.name),
                    escapeHtml(record.email),
                    escapeHtml(record.role),
                    actions
                ];
            })
        );
    }

    return table(
        ["Booking", "Event", "Customer", "Tickets", "Total", "Status", "Actions"],
        records.map(function (booking) {
            const id = Number(booking.id);

            let actions = button("View", `showBooking(${id})`);

            if (user.role !== "organiser" && booking.status === "confirmed") {
                if (
                    booking.event_status === "upcoming" &&
                    eventStart(booking) > Date.now() &&
                    booking.ticket_type_id !== null
                ) {
                    actions += button("Edit quantity", `editBooking(${id})`);
                }

                if (booking.event_status !== "completed") {
                    actions += button("Cancel", `cancelBooking(${id})`, true);
                }
            }

            if (user.role === "admin") {
                actions += button(
                    "Delete record",
                    `removeRecord('bookings', ${id})`,
                    true
                );
            }

            return [
                "#" + id,
                escapeHtml(booking.event_title),
                escapeHtml(booking.customer_name),
                escapeHtml(booking.ticket_type_name || "Removed ticket type") +
                    "<br>Quantity: " + escapeHtml(booking.quantity),
                money(booking.total_price),
                escapeHtml(booking.status),
                `<div class="actions">${actions}</div>`
            ];
        })
    );
}


// event details

function eventStart(event) {
    return new Date(
        event.event_date + "T" + event.start_time + "+08:00"
    ).getTime();
}

function canManage(event) {
    return user && (
        user.role === "admin" ||
        (
            user.role === "organiser" &&
            Number(event.organiser_id) === Number(user.id)
        )
    );
}

function canBook(event) {
    return event.status === "upcoming" &&
        eventStart(event) > Date.now() &&
        Number(event.tickets_available) > 0;
}

async function showEvent(id) {
    const results = await Promise.all([
        api("/events/" + id),
        getAll("/events/" + id + "/ticket-types")
    ]);

    const event = results[0].data;
    const types = results[1];
    const manage = canManage(event);

    const rows = types.map(function (type) {
        let actions = "";

        if (manage) {
            if (event.status === "upcoming") {
                actions += button(
                    "Edit",
                    `editTicket(${id}, ${Number(type.id)})`
                );
            }

            actions += button(
                "Delete",
                `removeTicket(${id}, ${Number(type.id)})`,
                true
            );
        }

        return [
            escapeHtml(type.name),
            money(type.price),
            escapeHtml(type.quantity),
            escapeHtml(type.quantity_available),
            actions || "—"
        ];
    });

    let actions = button("Back to events", "showList('events')");

    if (manage) {
        actions += button("Edit event", `editEvent(${id})`);

        if (event.status === "upcoming") {
            actions += button("Add ticket type", `editTicket(${id})`);
        }
    }

    if (user.role === "customer" && canBook(event)) {
        actions += button("Book tickets", `bookEvent(${id})`);
    }

    content.innerHTML = `
        <h2>${escapeHtml(event.title)}</h2>

        <p class="description">${escapeHtml(event.description)}</p>

        <p>
            <strong>Venue:</strong>
            ${escapeHtml(event.venue_name)}<br>
            ${escapeHtml(event.venue_address)},
            ${escapeHtml(event.venue_city)}
        </p>

        <p>
            <strong>Organiser:</strong>
            ${escapeHtml(event.organiser_name)}
        </p>

        <p>
            <strong>Schedule:</strong>
            ${escapeHtml(event.event_date)},
            ${escapeHtml(event.start_time.slice(0, 5))} –
            ${escapeHtml(event.end_time.slice(0, 5))}
            (Malaysia time)
        </p>

        <p>
            <strong>Status:</strong> ${escapeHtml(event.status)}<br>
            <strong>Available tickets:</strong>
            ${escapeHtml(event.tickets_available)}
            of ${escapeHtml(event.total_tickets)}
        </p>

        <div class="toolbar">${actions}</div>

        ${!canBook(event) ? `
            <p class="note">
                Booking is unavailable because this event is sold out,
                cancelled, completed, or has already started.
            </p>
        ` : ""}

        <h3>Ticket types</h3>

        ${table(
            ["Type", "Price", "Total tickets", "Available", "Actions"],
            rows
        )}

        <h3>Venue weather</h3>

        ${button("Check weather", `showWeather(${id})`)}

        <div id="weather"></div>
    `;
}

async function showWeather(id) {
    const result = await api("/events/" + id + "/weather");
    const weather = result.data;

    document.getElementById("weather").innerHTML = `
        <p>${escapeHtml(result.message)}</p>

        <p>
            ${escapeHtml(weather.location.city)}
            · Source: ${escapeHtml(weather.source)}
        </p>

        ${weather.forecast.length ? table(
            ["Date", "Condition", "Minimum", "Maximum", "Rain chance"],
            weather.forecast.map(function (day) {
                return [
                    escapeHtml(day.date),
                    escapeHtml(day.condition),
                    escapeHtml(day.temp_min_c ?? "N/A") + " °C",
                    escapeHtml(day.temp_max_c ?? "N/A") + " °C",
                    escapeHtml(day.rain_chance_percent ?? "N/A") + " %"
                ];
            })
        ) : ""}
    `;
}


// administrator: users and venues

async function editUser(id = 0) {
    const record = id ? (await api("/users/" + id)).data : {};

    const fields =
        field(
            "Name", "name", "text", record.name || "",
            "required maxlength='100'"
        ) +
        field(
            "Email", "email", "email", record.email || "",
            "required maxlength='150'"
        ) +
        field(
            id ? "New password (leave blank to keep current password)" : "Password",
            "password",
            "password",
            "",
            `${id ? "" : "required"} minlength="8" maxlength="72"
             autocomplete="new-password"`
        ) +
        selectField(
            "Role",
            "role",
            [
                ["admin", "Administrator"],
                ["organiser", "Organiser"],
                ["customer", "Customer"]
            ],
            record.role || "customer"
        );

    showForm(id ? "Edit user" : "Add user", fields, async function (data) {
        if (id && !data.password) {
            delete data.password;
        }

        if (id === Number(user.id) && data.role !== "admin") {
            throw new Error("You cannot change your own administrator role.");
        }

        const result = await api(
            id ? "/users/" + id : "/users",
            id ? "PUT" : "POST",
            data
        );

        if (id === Number(user.id)) {
            user = result.data;
            renderNavigation();
        }

        await finish(result, "users");
    });
}

async function editVenue(id = 0) {
    const venue = id ? (await api("/venues/" + id)).data : {};

    const fields =
        field(
            "Venue name", "name", "text", venue.name || "",
            "required maxlength='150'"
        ) +
        field(
            "Address", "address", "text", venue.address || "",
            "required maxlength='255'"
        ) +
        field(
            "City", "city", "text", venue.city || "",
            "required maxlength='100'"
        ) +
        field(
            "Capacity", "capacity", "number", venue.capacity || "",
            "required min='1' step='1'"
        );

    showForm(id ? "Edit venue" : "Add venue", fields, async function (data) {
        const result = await api(
            id ? "/venues/" + id : "/venues",
            id ? "PUT" : "POST",
            data
        );

        await finish(result, "venues");
    });
}


// administrator and organiser: events

async function editEvent(id = 0) {
    const event = id ? (await api("/events/" + id)).data : {};
    const venues = await getAll("/venues");

    if (venues.length === 0) {
        throw new Error("Ask an administrator to create a venue first.");
    }

    let fields =
        field(
            "Event title", "title", "text", event.title || "",
            "required maxlength='200'"
        ) +
        `
            <label>
                Description
                <textarea name="description">${escapeHtml(
                    event.description || ""
                )}</textarea>
            </label>
        ` +
        selectField(
            "Venue",
            "venue_id",
            venues.map(function (venue) {
                return [
                    venue.id,
                    venue.name + " — capacity: " + venue.capacity
                ];
            }),
            event.venue_id
        );

    if (user.role === "admin") {
        const users = await getAll("/users");

        fields += selectField(
            "Organiser",
            "organiser_id",
            users.filter(function (record) {
                return ["admin", "organiser"].includes(record.role);
            }).map(function (record) {
                return [record.id, record.name + " (" + record.role + ")"];
            }),
            event.organiser_id
        );
    }

    fields +=
        field(
            "Event date", "event_date", "date", event.event_date || "",
            "required"
        ) +
        field(
            "Start time", "start_time", "time",
            (event.start_time || "").slice(0, 5), "required"
        ) +
        field(
            "End time", "end_time", "time",
            (event.end_time || "").slice(0, 5), "required"
        );

    if (id) {
        fields += selectField(
            "Status",
            "status",
            [
                ["upcoming", "Upcoming"],
                ["cancelled", "Cancelled"],
                ["completed", "Completed"]
            ],
            event.status
        );

        fields += `
            <p class="note">
                To change ticket prices or quantities, open the event
                and edit its ticket types.
            </p>
        `;
    } else {
        fields +=
            field(
                "Standard ticket price (RM)", "ticket_price",
                "number", "", "required min='0' step='0.01'"
            ) +
            field(
                "Number of Standard tickets", "total_tickets",
                "number", "", "required min='1' step='1'"
            );
    }

    showForm(id ? "Edit event" : "Add event", fields, async function (data) {
        data.venue_id = Number(data.venue_id);

        if (data.organiser_id) {
            data.organiser_id = Number(data.organiser_id);
        }

        if (data.end_time <= data.start_time) {
            throw new Error("End time must be after start time.");
        }

        if (
            !id &&
            new Date(
                data.event_date + "T" + data.start_time + ":00+08:00"
            ).getTime() <= Date.now()
        ) {
            throw new Error("Choose a future date and start time.");
        }

        const venue = venues.find(function (record) {
            return Number(record.id) === data.venue_id;
        });

        const total = id ? Number(event.total_tickets) : data.total_tickets;

        if (total > Number(venue.capacity)) {
            throw new Error("The ticket total exceeds this venue's capacity.");
        }

        if (
            id &&
            event.status !== "cancelled" &&
            data.status === "cancelled" &&
            !confirm("Cancel this event and all its confirmed bookings?")
        ) {
            return;
        }

        const result = await api(
            id ? "/events/" + id : "/events",
            id ? "PUT" : "POST",
            data
        );

        await finish(result, "events");
    });
}


// Ticket types

async function editTicket(eventId, ticketId = 0) {
    const ticket = ticketId
        ? (await api("/ticket-types/" + ticketId)).data
        : {};

    const fields =
        field(
            "Ticket type name", "name", "text", ticket.name || "",
            "required maxlength='100'"
        ) +
        field(
            "Price (RM)", "price", "number", ticket.price ?? "",
            "required min='0' step='0.01'"
        ) +
        field(
            "Total quantity, including sold tickets",
            "quantity",
            "number",
            ticket.quantity ?? "",
            "required min='1' step='1'"
        ) +
        `
            <p class="note">
                The API calculates remaining availability from the total
                quantity and tickets already sold.
            </p>
        `;

    showForm(
        ticketId ? "Edit ticket type" : "Add ticket type",
        fields,
        async function (data) {
            const result = await api(
                ticketId
                    ? "/ticket-types/" + ticketId
                    : "/events/" + eventId + "/ticket-types",
                ticketId ? "PUT" : "POST",
                data
            );

            await finish(result, "events");
        },
        `showEvent(${eventId})`
    );
}

async function removeTicket(eventId, ticketId) {
    if (!confirm("Delete this ticket type?")) {
        return;
    }

    const result = await api("/ticket-types/" + ticketId, "DELETE");

    await finish(result, "events");
}


// customer bookings

async function bookEvent(id) {
    const results = await Promise.all([
        api("/events/" + id),
        getAll("/events/" + id + "/ticket-types")
    ]);

    const event = results[0].data;
    const types = results[1].filter(function (type) {
        return Number(type.quantity_available) > 0;
    });

    if (!canBook(event) || types.length === 0) {
        throw new Error("This event is no longer available for booking.");
    }

    const fields =
        `<p>${escapeHtml(event.title)}</p>` +
        selectField(
            "Ticket type",
            "ticket_type_id",
            types.map(function (type) {
                return [
                    type.id,
                    type.name + " — " + money(type.price) +
                    " — " + type.quantity_available + " available"
                ];
            }),
            types[0].id
        ) +
        field(
            "Quantity", "quantity", "number", 1,
            "required min='1' step='1'"
        ) +
        '<p id="bookingTotal" aria-live="polite"></p>';

    const form = showForm(
        "Book tickets",
        fields,
        async function (data) {
            const type = types.find(function (record) {
                return Number(record.id) === Number(data.ticket_type_id);
            });

            if (!type || data.quantity > Number(type.quantity_available)) {
                throw new Error("The requested quantity is not available.");
            }

            const result = await api("/bookings", "POST", {
                event_id: id,
                ticket_type_id: Number(data.ticket_type_id),
                quantity: data.quantity
            });

            result.message +=
                ". Booking #" + result.data.id +
                " — " + money(result.data.total_price);

            await finish(result, "bookings");
        },
        `showEvent(${id})`
    );

    form.querySelector('button[type="submit"]').textContent = "Confirm booking";

    function updateTotal() {
        const type = types.find(function (record) {
            return Number(record.id) ===
                Number(form.elements.ticket_type_id.value);
        });

        if (!type) {
            document.getElementById("bookingTotal").textContent =
                "Select a ticket type.";
            return;
        }

        form.elements.quantity.max = type.quantity_available;

        const quantity = Number(form.elements.quantity.value);

        document.getElementById("bookingTotal").textContent =
            "Estimated total: " + money(type.price * quantity);
    }

    form.elements.ticket_type_id.onchange = updateTotal;
    form.elements.quantity.oninput = updateTotal;

    updateTotal();
}

async function showBooking(id) {
    const booking = (await api("/bookings/" + id)).data;

    content.innerHTML = `
        <h2>Booking #${Number(booking.id)}</h2>

        ${table(
            ["Detail", "Value"],
            [
                ["Event", escapeHtml(booking.event_title)],
                ["Customer", escapeHtml(booking.customer_name)],
                [
                    "Ticket type",
                    escapeHtml(booking.ticket_type_name || "Removed ticket type")
                ],
                ["Quantity", escapeHtml(booking.quantity)],
                ["Total", money(booking.total_price)],
                ["Booking status", escapeHtml(booking.status)],
                ["Event status", escapeHtml(booking.event_status)],
                ["Event date", escapeHtml(booking.event_date)],
                ["Start time", escapeHtml(booking.start_time)],
                ["Booked at", escapeHtml(booking.booked_at)]
            ]
        )}

        <div class="toolbar">
            ${button("Back to bookings", "showList('bookings')")}
        </div>
    `;
}

async function editBooking(id) {
    const booking = (await api("/bookings/" + id)).data;

    showForm(
        "Change booking quantity",
        `<p>${escapeHtml(booking.event_title)}</p>` +
        field(
            "Quantity", "quantity", "number", booking.quantity,
            "required min='1' step='1'"
        ) +
        `
            <p class="note">
                The API checks remaining availability and keeps
                the original unit price for this booking.
            </p>
        `,
        async function (data) {
            const result = await api("/bookings/" + id, "PUT", data);

            await finish(result, "bookings");
        },
        "showList('bookings')"
    );
}

async function cancelBooking(id) {
    if (!confirm("Cancel this booking?")) {
        return;
    }

    const result = await api("/bookings/" + id, "PUT", {
        status: "cancelled"
    });

    await finish(result, "bookings");
}


// delete record

async function removeRecord(kind, id) {
    let question = "Delete this record?";

    if (kind === "events") {
        question =
            "Delete this event? Its ticket types and booking records " +
            "will also be permanently deleted.";
    }

    if (kind === "bookings") {
        question = "Permanently delete this booking record?";
    }

    if (!confirm(question)) {
        return;
    }

    const result = await api("/" + kind + "/" + id, "DELETE");

    await finish(result, kind);
}


// restore an existing login 

renderNavigation();
showLogin();

if (token) {
    run(async function () {
        const result = await api("/auth/me");

        user = result.data;
        renderNavigation();

        await showList("events");
    });
}