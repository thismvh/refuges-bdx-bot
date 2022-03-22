const http = require("http");
const { API_PATH_BASE } = require("./constants");

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
        // console.log("statusCode:", res.statusCode);

        res.on("data", (chunk) => { body += chunk });
        res.on("end", () => body)
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

        res.on("data", (chunk) => { body += chunk });
        res.on("end", () => body)
    });
    
    req.on("error", (e) => {
        console.error(e);
    });

    req.write(postData);
    req.end();

    return req;
}

module.exports = {
    updateRefuge,
    saveReservation
}