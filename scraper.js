require('dotenv').config();
const puppeteer = require("puppeteer");
const cron = require("node-cron");
const { writeFileSync } = require("fs");

var browserInstance;
var browserEndpoint;

var trackedRefuges = new Set();

const DEV_MODE = process.env.DEV_MODE;
var timesCalled = 0;

const BDX_REFUGES_URL = "https://lesrefuges.bordeaux-metropole.fr";

// MAKE THIS A CLASS PLEASE, WOULD BE MORE ELEGANT!
// MAKE THIS A CLASS PLEASE, WOULD BE MORE ELEGANT!
// MAKE THIS A CLASS PLEASE, WOULD BE MORE ELEGANT!
// MAKE THIS A CLASS PLEASE, WOULD BE MORE ELEGANT!
// MAKE THIS A CLASS PLEASE, WOULD BE MORE ELEGANT!


// Does this browser instance time out? Maybe we should create a new browser instance every 30 minutes in sync with the cron job?
async function initialiseBrowser() {
    browserInstance = await puppeteer.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });

    // Store browser endpoint to be able to reconnect later
    browserEndpoint = browserInstance.wsEndpoint();
    browserInstance.disconnect();
}

async function findRefuges() {
    console.log("Starting Bordeaux Refuges scraping process");
    // Connect to browser instance
    const browser = await puppeteer.connect({ browserWSEndpoint: browserEndpoint })

    // Open new tab
    const page = await browser.newPage();

    // Go to one.com login page
    await page.goto(BDX_REFUGES_URL);

    // Wait for refuges to load
    // Use DOMRegex after all?
    var allRefugesSelector = "[class*='colonne-1 field--type-image'] a, [class*='colonne-2 field--type-image'] a, [class*='colonne-3 field--type-image'] a";
    var fakeRefugesSelector = "a[href*='les-refuges']";
    await page.waitForSelector(allRefugesSelector);
    await page.waitForSelector(fakeRefugesSelector);
    
    // Get list of all refuges
    var allRefuges = await getRefuges(page, allRefugesSelector);
    var fakeRefuges = await getRefuges(page, fakeRefugesSelector);
    var realRefuges = allRefuges.filter(refuge => !fakeRefuges.map(ref => ref.name).includes(refuge.name));

    realRefuges = realRefuges.map(refuge => (
        {
            name: refuge.name.toLowerCase().split(/[-\s]/).map(x => capitalise(x)).join(" "),
            url: refuge.url,
            urlShort: refuge.urlShort,
            img: refuge.img
        }
    ))

    // Close tab to avoid memory leaks
    page.close();

    return realRefuges;
};

async function periodicDateCheck(refugeUrl) {
    // Avoid starting multiple cron jobs for the same refuge
    if(trackedRefuges.has(refugeUrl)) {
        setImmediate(() => dateNotifier.emit("knownRefuge"))
    } else {
        // Search for availale dates instantly without cron job to give first instant feedback to user
        var availableDates = await getAvailableDates(refugeUrl);
        console.log("Gonna dispatch event now, availableDates has length: " + availableDates.length)
        if (availableDates.length < 1) 
            setImmediate(() => dateNotifier.emit("noDates"))  // Have to wrap it in setImmediate to make it an async call   
        else
            setImmediate(() => dateNotifier.emit("yesDates")) // Have to wrap it in setImmediate to make it an async call
        
        // For future iterations: note that current refuge has hereby been seen
        trackedRefuges.add(refugeUrl);

        // Search for availableDates every 30 seconds
        // every 4 hours: 0 */4 * * *
        // every 4 hours between April and November: 0 */4 * 4-11 *
        cron.schedule("1 */1 * 3-11 *", async () => {
            console.log("Testing cron job, current URL is: " + refugeUrl);

            availableDates = await getAvailableDates(refugeUrl)

            if (availableDates.length < 1) 
                dateNotifier.emit("noDates");  // No need to wrap it in setImmediate because cron job itself is an async call
            else
                dateNotifier.emit("yesDates"); // No need to wrap it in setImmediate because cron job itself is an async call
        });
    }
}

