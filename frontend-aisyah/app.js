/* =========================================
   TIKETKITA FRONTEND
   CUSTOMER + ORGANISER + ADMIN DASHBOARD
   ========================================= */

const API_BASE = "http://localhost/event-api/api";

const $ = id => document.getElementById(id);

const eventsList = $("eventsList");
const eventDetails = $("eventDetails");
const bookingsList = $("bookingsList");
const manageContent = $("manageContent");
const adminContent = $("adminContent");

let currentToken = null;
let currentUser = null;


// =========================================
// API HELPERS
// =========================================

async function apiRequest(path, options = {}) {
    const response = await fetch(API_BASE + path, options);
    const result = await response.json();

    if (!response.ok || !result.success) {
        throw new Error(
            result.error?.message || "API request failed"
        );
    }

    return result.data;
}


function authHeaders() {
    return {
        Authorization: "Bearer " + currentToken
    };
}


function showMessage(text, isError = false) {
    const message = $("message");

    message.textContent = text;

    message.style.color = isError
        ? "#B42318"
        : "var(--primary-dark)";
}


function displayText(container, text) {
    const p = document.createElement("p");
    p.textContent = text;

    container.replaceChildren(p);
}


function addText(container, label, value) {
    const p = document.createElement("p");

    p.textContent =
        label + ": " + (value ?? "-");

    container.appendChild(p);
}


function formatPrice(value) {
    return "RM " + Number(value).toFixed(2);
}


function makeButton(text, handler) {
    const button = document.createElement("button");

    button.type = "button";
    button.className = "btn-primary";
    button.textContent = text;

    button.addEventListener(
        "click",
        handler
    );

    return button;
}


function createTable(headers, rows) {
    const wrapper = document.createElement("div");
    wrapper.style.overflowX = "auto";

    const table = document.createElement("table");

    const headerRow = document.createElement("tr");

    headers.forEach(label => {
        const th = document.createElement("th");

        th.textContent = label;

        headerRow.appendChild(th);
    });

    table.appendChild(headerRow);

    rows.forEach(values => {
        const tr = document.createElement("tr");

        values.forEach(value => {
            const td = document.createElement("td");

            if (value instanceof HTMLElement) {
                td.appendChild(value);
            } else {
                td.textContent = value ?? "-";
            }

            tr.appendChild(td);
        });

        table.appendChild(tr);
    });

    wrapper.appendChild(table);

    return wrapper;
}


// =========================================
// EVENTS
// =========================================

function createEventCard(event) {
    const card = document.createElement("article");

    card.className = "event-card";

    const title = document.createElement("h3");

    title.textContent = event.title;

    card.appendChild(title);

    addText(
        card,
        "Date",
        event.event_date
    );

    addText(
        card,
        "Venue",
        event.venue_name
    );

    addText(
        card,
        "City",
        event.venue_city
    );

    addText(
        card,
        "From",
        formatPrice(event.ticket_price)
    );

    addText(
        card,
        "Tickets Left",
        event.tickets_available
    );

    addText(
        card,
        "Status",
        event.status
    );

    card.appendChild(
        makeButton(
            "View Details",
            () => {
                loadEventDetails(event.id);
            }
        )
    );

    return card;
}


async function loadEvents(filters = {}) {
    displayText(
        eventsList,
        "Loading events..."
    );

    eventDetails.hidden = true;
    eventDetails.replaceChildren();

    const params = new URLSearchParams({
        page: "1",
        limit: "100"
    });

    if (filters.search) {
        params.set(
            "search",
            filters.search
        );
    }

    if (filters.city) {
        params.set(
            "city",
            filters.city
        );
    }

    if (filters.date) {
        params.set(
            "date",
            filters.date
        );
    }

    try {
        const events = await apiRequest(
            "/events?" + params.toString()
        );

        if (!Array.isArray(events)) {
            throw new Error(
                "Invalid events data"
            );
        }

        eventsList.replaceChildren();

        if (events.length === 0) {
            displayText(
                eventsList,
                "No events found."
            );

            return;
        }

        events.forEach(event => {
            eventsList.appendChild(
                createEventCard(event)
            );
        });

    } catch (error) {
        console.error(
            "Events Error:",
            error
        );

        displayText(
            eventsList,
            "Unable to load events: " +
            error.message
        );
    }
}


$("searchForm").addEventListener(
    "submit",
    event => {
        event.preventDefault();

        loadEvents({
            search:
                $("searchInput").value.trim(),

            city:
                $("cityInput").value.trim(),

            date:
                $("dateInput").value
        });
    }
);


$("btnClear").addEventListener(
    "click",
    () => {
        $("searchForm").reset();

        loadEvents();
    }
);


// =========================================
// WEATHER FORECAST
// =========================================

async function loadEventWeather(eventId) {

    const weatherSection =
        document.createElement("div");

    weatherSection.className =
        "weather-section";


    // Styling weather card
    // Kept here so style.css does not need
    // to be changed for initial testing.

    weatherSection.style.margin =
        "22px 0";

    weatherSection.style.padding =
        "18px";

    weatherSection.style.backgroundColor =
        "var(--soft-pink)";

    weatherSection.style.border =
        "1px solid var(--border)";

    weatherSection.style.borderRadius =
        "8px";


    const heading =
        document.createElement("h3");

    heading.textContent =
        "Weather Forecast";

    heading.style.marginTop =
        "0";


    const status =
        document.createElement("p");

    status.textContent =
        "Loading weather forecast...";


    weatherSection.append(
        heading,
        status
    );

    eventDetails.appendChild(
        weatherSection
    );


    try {

        const weather =
            await apiRequest(
                "/events/" +
                eventId +
                "/weather"
            );


        weatherSection.replaceChildren();


        const newHeading =
            document.createElement("h3");

        newHeading.textContent =
            "Weather Forecast";

        newHeading.style.marginTop =
            "0";

        weatherSection.appendChild(
            newHeading
        );


        // =========================================
        // LOCATION
        // =========================================

        if (weather.location) {

            addText(
                weatherSection,
                "Location",
                weather.location.city
            );

        }


        // =========================================
        // CHECK FORECAST
        // =========================================

        if (
            !Array.isArray(
                weather.forecast
            ) ||
            weather.forecast.length === 0
        ) {

            const unavailable =
                document.createElement("p");

            unavailable.textContent =
                "No weather forecast is available for this event date.";

            weatherSection.appendChild(
                unavailable
            );

            return;
        }


        // =========================================
        // FORECAST TYPE
        // =========================================

        if (
            weather.forecast_type ===
            "event_date"
        ) {

            const info =
                document.createElement("p");

            info.textContent =
                "Forecast for the event day.";

            weatherSection.appendChild(
                info
            );

        } else if (
            weather.forecast_type ===
            "outlook"
        ) {

            const info =
                document.createElement("p");

            info.textContent =
                "The event date is too far away for an exact forecast. " +
                "Showing the current 7-day outlook for the venue city.";

            weatherSection.appendChild(
                info
            );
        }


        // =========================================
        // DISPLAY FORECAST
        // =========================================

        weather.forecast.forEach(
            day => {

                const card =
                    document.createElement(
                        "div"
                    );

                card.className =
                    "weather-day";


                card.style.backgroundColor =
                    "var(--white)";

                card.style.border =
                    "1px solid var(--border)";

                card.style.borderRadius =
                    "6px";

                card.style.padding =
                    "14px";

                card.style.marginTop =
                    "12px";


                const date =
                    document.createElement(
                        "strong"
                    );

                date.textContent =
                    day.date;

                date.style.display =
                    "block";

                date.style.marginBottom =
                    "8px";


                card.appendChild(date);


                addText(
                    card,
                    "Condition",
                    day.condition
                );


                addText(
                    card,
                    "Temperature",
                    day.temp_min_c +
                    "°C - " +
                    day.temp_max_c +
                    "°C"
                );


                addText(
                    card,
                    "Rain Chance",
                    day.rain_chance_percent +
                    "%"
                );


                addText(
                    card,
                    "Rain",
                    day.rain_mm +
                    " mm"
                );


                addText(
                    card,
                    "Maximum Wind",
                    day.wind_max_kmh +
                    " km/h"
                );


                weatherSection.appendChild(
                    card
                );
            }
        );


        // =========================================
        // WEATHER SOURCE
        // =========================================

        if (weather.source) {

            const source =
                document.createElement(
                    "small"
                );

            source.textContent =
                "Weather data: " +
                weather.source;

            source.style.display =
                "block";

            source.style.marginTop =
                "12px";

            source.style.color =
                "var(--muted)";


            weatherSection.appendChild(
                source
            );
        }


    } catch (error) {

        console.error(
            "Weather Error:",
            error
        );


        status.textContent =
            "Weather forecast is currently unavailable.";
    }
}


// =========================================
// EVENT DETAILS
// =========================================

let eventDetailsRequestId = 0;

async function loadEventDetails(eventId) {

    const requestId = ++eventDetailsRequestId;

    eventDetails.hidden = false;

    eventDetails.classList.add(
        "event-card"
    );

    eventDetails.style.marginTop =
        "22px";


    displayText(
        eventDetails,
        "Loading event details..."
    );


    try {

        const [event, tickets] =
            await Promise.all([

                apiRequest(
                    "/events/" +
                    eventId
                ),

                apiRequest(
                    "/events/" +
                    eventId +
                    "/ticket-types?limit=100"
                )

            ]);

        if (requestId !== eventDetailsRequestId) {
    return;
}

        eventDetails.replaceChildren();


        // =========================================
        // EVENT INFORMATION
        // =========================================

        const title =
            document.createElement("h2");

        title.textContent =
            event.title;

        eventDetails.appendChild(
            title
        );


        const description =
            document.createElement("p");

        description.textContent =
            event.description ||
            "No description available.";

        eventDetails.appendChild(
            description
        );


        addText(
            eventDetails,
            "Date",
            event.event_date
        );


        addText(
            eventDetails,
            "Time",
            event.start_time +
            " - " +
            event.end_time
        );


        addText(
            eventDetails,
            "Venue",
            event.venue_name
        );


        addText(
            eventDetails,
            "Address",
            event.venue_address
        );


        addText(
            eventDetails,
            "City",
            event.venue_city
        );


        addText(
            eventDetails,
            "Organiser",
            event.organiser_name
        );


        addText(
            eventDetails,
            "Status",
            event.status
        );


        // =========================================
        // WEATHER FORECAST
        // =========================================

       await loadEventWeather(
    eventId
);


// STOP OLD REQUEST AFTER WEATHER FINISHES
if (requestId !== eventDetailsRequestId) {
    return;
}


// =========================================
// AVAILABLE TICKET TYPES
// =========================================

        const heading =
            document.createElement("h3");

        heading.textContent =
            "Available Ticket Types";

        eventDetails.appendChild(
            heading
        );


        if (!Array.isArray(tickets)) {

            throw new Error(
                "Invalid ticket data"
            );
        }


        const ticketRows =
            tickets.map(ticket => [

                ticket.name,

                formatPrice(
                    ticket.price
                ),

                ticket.quantity_available,

                ticket.quantity

            ]);


        eventDetails.appendChild(

            createTable(

                [
                    "Ticket Type",
                    "Price",
                    "Available",
                    "Total"
                ],

                ticketRows

            )

        );


        // =========================================
        // BOOKING AVAILABILITY
        // =========================================

        const available =
            tickets.filter(

                ticket =>
                    Number(
                        ticket.quantity_available
                    ) > 0

            );


        const info =
            document.createElement("p");


        if (
            event.status !==
            "upcoming"
        ) {

            info.textContent =
                "Booking is closed for this event.";

        } else if (
            available.length === 0
        ) {

            info.textContent =
                "This event is sold out.";

        } else {

            info.textContent =
                "Tickets are available for booking.";

        }


        eventDetails.appendChild(
            info
        );


        // =========================================
        // CUSTOMER BOOKING FORM
        // =========================================

        if (

            event.status ===
                "upcoming" &&

            available.length > 0 &&

            currentUser?.role ===
                "customer"

        ) {

            renderBookingForm(
                event,
                available
            );

        }


        // =========================================
        // CLOSE DETAILS
        // =========================================

        eventDetails.appendChild(

            makeButton(

                "Close Details",

                () => {

                    eventDetails.hidden =
                        true;

                    eventDetails
                        .replaceChildren();

                }

            )

        );


        eventDetails.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });


    } catch (error) {

        console.error(
            "Event Details Error:",
            error
        );


        displayText(

            eventDetails,

            "Unable to load details: " +
            error.message

        );

    }
}


