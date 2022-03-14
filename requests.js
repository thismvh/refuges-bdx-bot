const http = require("http");
const { PORT, API_PATH_BASE } = require("./constants");

const port = process.env.PORT || 3000

// Send POST request for refuge to be saved in database
// TODO: instead of saving the whole thing, look into updating each record (i.e. ONLY update availableDates OR wantedDates,
// depending on which script we're in. bot changes wantedDates, scrapter changes availableDates)
async function saveRefuge(data) {
var postData = JSON.stringify(data);

var options = {
    hostname: process.env.SERVER_URL,
    path: `${API_PATH_BASE}/refuges`,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    json: true,
    body: postData
};

var req = http.request(options, (res) => {
    var body = "";
    console.log("statusCode:", res.statusCode);
    console.log("headers:", res.headers);

    res.on("data", (chunk) => { body += chunk });
    res.on("end", () => console.log("body is: " + body))
    });

    req.on("error", (e) => {
        console.error(e);
    });

    req.write(postData);
    req.end();

    return req;
}

async function updateRefuge(data, name) {
    var update = JSON.stringify(data);

    var options = {
        hostname: process.env.SERVER_URL,
        path: `${API_PATH_BASE}/refuges/${name}`,
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        json: true,
        body: update
    };

    var req = http.request(options, (res) => {
        var body = "";
        console.log("statusCode:", res.statusCode);
        console.log("headers:", res.headers);

        res.on("data", (chunk) => { body += chunk });
        res.on("end", () => console.log("body is: " + body))
    });

    req.on("error", (e) => {
        console.error(e);
    });

    req.write(update);
    req.end();

    return req;
}

async function saveReservation(data) {
    var postData = JSON.stringify(data);
    
    var options = {
        hostname: process.env.SERVER_URL,
        path: `${API_PATH_BASE}/reservation`,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        json: true,
        body: postData
    };
    
    var req = http.request(options, (res) => {
        var body = "";
        console.log("statusCode:", res.statusCode);
        console.log("headers:", res.headers);

        res.on("data", (chunk) => { body += chunk });
        res.on("end", () => console.log("body is: " + body))
    });
    
    req.on("error", (e) => {
        console.error(e);
    });

    req.write(postData);
    req.end();

    return req;
}

module.exports = {
    saveRefuge,
    updateRefuge,
    saveReservation
}