async function getAvailableDates(refugeUrl) {
    console.log("Starting getAvailableDates process");
    // Connect to browser instance
    const browser = await puppeteer.connect({ browserWSEndpoint: browserEndpoint })

    // Open new tab
    const page = await browser.newPage();

    // Go to one.com login page
    await page.goto(refugeUrl);

    await page.waitForSelector(".hasDatepicker")

    var daySelector = ".opened[data-handler='selectDay']"
    // var daySelector = "[data-handler='selectDay']"
    // var daySelector = ".ui-state-default";
    var nextMonthSelector = "[data-handler='next']"
    var availableDates = [];
    var monthsInAdvance = 5;
    for (let index = 0; index < [...Array(monthsInAdvance).keys()].length; index++) {
        console.log(refugeUrl + ": availableDates has length " + availableDates.length)
        // Get available dates of current month
        try {
            await page.waitForSelector(daySelector, { timeout: 1000 })
        } catch (error) {
            return availableDates
        }
        
        var newDates = await page.$$(daySelector)

        // Add available dates from this month to the total
        availableDates = availableDates.concat(newDates)

        // Go to next month
        await page.waitForSelector(nextMonthSelector)
        var nextMonthButton = await page.$(nextMonthSelector)
        await page.evaluate(e => e.click(), nextMonthButton);
    }

    // Close tab to avoid memory leaks
    page.close();

    return availableDates;
}

async function getAvailableDatesDummy(refugeUrl) {
    cron.schedule("*/2 * * * * *", () => {
        console.log("Testing cron job, current URL is: " + refugeUrl);
        if (timesCalled < 3) {
            console.log("timesCalled is: "  + timesCalled)
            timesCalled++
            dateNotifier.emit("yesDates");
        }
        else {
            timesCalled = 0;
            dateNotifier.emit("noDates");
        }
    });

    return dateNotifier;
}

function capitalise(string) {
    return string.charAt(0).toUpperCase() + string.slice(1)
}

function getRefuges(page, selector) {
    return page.evaluate((sel) => {
        let elements = Array.from(document.querySelectorAll(sel));
        let refuges = elements.map(element => {
            return { 
                name:  element.href.replace(/^(?:\/\/|[^/]+)*\//, ''),
                url: element.href,
                urlShort: element.href.replace(/^(?:\/\/|[^/]+)*\//, ''),
                img: element.childNodes[0].src
            }
        })
        return refuges;
    }, selector);
};

async function writeAvailabilitiesToJson() {
    // Refuge data that will be saved in JSON
    var refugeAvailabilities = {};

    // Initialise browser
    await initialiseBrowser(); 

    // Get all refuges
    var allRefuges = await findRefuges();

    // Get availabilities for each refuges
    for (const refuge of allRefuges) {
        var availiableDates = await getAvailableDates(refuge.url);
        refugeAvailabilities[refuge.urlShort] = availiableDates;
    }

    // Write refuge availabilities to JSON file
    writeFileSync("./data/refuges.json", JSON.stringify(refugeAvailabilities));
}

// Ping heroku app every 20 minutes to prevent it from idling
var http = require("http");
setInterval(() => {
  console.log("Pinging Heroku from scraper now...")
  http.get(process.env.BOT_DOMAIN)
}, 20 * 60 * 1000);

cron.schedule("* * * * *", () => {
    console.log("Writing availabilities to JSON now...");
    writeAvailabilitiesToJson();
})

module.exports = {
    findRefuges,
    getAvailableDates,
    getAvailableDatesDummy,
    periodicDateCheck,
    capitalise,
    initialiseBrowser,
    dateNotifier,
    writeAvailabilitiesToJson
}