// =========================================
// CUSTOMER - CREATE BOOKING
// =========================================

function renderBookingForm(
    event,
    tickets
) {

    const heading =
        document.createElement("h3");

    heading.textContent =
        "Book Tickets";

    eventDetails.appendChild(
        heading
    );


    const form =
        document.createElement("form");

    form.className =
        "form-card";


    const selectGroup =
        document.createElement("div");

    selectGroup.className =
        "form-group";


    const selectLabel =
        document.createElement("label");

    selectLabel.textContent =
        "Ticket Type";


    const select =
        document.createElement("select");

    select.required = true;

    select.style.width =
        "100%";

    select.style.padding =
        "11px";


    tickets.forEach(
        ticket => {

            const option =
                document.createElement(
                    "option"
                );

            option.value =
                ticket.id;

            option.textContent =
                ticket.name +
                " — " +
                formatPrice(
                    ticket.price
                ) +
                " (" +
                ticket.quantity_available +
                " left)";


            select.appendChild(
                option
            );

        }
    );


    selectGroup.append(
        selectLabel,
        select
    );


    const qtyGroup =
        document.createElement("div");

    qtyGroup.className =
        "form-group";


    const qtyLabel =
        document.createElement("label");

    qtyLabel.textContent =
        "Quantity";


    const quantity =
        document.createElement("input");

    quantity.type =
        "number";

    quantity.min =
        "1";

    quantity.step =
        "1";

    quantity.value =
        "1";

    quantity.required =
        true;


    qtyGroup.append(
        qtyLabel,
        quantity
    );


    const total =
        document.createElement("p");

    const feedback =
        document.createElement("p");


    function selectedTicket() {

        return tickets.find(

            ticket =>
                String(ticket.id) ===
                select.value

        );

    }


    function updateTotal() {

        const ticket =
            selectedTicket();


        if (!ticket) {
            return;
        }


        quantity.max =
            ticket.quantity_available;


        total.textContent =

            "Estimated Total: " +

            formatPrice(

                Number(
                    ticket.price
                ) *

                (
                    Number(
                        quantity.value
                    ) || 0
                )

            );

    }


    select.addEventListener(
        "change",
        () => {

            quantity.value =
                "1";

            updateTotal();

        }
    );


    quantity.addEventListener(
        "input",
        updateTotal
    );


    const submit =
        document.createElement("button");

    submit.type =
        "submit";

    submit.className =
        "btn-primary";

    submit.textContent =
        "Confirm Booking";


    form.append(

        selectGroup,

        qtyGroup,

        total,

        submit,

        feedback

    );


    eventDetails.appendChild(
        form
    );


    updateTotal();


    form.addEventListener(
        "submit",
        async e => {

            e.preventDefault();


            const ticket =
                selectedTicket();

            const qty =
                Number(
                    quantity.value
                );


            if (

                !ticket ||

                !Number.isSafeInteger(
                    qty
                ) ||

                qty < 1 ||

                qty >
                Number(
                    ticket.quantity_available
                )

            ) {

                feedback.textContent =
                    "Please enter a valid ticket quantity.";

                return;

            }


            if (

                !currentToken ||

                currentUser?.role !==
                    "customer"

            ) {

                feedback.textContent =
                    "Please log in as a customer.";

                return;

            }


            const confirmed =
                window.confirm(

                    "Confirm booking for " +

                    formatPrice(

                        qty *
                        Number(
                            ticket.price
                        )

                    ) +

                    "?"

                );


            if (!confirmed) {
                return;
            }


            submit.disabled =
                true;

            submit.textContent =
                "Booking...";


            try {

                await apiRequest(
                    "/bookings",
                    {

                        method:
                            "POST",

                        headers: {

                            ...authHeaders(),

                            "Content-Type":
                                "application/json"

                        },

                        body:
                            JSON.stringify({

                                event_id:
                                    Number(
                                        event.id
                                    ),

                                ticket_type_id:
                                    Number(
                                        ticket.id
                                    ),

                                quantity:
                                    qty

                            })

                    }
                );


                showMessage(
                    "Booking confirmed successfully."
                );


                await loadEvents();


                showPage(
                    "bookings"
                );


            } catch (error) {

                feedback.textContent =

                    "Unable to book: " +

                    error.message;


            } finally {

                submit.disabled =
                    false;

                submit.textContent =
                    "Confirm Booking";

            }

        }
    );

}


// =========================================
// AUTHENTICATION AND NAVIGATION
// =========================================

function updateNavigation() {

    const role =
        currentUser?.role ?? null;


    $("authSection").hidden =
        currentUser !== null;


    $("navBookings").hidden =
        role !== "customer";


    // Organisers use Manage Events.
    // Admins use the dedicated Admin dashboard.

    $("navManage").hidden =
        role !== "organiser";


    $("navAdmin").hidden =
        role !== "admin";


    $("btnLogout").hidden =
        currentUser === null;

}


function showPage(page) {

    const role =
        currentUser?.role ?? null;


    const allowed = {

        events:
            true,

        bookings:
            role === "customer",

        manage:
            role === "organiser",

        admin:
            role === "admin"

    };


    if (!allowed[page]) {

        showMessage(

            "You do not have permission to access this page.",

            true

        );

        return;

    }


    $("eventsSection").hidden =
        page !== "events";


    $("bookingsSection").hidden =
        page !== "bookings";


    $("manageSection").hidden =
        page !== "manage";


    $("adminSection").hidden =
        page !== "admin";


    if (
        page === "bookings"
    ) {

        loadBookings();

    }


    if (
        page === "manage" &&
        role === "organiser"
    ) {

        loadOrganiserPage();

    }


    if (
        page === "admin" &&
        role === "admin"
    ) {

        loadAdminPage();

    }

}


$("navEvents").addEventListener(
    "click",
    () =>
        showPage("events")
);


$("navBookings").addEventListener(
    "click",
    () =>
        showPage("bookings")
);


$("navManage").addEventListener(
    "click",
    () =>
        showPage("manage")
);


$("navAdmin").addEventListener(
    "click",
    () =>
        showPage("admin")
);


// =========================================
// LOGIN
// =========================================

$("loginForm").addEventListener(
    "submit",
    async event => {

        event.preventDefault();


        const email =
            $("loginEmail")
                .value
                .trim();


        const password =
            $("loginPassword")
                .value;


        const button =
            $("loginForm")
                .querySelector(
                    'button[type="submit"]'
                );


        button.disabled =
            true;

        button.textContent =
            "Logging in...";


        try {

            const data =
                await apiRequest(

                    "/auth/login",

                    {

                        method:
                            "POST",

                        headers: {

                            "Content-Type":
                                "application/json"

                        },

                        body:
                            JSON.stringify({
                                email,
                                password
                            })

                    }

                );


            currentToken =
                data.token;


            currentUser =
                data.user;


            $("loginForm").reset();


            updateNavigation();


            showPage(
                "events"
            );


            showMessage(

                "Welcome " +

                currentUser.name +

                " (" +

                currentUser.role +

                ")"

            );


        } catch (error) {

            showMessage(
                error.message,
                true
            );


        } finally {

            button.disabled =
                false;

            button.textContent =
                "Log In";

        }

    }
);


// =========================================
// LOGOUT
// =========================================

$("btnLogout").addEventListener(
    "click",
    async () => {

        try {

            await apiRequest(

                "/auth/logout",

                {

                    method:
                        "POST",

                    headers:
                        authHeaders()

                }

            );


            currentToken =
                null;


            currentUser =
                null;


            bookingsList
                .replaceChildren();


            manageContent
                .replaceChildren();


            adminContent
                .replaceChildren();


            adminActiveTab =
                "users";


            adminTicketEventId =
                null;


            showAuthForm(
                "login"
            );


            updateNavigation();


            showPage(
                "events"
            );


            showMessage(
                "You have successfully logged out."
            );


        } catch (error) {

            showMessage(
                error.message,
                true
            );

        }

    }
);


// =========================================
// CUSTOMER REGISTRATION
// =========================================

function showAuthForm(mode) {

    const register =
        mode === "register";


    $("loginPanel").hidden =
        register;


    $("registerPanel").hidden =
        !register;


    $("authTitle").textContent =

        register

            ? "Create an Account"

            : "Welcome Back";


    $("authSubtitle").textContent =

        register

            ? "Join TiketKita as a customer."

            : "Log in to manage your events and bookings.";


    $("registerFeedback")
        .textContent = "";


    showMessage("");

}


$("btnShowRegister")
    .addEventListener(
        "click",
        () => {

            showAuthForm(
                "register"
            );

        }
    );


$("btnBackToLogin")
    .addEventListener(
        "click",
        () => {

            showAuthForm(
                "login"
            );

        }
    );


