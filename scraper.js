require('dotenv').config();
const puppeteer = require("puppeteer");
const cron = require("node-cron");
const { writeFileSync, readFileSync, existsSync } = require("fs");

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
    if(browserInstance !== undefined)
        return
    
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
    const browser = await puppeteer.connect({ browserWSEndpoint: browserEndpoint });

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
    await page.close();
    browser.disconnect();

    return realRefuges;
};

async function getAvailableDates(refugeUrl) {
    console.log("Starting getAvailableDates process");
    // Connect to browser instance
    const browser = await puppeteer.connect({ browserWSEndpoint: browserEndpoint });

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
        // Convert to numbers since JSON can't serialise cyclical references in DOM nodes
        newDates = [...Array(newDates.length).keys()]

        // Add available dates from this month to the total
        availableDates = availableDates.concat(newDates)

        // Go to next month
        await page.waitForSelector(nextMonthSelector)
        var nextMonthButton = await page.$(nextMonthSelector)
        await page.evaluate(e => e.click(), nextMonthButton);
    }

    // Close tab to avoid memory leaks
    await page.close();
    browser.disconnect();

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

    // Write refuge availabilities to JSON file (if there are any new changes)
    var previousAvailabilities = existsSync("./data/refuges.json") ?
        JSON.parse(readFileSync("./data/refuges.json")) :
        {}

    if(JSON.stringify(refugeAvailabilities) !== JSON.stringify(previousAvailabilities))
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
    capitalise,
    initialiseBrowser,
    writeAvailabilitiesToJson
}