$("registerForm")
    .addEventListener(
        "submit",
        async event => {

            event.preventDefault();


            const name =
                $("registerName")
                    .value
                    .trim();


            const email =
                $("registerEmail")
                    .value
                    .trim();


            const password =
                $("registerPassword")
                    .value;


            const confirm =
                $("confirmPassword")
                    .value;


            const feedback =
                $("registerFeedback");


            feedback.textContent =
                "";

            feedback.style.color =
                "#B42318";


            if (!name) {

                feedback.textContent =
                    "Please enter your name.";

                return;

            }


            if (
                password.length < 8 ||
                password.length > 72
            ) {

                feedback.textContent =
                    "Password must be 8 to 72 characters.";

                return;

            }


            if (
                password !== confirm
            ) {

                feedback.textContent =
                    "Passwords do not match.";

                return;

            }


            const button =
                $("registerForm")
                    .querySelector(
                        'button[type="submit"]'
                    );


            button.disabled =
                true;


            try {

                await apiRequest(

                    "/auth/register",

                    {

                        method:
                            "POST",

                        headers: {

                            "Content-Type":
                                "application/json"

                        },

                        body:
                            JSON.stringify({

                                name,

                                email,

                                password

                            })

                    }

                );


                $("loginEmail").value =
                    email;


                $("registerForm")
                    .reset();


                feedback.style.color =
                    "var(--primary-dark)";


                feedback.textContent =
                    "Account created successfully! " +
                    "Click Back to Login to continue.";


            } catch (error) {

                feedback.textContent =
                    error.message;


            } finally {

                button.disabled =
                    false;

            }

        }
    );


// =========================================
// CUSTOMER - MY BOOKINGS
// =========================================

async function loadBookings() {

    if (

        !currentToken ||

        currentUser?.role !==
            "customer"

    ) {

        displayText(

            bookingsList,

            "Please log in as a customer."

        );

        return;

    }


    displayText(

        bookingsList,

        "Loading your bookings..."

    );


    try {

        const bookings =
            await apiRequest(

                "/bookings?limit=100",

                {

                    headers:
                        authHeaders()

                }

            );


        bookingsList
            .replaceChildren();


        if (
            !Array.isArray(
                bookings
            )
        ) {

            throw new Error(
                "Invalid bookings data"
            );

        }


        if (
            bookings.length === 0
        ) {

            const card =
                document.createElement(
                    "div"
                );


            card.className =
                "event-card";


            const p =
                document.createElement(
                    "p"
                );


            p.textContent =
                "You haven't made any bookings yet.";


            card.appendChild(
                p
            );


            card.appendChild(

                makeButton(

                    "Browse Events",

                    () => {

                        showPage(
                            "events"
                        );

                    }

                )

            );


            bookingsList.appendChild(
                card
            );


            return;

        }


        const rows =
            bookings.map(
                booking => {

                    const action =

                        booking.status ===
                            "confirmed" &&

                        booking.event_status !==
                            "completed"

                            ? makeButton(

                                "Cancel",

                                () => {

                                    cancelBooking(
                                        booking.id
                                    );

                                }

                            )

                            : "—";


                    return [

                        booking.event_title,

                        booking.event_date,

                        booking.ticket_type_name ||
                            "-",

                        booking.quantity,

                        formatPrice(
                            booking.total_price
                        ),

                        booking.status,

                        action

                    ];

                }
            );


        bookingsList.appendChild(

            createTable(

                [
                    "Event",
                    "Date",
                    "Ticket Type",
                    "Qty",
                    "Total",
                    "Status",
                    "Action"
                ],

                rows

            )

        );


    } catch (error) {

        displayText(

            bookingsList,

            "Unable to load bookings: " +
            error.message

        );

    }

}


// =========================================
// CANCEL BOOKING
// =========================================

async function cancelBooking(id) {

    if (
        !window.confirm(
            "Cancel this booking?"
        )
    ) {

        return;

    }


    try {

        await apiRequest(

            "/bookings/" + id,

            {

                method:
                    "PATCH",

                headers: {

                    ...authHeaders(),

                    "Content-Type":
                        "application/json"

                },

                body:
                    JSON.stringify({

                        status:
                            "cancelled"

                    })

            }

        );


        showMessage(
            "Booking cancelled successfully."
        );


        await loadBookings();

        await loadEvents();


    } catch (error) {

        showMessage(

            "Unable to cancel booking: " +
            error.message,

            true

        );

    }

}


// =========================================
// STEP 34 - ORGANISER MANAGEMENT
// =========================================

function createFormField(
    label,
    type,
    name,
    required = true
) {

    const group =
        document.createElement(
            "div"
        );


    group.className =
        "form-group";


    const text =
        document.createElement(
            "label"
        );


    text.textContent =
        label;


    text.htmlFor =
        "organiser-" +
        name;


    const input =
        document.createElement(
            "input"
        );


    input.type =
        type;


    input.name =
        name;


    input.id =
        "organiser-" +
        name;


    input.required =
        required;


    if (
        type === "number"
    ) {

        input.min =
            name === "ticket_price"
                ? "0"
                : "1";


        input.step =
            name === "ticket_price"
                ? "0.01"
                : "1";

    }


    if (
        name === "title"
    ) {

        input.maxLength =
            200;

    }


    group.append(
        text,
        input
    );


    return group;

}

// =========================================
// LOAD ORGANISER DATA
// =========================================

async function loadOrganiserPage() {

    if (
        !currentToken ||
        currentUser?.role !== "organiser"
    ) {
        return;
    }

    displayText(
        manageContent,
        "Loading organiser information..."
    );

    try {

        const [events, venues, bookings] =
            await Promise.all([

                apiRequest(
                    "/events?organiser_id=" +
                    encodeURIComponent(currentUser.id) +
                    "&limit=100"
                ),

                apiRequest(
                    "/venues?limit=100"
                ),

                apiRequest(
                    "/bookings?limit=100",
                    {
                        headers: authHeaders()
                    }
                )

            ]);


        if (
            !Array.isArray(events) ||
            !Array.isArray(venues) ||
            !Array.isArray(bookings)
        ) {

            throw new Error(
                "Invalid API data"
            );

        }


        manageContent.replaceChildren();


        // =========================================
        // MY EVENTS
        // =========================================

        const eventHeading =
            document.createElement("h3");

        eventHeading.textContent =
            "My Events";

        manageContent.appendChild(
            eventHeading
        );


        const ticketTypesHost =
            document.createElement("div");


        if (events.length === 0) {

            displayText(
                manageContent,
                "You have not created any events yet."
            );

        } else {

            const rows =
                events.map(event => {

                    const sold =
                        Number(event.total_tickets) -
                        Number(event.tickets_available);


                    const actions =
                        adminActionGroup([

                            adminActionButton(
                                "Ticket Types",
                                () => {

                                    renderAdminTicketTypes(
                                        event,
                                        ticketTypesHost
                                    );

                                }
                            )

                        ]);


                    if (
                        event.status === "upcoming"
                    ) {

                        actions.appendChild(

                            adminActionButton(

                                "Cancel Event",

                                () =>
                                    cancelOrganiserEvent(
                                        event
                                    ),

                                true

                            )

                        );

                    }


                    actions.appendChild(

                        adminActionButton(

                            "Delete",

                            () =>
                                deleteOrganiserEvent(
                                    event
                                ),

                            true

                        )

                    );


                    return [

                        event.title,

                        event.event_date,

                        event.venue_name,

                        sold +
                        "/" +
                        event.total_tickets,

                        event.status,

                        actions

                    ];

                });


            manageContent.appendChild(

                createTable(

                    [
                        "Event",
                        "Date",
                        "Venue",
                        "Sold",
                        "Status",
                        "Actions"
                    ],

                    rows

                )

            );

        }


        manageContent.appendChild(
            ticketTypesHost
        );


        // =========================================
        // CREATE EVENT
        // =========================================

        renderCreateEventForm(
            venues
        );


        // =========================================
        // ORGANISER BOOKINGS
        // =========================================

        const bookHeading =
            document.createElement("h3");

        bookHeading.textContent =
            "Bookings for My Events";

        bookHeading.style.marginTop =
            "30px";

        manageContent.appendChild(
            bookHeading
        );


        if (
            bookings.length === 0
        ) {

            const p =
                document.createElement("p");

            p.textContent =
                "No bookings for your events yet.";

            manageContent.appendChild(
                p
            );

        } else {

            const rows =
                bookings.map(
                    booking => [

                        booking.event_title,

                        booking.customer_name,

                        booking.ticket_type_name ||
                            "-",

                        booking.quantity,

                        formatPrice(
                            booking.total_price
                        ),

                        booking.status

                    ]
                );


            manageContent.appendChild(

                createTable(

                    [
                        "Event",
                        "Customer",
                        "Ticket",
                        "Qty",
                        "Total",
                        "Status"
                    ],

                    rows

                )

            );

        }


    } catch (error) {

        console.error(
            "Organiser Error:",
            error
        );


        displayText(

            manageContent,

            "Unable to load organiser page: " +
            error.message

        );

    }

}


// =========================================
// ORGANISER - CANCEL EVENT
// =========================================

async function cancelOrganiserEvent(
    eventData
) {

    if (
        !window.confirm(
            "Cancel event '" +
            eventData.title +
            "'?"
        )
    ) {

        return;

    }


    try {

        await apiRequest(

            "/events/" +
            eventData.id,

            {

                method: "PATCH",

                headers: {

                    ...authHeaders(),

                    "Content-Type":
                        "application/json"

                },

                body:
                    JSON.stringify({

                        status:
                            "cancelled"

                    })

            }

        );


        showMessage(
            "Event cancelled successfully."
        );


        await loadOrganiserPage();

        await loadEvents();


    } catch (error) {

        showMessage(

            "Unable to cancel event: " +
            error.message,

            true

        );

    }

}


// =========================================
// ORGANISER - DELETE EVENT
// =========================================

async function deleteOrganiserEvent(
    eventData
) {

    if (
        !window.confirm(

            "Delete event '" +
            eventData.title +
            "'? This action cannot be undone."

        )
    ) {

        return;

    }


    try {

        await apiRequest(

            "/events/" +
            eventData.id,

            {

                method: "DELETE",

                headers:
                    authHeaders()

            }

        );


        showMessage(
            "Event deleted successfully."
        );


        await loadOrganiserPage();

        await loadEvents();


    } catch (error) {

        showMessage(

            "Unable to delete event: " +
            error.message,

            true

        );

    }

}


// =========================================
// ORGANISER - CREATE EVENT FORM
// =========================================

function renderCreateEventForm(
    venues
) {

    const heading =
        document.createElement("h3");

    heading.textContent =
        "Create New Event";

    heading.style.marginTop =
        "30px";

    manageContent.appendChild(
        heading
    );


    const form =
        document.createElement("form");

    form.className =
        "form-card";

    form.style.maxWidth =
        "650px";


    form.appendChild(

        createFormField(
            "Event Title",
            "text",
            "title"
        )

    );


    form.appendChild(

        createFormField(
            "Description (optional)",
            "text",
            "description",
            false
        )

    );


    // =========================================
    // VENUE DROPDOWN
    // =========================================

    const venueGroup =
        document.createElement("div");

    venueGroup.className =
        "form-group";


    const venueLabel =
        document.createElement("label");

    venueLabel.textContent =
        "Venue";


    const venueSelect =
        document.createElement("select");

    venueSelect.name =
        "venue_id";

    venueSelect.required =
        true;


    venueSelect.style.cssText =

        "width:100%;" +

        "padding:11px;" +

        "border:1px solid var(--border);" +

        "border-radius:5px";


    venues.forEach(
        venue => {

            const option =
                document.createElement(
                    "option"
                );

            option.value =
                venue.id;

            option.textContent =

                venue.name +

                " (" +

                venue.city +

                ", capacity " +

                venue.capacity +

                ")";


            venueSelect.appendChild(
                option
            );

        }
    );


    venueGroup.append(
        venueLabel,
        venueSelect
    );


    form.appendChild(
        venueGroup
    );


    form.appendChild(

        createFormField(
            "Event Date",
            "date",
            "event_date"
        )

    );


    form.appendChild(

        createFormField(
            "Start Time",
            "time",
            "start_time"
        )

    );


    form.appendChild(

        createFormField(
            "End Time",
            "time",
            "end_time"
        )

    );


    form.appendChild(

        createFormField(

            "Standard Ticket Price (RM)",

            "number",

            "ticket_price"

        )

    );


    form.appendChild(

        createFormField(

            "Standard Ticket Quantity",

            "number",

            "total_tickets"

        )

    );


    const submit =
        document.createElement(
            "button"
        );

    submit.type =
        "submit";

    submit.className =
        "btn-primary";

    submit.textContent =
        "Create Event";

    submit.disabled =
        venues.length === 0;


    const feedback =
        document.createElement("p");

    feedback.setAttribute(
        "role",
        "status"
    );


    form.append(
        submit,
        feedback
    );


    manageContent.appendChild(
        form
    );


    // =========================================
    // SUBMIT NEW EVENT
    // =========================================

    form.addEventListener(
        "submit",
        async event => {

            event.preventDefault();


            const data =
                new FormData(form);


            const start =
                String(
                    data.get(
                        "start_time"
                    )
                );


            const end =
                String(
                    data.get(
                        "end_time"
                    )
                );


            feedback.style.color =
                "#B42318";

            feedback.textContent =
                "";


            if (
                end <= start
            ) {

                feedback.textContent =
                    "End time must be after start time.";

                return;

            }


            const payload = {

                title:
                    String(
                        data.get(
                            "title"
                        )
                    ).trim(),

                description:
                    String(
                        data.get(
                            "description"
                        )
                    ).trim(),

                venue_id:
                    Number(
                        data.get(
                            "venue_id"
                        )
                    ),

                event_date:
                    String(
                        data.get(
                            "event_date"
                        )
                    ),

                start_time:
                    start,

                end_time:
                    end,

                ticket_price:
                    Number(
                        data.get(
                            "ticket_price"
                        )
                    ),

                total_tickets:
                    Number(
                        data.get(
                            "total_tickets"
                        )
                    )

            };


            if (

                !Number.isInteger(
                    payload.total_tickets
                ) ||

                payload.total_tickets < 1 ||

                !Number.isFinite(
                    payload.ticket_price
                ) ||

                payload.ticket_price < 0

            ) {

                feedback.textContent =
                    "Please enter a valid ticket price and quantity.";

                return;

            }


            submit.disabled =
                true;

            submit.textContent =
                "Creating Event...";


            try {

                await apiRequest(

                    "/events",

                    {

                        method:
                            "POST",

                        headers: {

                            ...authHeaders(),

                            "Content-Type":
                                "application/json"

                        },

                        body:
                            JSON.stringify(
                                payload
                            )

                    }

                );


                showMessage(
                    "Event created successfully."
                );


                await loadOrganiserPage();

                await loadEvents();


            } catch (error) {

                feedback.textContent =

                    "Unable to create event: " +

                    error.message;


            } finally {

                submit.disabled =
                    false;

                submit.textContent =
                    "Create Event";

            }

        }
    );

}


// =========================================
// ADMIN DASHBOARD
// =========================================

let adminActiveTab =
    "users";

let adminTicketEventId =
    null;

let adminFieldSequence =
    0;

let adminUsers =
    [];

let adminEvents =
    [];

let adminVenues =
    [];

let adminBookings =
    [];

let adminLoadErrors =
    {};


// =========================================
// ADMIN API HELPERS
// =========================================

async function adminApiRequest(
    path,
    options = {}
) {

    const headers = {

        ...authHeaders(),

        ...(options.headers || {})

    };


    return apiRequest(

        path,

        {
            ...options,
            headers
        }

    );

}


async function adminJsonRequest(
    path,
    method,
    payload
) {

    return adminApiRequest(

        path,

        {

            method,

            headers: {
                "Content-Type":
                    "application/json"
            },

            body:
                JSON.stringify(
                    payload
                )

        }

    );

}


// =========================================
// ADMIN ACTION BUTTON
// =========================================

function adminActionButton(
    label,
    handler,
    isDanger = false
) {

    const button =
        makeButton(
            label,
            handler
        );


    button.style.padding =
        "7px 10px";

    button.style.margin =
        "2px 4px 2px 0";

    button.style.whiteSpace =
        "nowrap";


    if (isDanger) {

        button.style.backgroundColor =
            "#B42318";

        button.style.borderColor =
            "#B42318";

    }


    return button;

}


// =========================================
// ADMIN ACTION GROUP
// =========================================

function adminActionGroup(
    buttons
) {

    const group =
        document.createElement(
            "div"
        );


    group.style.display =
        "flex";

    group.style.flexWrap =
        "wrap";

    group.style.gap =
        "3px";


    buttons.forEach(
        button =>
            group.appendChild(
                button
            )
    );


    return group;

}


// =========================================
// ADMIN FORM CARD
// =========================================

function createAdminFormCard(
    titleText,
    subtitleText = ""
) {

    const card =
        document.createElement(
            "div"
        );


    card.className =
        "form-card";

    card.style.maxWidth =
        "none";

    card.style.width =
        "100%";

    card.style.marginBottom =
        "22px";


    const heading =
        document.createElement(
            "h3"
        );


    heading.textContent =
        titleText;

    heading.style.marginTop =
        "0";

    heading.style.marginBottom =
        "6px";


    card.appendChild(
        heading
    );


    if (subtitleText) {

        const subtitle =
            document.createElement(
                "p"
            );


        subtitle.textContent =
            subtitleText;

        subtitle.style.marginTop =
            "0";

        subtitle.style.color =
            "var(--muted)";


        card.appendChild(
            subtitle
        );

    }


    const form =
        document.createElement(
            "form"
        );


    form.style.display =
        "grid";

    form.style.gridTemplateColumns =
        "repeat(auto-fit, minmax(210px, 1fr))";

    form.style.gap =
        "12px 16px";

    form.style.alignItems =
        "end";


    const feedback =
        document.createElement(
            "p"
        );


    feedback.setAttribute(
        "role",
        "status"
    );

    feedback.style.gridColumn =
        "1 / -1";

    feedback.style.margin =
        "0";


    card.append(
        form,
        feedback
    );


    return {
        card,
        form,
        feedback
    };

}


// =========================================
// ADMIN FIELD
// =========================================

function addAdminField(
    form,
    config
) {

    const group =
        document.createElement(
            "div"
        );


    group.className =
        "form-group";

    group.style.marginBottom =
        "0";


    const id =
        "admin-field-" +
        (++adminFieldSequence);


    const label =
        document.createElement(
            "label"
        );


    label.htmlFor =
        id;

    label.textContent =
        config.label;


    let input;


    if (
        config.type === "select"
    ) {

        input =
            document.createElement(
                "select"
            );


        input.style.width =
            "100%";

        input.style.padding =
            "11px 12px";

        input.style.border =
            "1px solid var(--border)";

        input.style.borderRadius =
            "5px";


        (
            config.options || []
        ).forEach(
            optionData => {

                const option =
                    document.createElement(
                        "option"
                    );


                option.value =
                    String(
                        optionData.value
                    );


                option.textContent =
                    optionData.label;


                input.appendChild(
                    option
                );

            }
        );


    } else if (
        config.type === "textarea"
    ) {

        input =
            document.createElement(
                "textarea"
            );


        input.rows =
            config.rows || 2;

        input.style.width =
            "100%";

        input.style.padding =
            "11px 12px";

        input.style.border =
            "1px solid var(--border)";

        input.style.borderRadius =
            "5px";

        input.style.resize =
            "vertical";


    } else {

        input =
            document.createElement(
                "input"
            );


        input.type =
            config.type || "text";

        input.style.width =
            "100%";

        input.style.padding =
            "11px 12px";

        input.style.border =
            "1px solid var(--border)";

        input.style.borderRadius =
            "5px";

    }


    input.id =
        id;

    input.name =
        config.name;

    input.required =
        config.required !== false;


    if (
        config.value !== undefined &&
        config.value !== null
    ) {

        input.value =
            String(
                config.value
            );

    }


    if (
        config.placeholder
    ) {

        input.placeholder =
            config.placeholder;

    }


    if (
        config.min !== undefined
    ) {

        if (
            input.type === "password"
        ) {

            input.minLength =
                Number(
                    config.min
                );

        } else {

            input.min =
                String(
                    config.min
                );

        }

    }


    if (
        config.max !== undefined
    ) {

        input.max =
            String(
                config.max
            );

    }


    if (
        config.step !== undefined
    ) {

        input.step =
            String(
                config.step
            );

    }


    if (
        config.maxLength !== undefined
    ) {

        input.maxLength =
            config.maxLength;

    }


    if (
        config.disabled
    ) {

        input.disabled =
            true;

    }


    group.append(
        label,
        input
    );


    form.appendChild(
        group
    );


    return input;

}


// =========================================
// ADMIN SUBMIT BUTTON
// =========================================

function addAdminSubmit(
    form,
    labelText
) {

    const button =
        document.createElement(
            "button"
        );


    button.type =
        "submit";

    button.className =
        "btn-primary";

    button.textContent =
        labelText;

    button.style.justifySelf =
        "start";

    button.style.alignSelf =
        "end";


    form.appendChild(
        button
    );


    return button;

}


// =========================================
// ADMIN NOTICE
// =========================================

function addAdminNotice(
    container,
    text,
    isError = false
) {

    const note =
        document.createElement(
            "p"
        );


    note.textContent =
        text;

    note.style.padding =
        "10px 12px";

    note.style.borderRadius =
        "5px";

    note.style.backgroundColor =
        isError
            ? "#FDECEC"
            : "var(--soft-pink)";

    note.style.color =
        isError
            ? "#B42318"
            : "var(--text)";


    container.appendChild(
        note
    );


    return note;

}


// =========================================
// ADMIN SUMMARY CARD
// =========================================

function createAdminSummaryCard(
    titleText,
    valueText
) {

    const card =
        document.createElement(
            "div"
        );


    card.className =
        "event-card";

    card.style.padding =
        "16px 18px";


    const label =
        document.createElement(
            "p"
        );


    label.textContent =
        titleText;

    label.style.margin =
        "0 0 5px";

    label.style.color =
        "var(--muted)";


    const value =
        document.createElement(
            "h3"
        );


    value.textContent =
        String(
            valueText
        );

    value.style.margin =
        "0";

    value.style.fontSize =
        "25px";

    value.style.color =
        "var(--primary-dark)";


    card.append(
        label,
        value
    );


    return card;

}


// =========================================
// LOAD ADMIN PAGE
// =========================================

async function loadAdminPage() {

    if (
        !currentToken ||
        currentUser?.role !== "admin"
    ) {

        displayText(
            adminContent,
            "Please log in with an admin account."
        );

        return;

    }


    displayText(
        adminContent,
        "Loading administration data..."
    );


    adminLoadErrors = {};


    const results =
        await Promise.allSettled([

            adminApiRequest(
                "/users?page=1&limit=100"
            ),

            apiRequest(
                "/events?page=1&limit=100"
            ),

            apiRequest(
                "/venues?page=1&limit=100"
            ),

            adminApiRequest(
                "/bookings?page=1&limit=100"
            )

        ]);


    const names = [
        "users",
        "events",
        "venues",
        "bookings"
    ];


    const arrays = [
        adminUsers,
        adminEvents,
        adminVenues,
        adminBookings
    ];


    results.forEach(
        (result, index) => {

            const key =
                names[index];


            if (
                result.status ===
                    "fulfilled" &&
                Array.isArray(
                    result.value
                )
            ) {

                arrays[index].splice(
                    0,
                    arrays[index].length,
                    ...result.value
                );

            } else {

                adminLoadErrors[key] =

                    result.status ===
                    "rejected"

                        ? result.reason?.message ||
                          "Unable to load data"

                        : "The API returned data in an unexpected format";

            }

        }
    );


    renderAdminDashboard();


    const errorNames =
        Object.keys(
            adminLoadErrors
        );


    if (
        errorNames.length
    ) {

        showMessage(

            "Admin dashboard loaded with a warning. Could not load: " +
            errorNames.join(", ") +
            ". Check the API response if this continues.",

            true

        );

    }

}


// =========================================
// RENDER ADMIN DASHBOARD
// =========================================

function renderAdminDashboard() {

    adminContent.replaceChildren();


    const topRow =
        document.createElement(
            "div"
        );


    topRow.style.display =
        "flex";

    topRow.style.flexWrap =
        "wrap";

    topRow.style.justifyContent =
        "space-between";

    topRow.style.alignItems =
        "center";

    topRow.style.gap =
        "12px";

    topRow.style.marginBottom =
        "16px";


    const title =
        document.createElement(
            "h3"
        );


    title.textContent =
        "Admin Dashboard";

    title.style.margin =
        "0";


    topRow.appendChild(
        title
    );


    topRow.appendChild(

        adminActionButton(
            "Refresh Data",
            () =>
                loadAdminPage()
        )

    );


    adminContent.appendChild(
        topRow
    );


    // =========================================
    // SUMMARY
    // =========================================

    const summary =
        document.createElement(
            "div"
        );


    summary.style.display =
        "grid";

    summary.style.gridTemplateColumns =
        "repeat(auto-fit, minmax(145px, 1fr))";

    summary.style.gap =
        "12px";

    summary.style.marginBottom =
        "22px";


    summary.append(

        createAdminSummaryCard(
            "Users",
            adminUsers.length
        ),

        createAdminSummaryCard(
            "Events",
            adminEvents.length
        ),

        createAdminSummaryCard(
            "Venues",
            adminVenues.length
        ),

        createAdminSummaryCard(
            "Bookings",
            adminBookings.length
        )

    );


    adminContent.appendChild(
        summary
    );


    // =========================================
    // ADMIN TABS
    // =========================================

    const tabs =
        document.createElement(
            "div"
        );


    tabs.style.display =
        "flex";

    tabs.style.flexWrap =
        "wrap";

    tabs.style.gap =
        "8px";

    tabs.style.marginBottom =
        "20px";


    const tabItems = [

        [
            "users",
            "Users"
        ],

        [
            "events",
            "Events"
        ],

        [
            "venues",
            "Venues"
        ],

        [
            "bookings",
            "Bookings"
        ]

    ];


    tabItems.forEach(
        ([key, label]) => {

            const button =
                adminActionButton(

                    label,

                    () => {

                        adminActiveTab =
                            key;


                        if (
                            key !== "events"
                        ) {

                            adminTicketEventId =
                                null;

                        }


                        renderAdminDashboard();

                    }

                );


            if (
                adminActiveTab === key
            ) {

                button.style.backgroundColor =
                    "var(--primary)";

                button.style.borderColor =
                    "var(--primary)";

                button.style.color =
                    "var(--text)";

            }


            tabs.appendChild(
                button
            );

        }
    );


    adminContent.appendChild(
        tabs
    );


    const panel =
        document.createElement(
            "div"
        );


    panel.style.minWidth =
        "0";


    adminContent.appendChild(
        panel
    );


    if (
        adminLoadErrors[
            adminActiveTab
        ]
    ) {

        addAdminNotice(

            panel,

            "Unable to load " +
            adminActiveTab +
            ": " +
            adminLoadErrors[
                adminActiveTab
            ],

            true

        );

    }


    if (
        adminActiveTab ===
        "users"
    ) {

        renderAdminUsersTab(
            panel
        );

    }


    if (
        adminActiveTab ===
        "events"
    ) {

        renderAdminEventsTab(
            panel
        );

    }


    if (
        adminActiveTab ===
        "venues"
    ) {

        renderAdminVenuesTab(
            panel
        );

    }


    if (
        adminActiveTab ===
        "bookings"
    ) {

        renderAdminBookingsTab(
            panel
        );

    }

}

// ---------- ADMIN: USERS ----------

function renderAdminUsersTab(panel) {

    const create = createAdminFormCard(
        "Create User",
        "Create a customer, organiser or admin account."
    );

    addAdminField(create.form, {
        label: "Name",
        name: "name",
        maxLength: 100
    });

    addAdminField(create.form, {
        label: "Email",
        name: "email",
        type: "email",
        maxLength: 150
    });

    addAdminField(create.form, {
        label: "Password",
        name: "password",
        type: "password",
        min: 8,
        maxLength: 72
    });

    addAdminField(create.form, {
        label: "Role",
        name: "role",
        type: "select",
        options: [
            {
                value: "customer",
                label: "Customer"
            },
            {
                value: "organiser",
                label: "Organiser"
            },
            {
                value: "admin",
                label: "Admin"
            }
        ]
    });

    const createButton =
        addAdminSubmit(
            create.form,
            "Create User"
        );


    create.form.addEventListener(
        "submit",
        async event => {

            event.preventDefault();

            const data =
                Object.fromEntries(
                    new FormData(
                        create.form
                    ).entries()
                );

            create.feedback.textContent =
                "";

            createButton.disabled =
                true;

            try {

                await adminJsonRequest(
                    "/users",
                    "POST",
                    {
                        name:
                            data.name.trim(),

                        email:
                            data.email.trim(),

                        password:
                            data.password,

                        role:
                            data.role
                    }
                );

                showMessage(
                    "User created successfully."
                );

                await loadAdminPage();

            } catch (error) {

                create.feedback.textContent =
                    "Unable to create user: " +
                    error.message;

            } finally {

                createButton.disabled =
                    false;

            }
        }
    );


    panel.appendChild(
        create.card
    );


    const editHost =
        document.createElement("div");


    if (
        adminUsers.length === 0
    ) {

        addAdminNotice(
            panel,
            "No users were found."
        );

        panel.appendChild(
            editHost
        );

        return;
    }


    const rows =
        adminUsers.map(user => {

            const actions =
                adminActionGroup([

                    adminActionButton(
                        "Edit",
                        () => {
                            renderAdminUserEditForm(
                                editHost,
                                user
                            );
                        }
                    ),

                    adminActionButton(
                        "Delete",
                        async () => {

                            if (
                                Number(user.id) ===
                                Number(
                                    currentUser?.id
                                )
                            ) {

                                showMessage(
                                    "You cannot delete your own admin account while logged in.",
                                    true
                                );

                                return;
                            }

                            if (
                                !window.confirm(
                                    "Delete user '" +
                                    user.name +
                                    "'?"
                                )
                            ) {
                                return;
                            }

                            try {

                                await adminApiRequest(
                                    "/users/" +
                                    user.id,
                                    {
                                        method:
                                            "DELETE"
                                    }
                                );

                                showMessage(
                                    "User deleted successfully."
                                );

                                await loadAdminPage();

                            } catch (error) {

                                showMessage(
                                    "Unable to delete user: " +
                                    error.message,
                                    true
                                );

                            }
                        },
                        true
                    )

                ]);


            return [
                user.id,
                user.name,
                user.email,
                user.role,
                actions
            ];

        });


    panel.appendChild(
        createTable(
            [
                "ID",
                "Name",
                "Email",
                "Role",
                "Actions"
            ],
            rows
        )
    );


    panel.appendChild(
        editHost
    );

}


// =========================================
// ADMIN - EDIT USER
// =========================================

function renderAdminUserEditForm(
    host,
    user
) {

    host.replaceChildren();


    const edit =
        createAdminFormCard(
            "Edit User: " +
            user.name
        );


    addAdminField(edit.form, {
        label: "Name",
        name: "name",
        value: user.name,
        maxLength: 100
    });


    addAdminField(edit.form, {
        label: "Email",
        name: "email",
        type: "email",
        value: user.email,
        maxLength: 150
    });


    addAdminField(edit.form, {
        label: "Role",
        name: "role",
        type: "select",
        value: user.role,
        options: [
            {
                value: "customer",
                label: "Customer"
            },
            {
                value: "organiser",
                label: "Organiser"
            },
            {
                value: "admin",
                label: "Admin"
            }
        ]
    });


    const save =
        addAdminSubmit(
            edit.form,
            "Save User Changes"
        );


    edit.form.appendChild(
        adminActionButton(
            "Cancel Edit",
            () => {
                host.replaceChildren();
            }
        )
    );


    edit.form.addEventListener(
        "submit",
        async event => {

            event.preventDefault();


            const data =
                Object.fromEntries(
                    new FormData(
                        edit.form
                    ).entries()
                );


            save.disabled =
                true;


            edit.feedback.textContent =
                "Saving user...";


            try {

                await adminJsonRequest(
                    "/users/" +
                    user.id,
                    "PATCH",
                    {
                        name:
                            data.name.trim(),

                        email:
                            data.email.trim(),

                        role:
                            data.role
                    }
                );


                showMessage(
                    "User updated successfully."
                );


                await loadAdminPage();


            } catch (error) {

                edit.feedback.textContent =
                    "Unable to update user: " +
                    error.message;


            } finally {

                save.disabled =
                    false;

            }

        }
    );


    host.appendChild(
        edit.card
    );


    edit.card.scrollIntoView({
        behavior: "smooth",
        block: "nearest"
    });

}


// ---------- ADMIN: VENUES ----------

function renderAdminVenuesTab(panel) {

    const create =
        createAdminFormCard(
            "Create Venue",
            "Add a venue that can be selected when creating events."
        );


    addAdminField(create.form, {
        label: "Venue Name",
        name: "name",
        maxLength: 150
    });


    addAdminField(create.form, {
        label: "Address",
        name: "address",
        maxLength: 255
    });


    addAdminField(create.form, {
        label: "City",
        name: "city",
        maxLength: 100
    });


    addAdminField(create.form, {
        label: "Capacity",
        name: "capacity",
        type: "number",
        min: 1,
        step: 1
    });


    const createButton =
        addAdminSubmit(
            create.form,
            "Create Venue"
        );


    create.form.addEventListener(
        "submit",
        async event => {

            event.preventDefault();


            const data =
                Object.fromEntries(
                    new FormData(
                        create.form
                    ).entries()
                );


            const capacity =
                Number(
                    data.capacity
                );


            if (
                !Number.isSafeInteger(
                    capacity
                ) ||
                capacity < 1
            ) {

                create.feedback.textContent =
                    "Capacity must be a positive whole number.";

                return;
            }


            createButton.disabled =
                true;


            create.feedback.textContent =
                "Creating venue...";


            try {

                await adminJsonRequest(
                    "/venues",
                    "POST",
                    {
                        name:
                            data.name.trim(),

                        address:
                            data.address.trim(),

                        city:
                            data.city.trim(),

                        capacity
                    }
                );


                showMessage(
                    "Venue created successfully."
                );


                await loadAdminPage();


            } catch (error) {

                create.feedback.textContent =
                    "Unable to create venue: " +
                    error.message;


            } finally {

                createButton.disabled =
                    false;

            }

        }
    );


    panel.appendChild(
        create.card
    );


    const editHost =
        document.createElement("div");


    if (
        adminVenues.length === 0
    ) {

        addAdminNotice(
            panel,
            "No venues were found."
        );

        panel.appendChild(
            editHost
        );

        return;
    }


    const rows =
        adminVenues.map(
            venue => {

                const actions =
                    adminActionGroup([

                        adminActionButton(
                            "Edit",
                            () =>
                                renderAdminVenueEditForm(
                                    editHost,
                                    venue
                                )
                        ),

                        adminActionButton(
                            "Delete",
                            async () => {

                                if (
                                    !window.confirm(
                                        "Delete venue '" +
                                        venue.name +
                                        "'? Venues used by events cannot be deleted."
                                    )
                                ) {
                                    return;
                                }


                                try {

                                    await adminApiRequest(
                                        "/venues/" +
                                        venue.id,
                                        {
                                            method:
                                                "DELETE"
                                        }
                                    );


                                    showMessage(
                                        "Venue deleted successfully."
                                    );


                                    await loadAdminPage();


                                } catch (error) {

                                    showMessage(
                                        "Unable to delete venue: " +
                                        error.message,
                                        true
                                    );

                                }

                            },
                            true
                        )

                    ]);


                return [
                    venue.id,
                    venue.name,
                    venue.address,
                    venue.city,
                    venue.capacity,
                    actions
                ];

            }
        );


    panel.appendChild(
        createTable(
            [
                "ID",
                "Venue",
                "Address",
                "City",
                "Capacity",
                "Actions"
            ],
            rows
        )
    );


    panel.appendChild(
        editHost
    );

}


// =========================================
// ADMIN - EDIT VENUE
// =========================================

function renderAdminVenueEditForm(
    host,
    venue
) {

    host.replaceChildren();


    const edit =
        createAdminFormCard(
            "Edit Venue: " +
            venue.name
        );


    addAdminField(edit.form, {
        label: "Venue Name",
        name: "name",
        value: venue.name,
        maxLength: 150
    });


    addAdminField(edit.form, {
        label: "Address",
        name: "address",
        value: venue.address,
        maxLength: 255
    });


    addAdminField(edit.form, {
        label: "City",
        name: "city",
        value: venue.city,
        maxLength: 100
    });


    addAdminField(edit.form, {
        label: "Capacity",
        name: "capacity",
        type: "number",
        value: venue.capacity,
        min: 1,
        step: 1
    });


    const save =
        addAdminSubmit(
            edit.form,
            "Save Venue Changes"
        );


    edit.form.appendChild(
        adminActionButton(
            "Cancel Edit",
            () =>
                host.replaceChildren()
        )
    );


    edit.form.addEventListener(
        "submit",
        async event => {

            event.preventDefault();


            const data =
                Object.fromEntries(
                    new FormData(
                        edit.form
                    ).entries()
                );


            const capacity =
                Number(
                    data.capacity
                );


            if (
                !Number.isSafeInteger(
                    capacity
                ) ||
                capacity < 1
            ) {

                edit.feedback.textContent =
                    "Capacity must be a positive whole number.";

                return;
            }


            save.disabled =
                true;


            edit.feedback.textContent =
                "Saving venue...";


            try {

                await adminJsonRequest(
                    "/venues/" +
                    venue.id,
                    "PUT",
                    {
                        name:
                            data.name.trim(),

                        address:
                            data.address.trim(),

                        city:
                            data.city.trim(),

                        capacity
                    }
                );


                showMessage(
                    "Venue updated successfully."
                );


                await loadAdminPage();


            } catch (error) {

                edit.feedback.textContent =
                    "Unable to update venue: " +
                    error.message;


            } finally {

                save.disabled =
                    false;

            }

        }
    );


    host.appendChild(
        edit.card
    );


    edit.card.scrollIntoView({
        behavior: "smooth",
        block: "nearest"
    });

}


// ---------- ADMIN: EVENTS ----------

function adminVenueOptions() {

    return adminVenues.map(
        venue => ({
            value:
                venue.id,

            label:
                venue.name +
                " — " +
                venue.city
        })
    );

}


function adminOrganiserOptions() {

    return adminUsers
        .filter(
            user =>
                user.role ===
                "organiser"
        )
        .map(
            user => ({
                value:
                    user.id,

                label:
                    user.name +
                    " (#" +
                    user.id +
                    ")"
            })
        );

}


// =========================================
// ADMIN EVENTS TAB
// =========================================

function renderAdminEventsTab(panel) {

    if (
        adminVenues.length === 0 ||
        adminOrganiserOptions().length === 0
    ) {

        addAdminNotice(
            panel,
            "Create at least one venue and one organiser before creating an event."
        );

    }


    const create =
        createAdminFormCard(
            "Create Event",
            "Create an event with its initial standard ticket type."
        );


    addAdminField(create.form, {
        label: "Event Title",
        name: "title",
        maxLength: 200
    });


    addAdminField(create.form, {
        label: "Description",
        name: "description",
        type: "textarea",
        required: false,
        rows: 2
    });


    addAdminField(create.form, {
        label: "Venue",
        name: "venue_id",
        type: "select",
        options:
            adminVenueOptions()
    });


    addAdminField(create.form, {
        label: "Organiser",
        name: "organiser_id",
        type: "select",
        options:
            adminOrganiserOptions()
    });


    addAdminField(create.form, {
        label: "Event Date",
        name: "event_date",
        type: "date"
    });


    addAdminField(create.form, {
        label: "Start Time",
        name: "start_time",
        type: "time"
    });


    addAdminField(create.form, {
        label: "End Time",
        name: "end_time",
        type: "time"
    });


    addAdminField(create.form, {
        label: "Standard Ticket Price (RM)",
        name: "ticket_price",
        type: "number",
        min: 0,
        step: "0.01"
    });


    addAdminField(create.form, {
        label: "Standard Ticket Quantity",
        name: "total_tickets",
        type: "number",
        min: 1,
        step: 1
    });


    const createButton =
        addAdminSubmit(
            create.form,
            "Create Event"
        );


    createButton.disabled =
        adminVenues.length === 0 ||
        adminOrganiserOptions()
            .length === 0;


    create.form.addEventListener(
        "submit",
        async formEvent => {

            formEvent.preventDefault();


            const data =
                Object.fromEntries(
                    new FormData(
                        create.form
                    ).entries()
                );


            const start =
                data.start_time;


            const end =
                data.end_time;


            const price =
                Number(
                    data.ticket_price
                );


            const quantity =
                Number(
                    data.total_tickets
                );


            if (
                !start ||
                !end ||
                end <= start
            ) {

                create.feedback.textContent =
                    "End time must be after start time.";

                return;
            }


            if (
                !Number.isFinite(price) ||
                price < 0 ||
                !Number.isSafeInteger(
                    quantity
                ) ||
                quantity < 1
            ) {

                create.feedback.textContent =
                    "Enter a valid ticket price and a positive whole-number quantity.";

                return;
            }


            const payload = {

                title:
                    data.title.trim(),

                description:
                    String(
                        data.description ||
                        ""
                    ).trim(),

                venue_id:
                    Number(
                        data.venue_id
                    ),

                organiser_id:
                    Number(
                        data.organiser_id
                    ),

                event_date:
                    data.event_date,

                start_time:
                    start,

                end_time:
                    end,

                ticket_price:
                    price,

                total_tickets:
                    quantity

            };


            createButton.disabled =
                true;


            create.feedback.textContent =
                "Creating event...";


            try {

                await adminJsonRequest(
                    "/events",
                    "POST",
                    payload
                );


                showMessage(
                    "Event created successfully."
                );


                await loadAdminPage();

                await loadEvents();


            } catch (error) {

                create.feedback.textContent =
                    "Unable to create event: " +
                    error.message;


            } finally {

                createButton.disabled =
                    false;

            }

        }
    );


    panel.appendChild(
        create.card
    );


    const editHost =
        document.createElement("div");


    const ticketHost =
        document.createElement("div");


    if (
        !adminEvents.length
    ) {

        addAdminNotice(
            panel,
            "No events were found."
        );


        panel.append(
            editHost,
            ticketHost
        );


        return;
    }


    const rows =
        adminEvents.map(
            event => {

                const sold =
                    Number(
                        event.total_tickets
                    ) -
                    Number(
                        event.tickets_available
                    );


                const actions =
                    adminActionGroup([

                        adminActionButton(
                            "Edit",
                            () =>
                                renderAdminEventEditForm(
                                    editHost,
                                    event
                                )
                        ),

                        adminActionButton(
                            "Ticket Types",
                            () => {

                                adminTicketEventId =
                                    Number(
                                        event.id
                                    );


                                renderAdminTicketTypes(
                                    event,
                                    ticketHost
                                );

                            }
                        ),

                        adminActionButton(
                            "Delete",
                            async () => {

                                if (
                                    !window.confirm(
                                        "Delete event '" +
                                        event.title +
                                        "'? This may also remove its booking records and cannot be undone."
                                    )
                                ) {
                                    return;
                                }


                                try {

                                    await adminApiRequest(
                                        "/events/" +
                                        event.id,
                                        {
                                            method:
                                                "DELETE"
                                        }
                                    );


                                    if (
                                        Number(
                                            adminTicketEventId
                                        ) ===
                                        Number(
                                            event.id
                                        )
                                    ) {

                                        adminTicketEventId =
                                            null;

                                    }


                                    showMessage(
                                        "Event deleted successfully."
                                    );


                                    await loadAdminPage();

                                    await loadEvents();


                                } catch (error) {

                                    showMessage(
                                        "Unable to delete event: " +
                                        error.message,
                                        true
                                    );

                                }

                            },
                            true
                        )

                    ]);


                return [

                    event.id,

                    event.title,

                    event.event_date,

                    String(
                        event.start_time ||
                        ""
                    ).slice(
                        0,
                        5
                    ) +
                    "–" +
                    String(
                        event.end_time ||
                        ""
                    ).slice(
                        0,
                        5
                    ),

                    event.venue_name,

                    event.organiser_name,

                    event.status,

                    sold +
                    "/" +
                    event.total_tickets,

                    actions

                ];

            }
        );


    panel.appendChild(
        createTable(
            [
                "ID",
                "Event",
                "Date",
                "Time",
                "Venue",
                "Organiser",
                "Status",
                "Sold / Total",
                "Actions"
            ],
            rows
        )
    );


    panel.append(
        editHost,
        ticketHost
    );


    if (
        adminTicketEventId !==
        null
    ) {

        const activeEvent =
            adminEvents.find(
                event =>
                    Number(
                        event.id
                    ) ===
                    Number(
                        adminTicketEventId
                    )
            );


        if (activeEvent) {

            renderAdminTicketTypes(
                activeEvent,
                ticketHost
            );

        } else {

            adminTicketEventId =
                null;

        }

    }

}


// =========================================
// ADMIN - EDIT EVENT
// =========================================

function renderAdminEventEditForm(
    host,
    eventData
) {

    host.replaceChildren();


    const edit =
        createAdminFormCard(

            "Edit Event: " +
            eventData.title,

            "Ticket price and total quantity are managed in Ticket Types, so they are not edited here."

        );


    addAdminField(edit.form, {
        label: "Event Title",
        name: "title",
        value: eventData.title,
        maxLength: 200
    });


    addAdminField(edit.form, {
        label: "Description",
        name: "description",
        type: "textarea",
        value:
            eventData.description ||
            "",
        required: false,
        rows: 2
    });


    addAdminField(edit.form, {
        label: "Venue",
        name: "venue_id",
        type: "select",
        options:
            adminVenueOptions(),
        value:
            eventData.venue_id
    });


    addAdminField(edit.form, {
        label: "Organiser",
        name: "organiser_id",
        type: "select",
        options:
            adminOrganiserOptions(),
        value:
            eventData.organiser_id
    });


    addAdminField(edit.form, {
        label: "Event Date",
        name: "event_date",
        type: "date",
        value:
            eventData.event_date
    });


    addAdminField(edit.form, {
        label: "Start Time",
        name: "start_time",
        type: "time",
        value:
            String(
                eventData.start_time ||
                ""
            ).slice(
                0,
                5
            )
    });


    addAdminField(edit.form, {
        label: "End Time",
        name: "end_time",
        type: "time",
        value:
            String(
                eventData.end_time ||
                ""
            ).slice(
                0,
                5
            )
    });


    addAdminField(edit.form, {
        label: "Status",
        name: "status",
        type: "select",
        value:
            eventData.status,
        options: [
            {
                value: "upcoming",
                label: "Upcoming"
            },
            {
                value: "cancelled",
                label: "Cancelled"
            },
            {
                value: "completed",
                label: "Completed"
            }
        ]
    });


    const save =
        addAdminSubmit(
            edit.form,
            "Save Event Changes"
        );


    edit.form.appendChild(
        adminActionButton(
            "Cancel Edit",
            () =>
                host.replaceChildren()
        )
    );


    edit.form.addEventListener(
        "submit",
        async submitEvent => {

            submitEvent.preventDefault();


            const data =
                Object.fromEntries(
                    new FormData(
                        edit.form
                    ).entries()
                );


            if (
                !data.start_time ||
                !data.end_time ||
                data.end_time <=
                    data.start_time
            ) {

                edit.feedback.textContent =
                    "End time must be after start time.";

                return;
            }


            if (
                data.status ===
                    "cancelled" &&
                eventData.status !==
                    "cancelled"
            ) {

                const confirmed =
                    window.confirm(
                        "Cancelling this event will also cancel its confirmed bookings. Continue?"
                    );


                if (!confirmed) {
                    return;
                }

            }


            const payload = {

                title:
                    data.title.trim(),

                description:
                    String(
                        data.description ||
                        ""
                    ).trim(),

                venue_id:
                    Number(
                        data.venue_id
                    ),

                organiser_id:
                    Number(
                        data.organiser_id
                    ),

                event_date:
                    data.event_date,

                start_time:
                    data.start_time,

                end_time:
                    data.end_time,

                status:
                    data.status

            };


            save.disabled =
                true;


            edit.feedback.textContent =
                "Saving event...";


            try {

                await adminJsonRequest(
                    "/events/" +
                    eventData.id,
                    "PATCH",
                    payload
                );


                showMessage(
                    "Event updated successfully."
                );


                await loadAdminPage();

                await loadEvents();


            } catch (error) {

                edit.feedback.textContent =
                    "Unable to update event: " +
                    error.message;


            } finally {

                save.disabled =
                    false;

            }

        }
    );


    host.appendChild(
        edit.card
    );


    edit.card.scrollIntoView({
        behavior: "smooth",
        block: "nearest"
    });

}


// =========================================
// ADMIN - TICKET TYPES
// =========================================

async function renderAdminTicketTypes(
    eventData,
    host
) {

    host.replaceChildren();


    const panel =
        document.createElement(
            "div"
        );


    panel.className =
        "form-card";

    panel.style.maxWidth =
        "none";

    panel.style.width =
        "100%";

    panel.style.margin =
        "22px 0";


    const header =
        document.createElement(
            "div"
        );


    header.style.display =
        "flex";

    header.style.flexWrap =
        "wrap";

    header.style.alignItems =
        "center";

    header.style.justifyContent =
        "space-between";

    header.style.gap =
        "10px";


    const title =
        document.createElement(
            "h3"
        );


    title.textContent =
        "Ticket Types — " +
        eventData.title;

    title.style.margin =
        "0";


    const close =
        adminActionButton(
            "Close Ticket Types",
            () => {

                adminTicketEventId =
                    null;

                host.replaceChildren();

            }
        );


    header.append(
        title,
        close
    );


    panel.appendChild(
        header
    );


    const create =
        createAdminFormCard(
            "Add Ticket Type",
            "Only upcoming events can have ticket types changed."
        );


    create.card.style.marginTop =
        "18px";


    addAdminField(create.form, {
        label: "Ticket Type Name",
        name: "name",
        maxLength: 100,
        placeholder: "e.g. VIP"
    });


    addAdminField(create.form, {
        label: "Price (RM)",
        name: "price",
        type: "number",
        min: 0,
        step: "0.01"
    });


    addAdminField(create.form, {
        label: "Quantity",
        name: "quantity",
        type: "number",
        min: 1,
        step: 1
    });


    const addButton =
        addAdminSubmit(
            create.form,
            "Add Ticket Type"
        );


    create.form.addEventListener(
        "submit",
        async formEvent => {

            formEvent.preventDefault();


            const data =
                Object.fromEntries(
                    new FormData(
                        create.form
                    ).entries()
                );


            const price =
                Number(
                    data.price
                );


            const quantity =
                Number(
                    data.quantity
                );


            if (
                !Number.isFinite(
                    price
                ) ||
                price < 0 ||
                !Number.isSafeInteger(
                    quantity
                ) ||
                quantity < 1
            ) {

                create.feedback.textContent =
                    "Enter a non-negative price and a positive whole-number quantity.";

                return;
            }


            addButton.disabled =
                true;


            create.feedback.textContent =
                "Adding ticket type...";


            try {

                await adminJsonRequest(

                    "/events/" +
                    eventData.id +
                    "/ticket-types",

                    "POST",

                    {
                        name:
                            data.name.trim(),

                        price,

                        quantity
                    }

                );


                showMessage(
                    "Ticket type added successfully."
                );


                await loadAdminPage();


            } catch (error) {

                create.feedback.textContent =
                    "Unable to add ticket type: " +
                    error.message;


            } finally {

                addButton.disabled =
                    false;

            }

        }
    );


    panel.appendChild(
        create.card
    );


    const listHost =
        document.createElement(
            "div"
        );


    const editHost =
        document.createElement(
            "div"
        );


    displayText(
        listHost,
        "Loading ticket types..."
    );


    panel.append(
        listHost,
        editHost
    );


    host.appendChild(
        panel
    );


    try {

        const tickets =
            await apiRequest(

                "/events/" +
                eventData.id +
                "/ticket-types?limit=100"

            );


        if (
            !host.contains(
                panel
            )
        ) {

            return;

        }


        listHost.replaceChildren();


        if (
            !Array.isArray(
                tickets
            ) ||
            tickets.length === 0
        ) {

            displayText(
                listHost,
                "No ticket types were found for this event."
            );

            return;
        }


        const rows =
            tickets.map(
                ticket => {

                    const actions =
                        adminActionGroup([

                            adminActionButton(
                                "Edit",
                                () =>
                                    renderAdminTicketTypeEditForm(
                                        editHost,
                                        eventData,
                                        ticket
                                    )
                            ),

                            adminActionButton(
                                "Delete",
                                async () => {

                                    if (
                                        !window.confirm(
                                            "Delete ticket type '" +
                                            ticket.name +
                                            "'? Confirmed bookings prevent deletion."
                                        )
                                    ) {

                                        return;
                                    }


                                    try {

                                        await adminApiRequest(

                                            "/ticket-types/" +
                                            ticket.id,

                                            {
                                                method:
                                                    "DELETE"
                                            }

                                        );


                                        showMessage(
                                            "Ticket type deleted successfully."
                                        );


                                        await loadAdminPage();


                                    } catch (error) {

                                        showMessage(
                                            "Unable to delete ticket type: " +
                                            error.message,
                                            true
                                        );

                                    }

                                },
                                true
                            )

                        ]);


                    return [

                        ticket.id,

                        ticket.name,

                        formatPrice(
                            ticket.price
                        ),

                        ticket.quantity,

                        ticket.sold ??
                            (
                                Number(
                                    ticket.quantity
                                ) -
                                Number(
                                    ticket.quantity_available
                                )
                            ),

                        ticket.quantity_available,

                        actions

                    ];

                }
            );


        listHost.appendChild(

            createTable(

                [
                    "ID",
                    "Ticket Type",
                    "Price",
                    "Total",
                    "Sold",
                    "Available",
                    "Actions"
                ],

                rows

            )

        );


    } catch (error) {

        displayText(
            listHost,
            "Unable to load ticket types: " +
            error.message
        );

    }

}


// =========================================
// ADMIN - EDIT TICKET TYPE
// =========================================

function renderAdminTicketTypeEditForm(
    host,
    eventData,
    ticket
) {

    host.replaceChildren();


    const edit =
        createAdminFormCard(
            "Edit Ticket Type: " +
            ticket.name
        );


    addAdminField(edit.form, {
        label: "Ticket Type Name",
        name: "name",
        value: ticket.name,
        maxLength: 100
    });


    addAdminField(edit.form, {
        label: "Price (RM)",
        name: "price",
        type: "number",
        value: ticket.price,
        min: 0,
        step: "0.01"
    });


    addAdminField(edit.form, {
        label: "Quantity",
        name: "quantity",
        type: "number",
        value: ticket.quantity,
        min: 1,
        step: 1
    });


    const save =
        addAdminSubmit(
            edit.form,
            "Save Ticket Type"
        );


    edit.form.appendChild(
        adminActionButton(
            "Cancel Edit",
            () =>
                host.replaceChildren()
        )
    );


    edit.form.addEventListener(
        "submit",
        async event => {

            event.preventDefault();


            const data =
                Object.fromEntries(
                    new FormData(
                        edit.form
                    ).entries()
                );


            const price =
                Number(
                    data.price
                );


            const quantity =
                Number(
                    data.quantity
                );


            if (
                !Number.isFinite(
                    price
                ) ||
                price < 0 ||
                !Number.isSafeInteger(
                    quantity
                ) ||
                quantity < 1
            ) {

                edit.feedback.textContent =
                    "Enter a non-negative price and a positive whole-number quantity.";

                return;
            }


            save.disabled =
                true;


            edit.feedback.textContent =
                "Saving ticket type...";


            try {

                await adminJsonRequest(

                    "/ticket-types/" +
                    ticket.id,

                    "PUT",

                    {
                        name:
                            data.name.trim(),

                        price,

                        quantity
                    }

                );


                showMessage(
                    "Ticket type updated successfully."
                );


                await loadAdminPage();


            } catch (error) {

                edit.feedback.textContent =
                    "Unable to update ticket type: " +
                    error.message;


            } finally {

                save.disabled =
                    false;

            }

        }
    );


    host.appendChild(
        edit.card
    );

}


// ---------- ADMIN: BOOKINGS ----------

function renderAdminBookingsTab(panel) {

    const filters =
        document.createElement(
            "div"
        );


    filters.style.display =
        "grid";

    filters.style.gridTemplateColumns =
        "repeat(auto-fit, minmax(190px, 1fr))";

    filters.style.gap =
        "10px";

    filters.style.marginBottom =
        "14px";


    const search =
        document.createElement(
            "input"
        );


    search.type =
        "search";

    search.placeholder =
        "Search event, customer or ticket";

    search.setAttribute(
        "aria-label",
        "Search bookings"
    );

    search.style.width =
        "100%";

    search.style.padding =
        "10px";

    search.style.border =
        "1px solid var(--border)";

    search.style.borderRadius =
        "5px";


    const statusFilter =
        document.createElement(
            "select"
        );


    statusFilter.setAttribute(
        "aria-label",
        "Filter bookings by status"
    );

    statusFilter.style.padding =
        "10px";

    statusFilter.style.border =
        "1px solid var(--border)";

    statusFilter.style.borderRadius =
        "5px";


    [
        ["", "All statuses"],
        ["confirmed", "Confirmed"],
        ["cancelled", "Cancelled"]
    ].forEach(
        ([value, label]) => {

            const option =
                document.createElement(
                    "option"
                );

            option.value =
                value;

            option.textContent =
                label;

            statusFilter.appendChild(
                option
            );

        }
    );


    const eventFilter =
        document.createElement(
            "select"
        );


    eventFilter.setAttribute(
        "aria-label",
        "Filter bookings by event"
    );

    eventFilter.style.padding =
        "10px";

    eventFilter.style.border =
        "1px solid var(--border)";

    eventFilter.style.borderRadius =
        "5px";


    [
        ["", "All events"],
        ...adminEvents.map(
            item => [
                String(item.id),
                item.title
            ]
        )
    ].forEach(
        ([value, label]) => {

            const option =
                document.createElement(
                    "option"
                );

            option.value =
                value;

            option.textContent =
                label;

            eventFilter.appendChild(
                option
            );

        }
    );


    const customerFilter =
        document.createElement(
            "select"
        );


    customerFilter.setAttribute(
        "aria-label",
        "Filter bookings by customer"
    );

    customerFilter.style.padding =
        "10px";

    customerFilter.style.border =
        "1px solid var(--border)";

    customerFilter.style.borderRadius =
        "5px";


    const customers =
        adminUsers.filter(
            user =>
                user.role ===
                "customer"
        );


    [
        ["", "All customers"],

        ...customers.map(
            user => [

                String(
                    user.id
                ),

                user.name +
                " (#" +
                user.id +
                ")"

            ]
        )

    ].forEach(
        ([value, label]) => {

            const option =
                document.createElement(
                    "option"
                );

            option.value =
                value;

            option.textContent =
                label;

            customerFilter.appendChild(
                option
            );

        }
    );


    filters.append(
        search,
        statusFilter,
        eventFilter,
        customerFilter
    );


    panel.appendChild(
        filters
    );


    const tableHost =
        document.createElement(
            "div"
        );


    panel.appendChild(
        tableHost
    );


    function paintBookings() {

        const query =
            search.value
                .trim()
                .toLowerCase();


        const status =
            statusFilter.value;


        const eventId =
            eventFilter.value;


        const customerId =
            customerFilter.value;


        const filtered =
            adminBookings.filter(
                booking => {

                    const searchText = [

                        booking.event_title,

                        booking.customer_name,

                        booking.ticket_type_name,

                        booking.id,

                        booking.booked_at

                    ]
                        .join(" ")
                        .toLowerCase();


                    return (

                        (
                            !query ||
                            searchText.includes(
                                query
                            )
                        ) &&

                        (
                            !status ||
                            booking.status ===
                                status
                        ) &&

                        (
                            !eventId ||
                            String(
                                booking.event_id
                            ) ===
                                eventId
                        ) &&

                        (
                            !customerId ||
                            String(
                                booking.customer_id
                            ) ===
                                customerId
                        )

                    );

                }
            );


        tableHost.replaceChildren();


        if (
            !filtered.length
        ) {

            displayText(
                tableHost,
                "No bookings match the selected filter."
            );

            return;
        }


        const rows =
            filtered.map(
                booking => {

                    const actions =
                        [];


                    if (
                        booking.status ===
                            "confirmed" &&
                        booking.event_status ===
                            "upcoming"
                    ) {

                        actions.push(

                            adminActionButton(
                                "Edit Qty",
                                async () => {

                                    const answer =
                                        window.prompt(

                                            "Enter the new ticket quantity for booking #" +
                                            booking.id +
                                            ".",

                                            String(
                                                booking.quantity
                                            )

                                        );


                                    if (
                                        answer ===
                                        null
                                    ) {
                                        return;
                                    }


                                    const quantity =
                                        Number(
                                            answer
                                        );


                                    if (
                                        !Number.isSafeInteger(
                                            quantity
                                        ) ||
                                        quantity < 1
                                    ) {

                                        showMessage(
                                            "Quantity must be a positive whole number.",
                                            true
                                        );

                                        return;
                                    }


                                    try {

                                        await adminJsonRequest(

                                            "/bookings/" +
                                            booking.id,

                                            "PATCH",

                                            {
                                                quantity
                                            }

                                        );


                                        showMessage(
                                            "Booking quantity updated successfully."
                                        );


                                        await loadAdminPage();


                                    } catch (error) {

                                        showMessage(
                                            "Unable to update booking: " +
                                            error.message,
                                            true
                                        );

                                    }

                                }
                            )

                        );

                    }


                    if (
                        booking.status ===
                            "confirmed" &&
                        booking.event_status !==
                            "completed"
                    ) {

                        actions.push(

                            adminActionButton(
                                "Cancel",
                                async () => {

                                    if (
                                        !window.confirm(
                                            "Cancel booking #" +
                                            booking.id +
                                            "? The tickets will be returned to availability."
                                        )
                                    ) {
                                        return;
                                    }


                                    try {

                                        await adminJsonRequest(

                                            "/bookings/" +
                                            booking.id,

                                            "PATCH",

                                            {
                                                status:
                                                    "cancelled"
                                            }

                                        );


                                        showMessage(
                                            "Booking cancelled successfully."
                                        );


                                        await loadAdminPage();


                                    } catch (error) {

                                        showMessage(
                                            "Unable to cancel booking: " +
                                            error.message,
                                            true
                                        );

                                    }

                                },
                                true
                            )

                        );

                    }


                    actions.push(

                        adminActionButton(
                            "Delete",
                            async () => {

                                if (
                                    !window.confirm(
                                        "Permanently delete booking #" +
                                        booking.id +
                                        "? This cannot be undone."
                                    )
                                ) {
                                    return;
                                }


                                try {

                                    await adminApiRequest(

                                        "/bookings/" +
                                        booking.id,

                                        {
                                            method:
                                                "DELETE"
                                        }

                                    );


                                    showMessage(
                                        "Booking deleted successfully."
                                    );


                                    await loadAdminPage();


                                } catch (error) {

                                    showMessage(
                                        "Unable to delete booking: " +
                                        error.message,
                                        true
                                    );

                                }

                            },
                            true
                        )

                    );


                    return [

                        booking.id,

                        booking.event_title,

                        booking.event_date,

                        booking.customer_name +
                        " (#" +
                        booking.customer_id +
                        ")",

                        booking.ticket_type_name ||
                            "-",

                        booking.quantity,

                        formatPrice(
                            booking.total_price
                        ),

                        booking.status,

                        booking.booked_at ||
                            "-",

                        adminActionGroup(
                            actions
                        )

                    ];

                }
            );


        tableHost.appendChild(

            createTable(

                [
                    "ID",
                    "Event",
                    "Event Date",
                    "Customer",
                    "Ticket Type",
                    "Qty",
                    "Total",
                    "Status",
                    "Booked At",
                    "Actions"
                ],

                rows

            )

        );

    }


    search.addEventListener(
        "input",
        paintBookings
    );


    statusFilter.addEventListener(
        "change",
        paintBookings
    );


    eventFilter.addEventListener(
        "change",
        paintBookings
    );


    customerFilter.addEventListener(
        "change",
        paintBookings
    );


    paintBookings();

}


// =========================================
// INITIAL PAGE LOAD
// =========================================

updateNavigation();

showPage(
    "events"
);

loadEvents();