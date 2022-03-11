require('dotenv').config();
const puppeteer = require("puppeteer");
const cron = require("node-cron");
const { writeFileSync, readFileSync, existsSync, mkdirSync } = require("fs");

const { BDX_REFUGES_URL, DATA_DIR_PATH, DATA_FILE_NAME, MONTHS_TO_NUMS } = require("./constants");

var browserInstance;
var browserEndpoint;

// MAKE THIS A CLASS PLEASE, WOULD BE MORE ELEGANT!
// MAKE THIS A CLASS PLEASE, WOULD BE MORE ELEGANT!
// MAKE THIS A CLASS PLEASE, WOULD BE MORE ELEGANT!
// MAKE THIS A CLASS PLEASE, WOULD BE MORE ELEGANT!
// MAKE THIS A CLASS PLEASE, WOULD BE MORE ELEGANT!


// Does this browser instance time out? Maybe we should create a new browser instance every 30 minutes in sync with the cron job?
async function initialiseBrowser() {
    browserInstance = await puppeteer.launch({
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--single-process",
          "--no-zygote"
        ]
      });

    // Store browser endpoint to be able to reconnect later
    browserEndpoint = browserInstance.wsEndpoint();
    browserInstance.disconnect();
}

async function closeBrowser() {
    if(browserInstance === undefined)
        return

    browserInstance.close();
}

async function findRefuges() {
    console.log("Starting Bordeaux Refuges scraping process");
    // Connect to browser instance
    const browser = await puppeteer.connect({ browserWSEndpoint: browserEndpoint });
    // console.log("Successfully connected to browser!!");

    // Open new tab
    const page = await browser.newPage();
    // console.log("Successfully opened new page!!");

    // Go to one.com login page
    await page.goto(BDX_REFUGES_URL);
    // console.log("Successfully went to refuges Bordeaux website!!");

    // Wait for refuges to load
    var allRefugesSelector = "[class*='colonne-1 field--type-image'] a, [class*='colonne-2 field--type-image'] a, [class*='colonne-3 field--type-image'] a";
    var fakeRefugesSelector = "a[href*='les-refuges']";
    await page.waitForSelector(allRefugesSelector);
    await page.waitForSelector(fakeRefugesSelector);
    // console.log("Successfully waited for selectors!!");
    
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

    // console.log(`Real refuges found: ${realRefuges.length}`)

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

    var daySelector = ".opened[data-handler='selectDay'] a"
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

        var currentMonth = await page.$(".ui-datepicker-month")
        currentMonth = await currentMonth.evaluate(el => el.innerText);
        currentMonth = MONTHS_TO_NUMS[currentMonth];
        
        var newDates = await page.$$(daySelector);
        newDates = await Promise.all(newDates.map(dayElem => dayElem.evaluate(el => el.innerText)))
        newDates = newDates.map(day => ({ day: day, month: currentMonth }))

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

// TODO: READ RESERVATION DETAILS FROM JSON IN THIS FUNCTION? OR SHOULD THE FUNCTION CALLING makeReservation (would probably be writeAvailabilitiesJson cron job I guess?) READ THE JSON FILE BEFORE HAND
async function makeReservation(refugeUrl, wantedDate, reservationDetails) {
    // Connect to browser
    const browser = await puppeteer.connect({ browserWSEndpoint: browserEndpoint });

    // Go to URL
    const page = await browser.newPage();  
    await page.goto(refugeUrl);

    // Select day
    var daySelector = `.opened[data-handler='selectDay'][data-date='${wantedDate}']`;
    await page.waitForSelector(daySelector);
    var dayElement = await page.$(daySelector)
    await page.evaluate(e => e.click(), dayElement);

    // Click page suivante
    await page.waitForSelector("#edit-wizard-next");
    await page.click("#edit-wizard-next");

    // Select number of guests
    await page.waitForSelector("#edit-nombre-d-accompagnants");
    await page.select("#edit-nombre-d-accompagnants", reservationDetails.numGuests);
    await page.waitForTimeout(1000)

    // Select gender
    var gender = reservationDetails.gender
    await page.waitForSelector("#edit-civilite-mme");
    await page.click("#edit-civilite-mme");

    // Input last name
    await page.waitForSelector("#edit-nom");
    await page.type("#edit-nom", reservationDetails.lastName, { delay: 30 });

    // Input first name
    await page.waitForSelector("#edit-prenom");
    await page.type("#edit-prenom", reservationDetails.firstName, { delay: 30 });

    // Input phone number
    await page.waitForSelector("#edit-telephone");
    await page.type("#edit-telephone", reservationDetails.phone, { delay: 30 });

    // Input email
    await page.waitForSelector("#edit-email");
    await page.type("#edit-email", reservationDetails.email, { delay: 30 });

    // Input postal code
    await page.waitForSelector("#edit-code-postal");
    await page.type("#edit-code-postal", reservationDetails.postalCode, { delay: 30 });

    // Input date of birth
    await page.waitForSelector("#edit-date-de-naissance");
    await page.type("#edit-date-de-naissance", reservationDetails.birthday.day, { delay: 30 });
    await page.focus("#edit-date-de-naissance", { delay: 300 });
    await page.type("#edit-date-de-naissance", reservationDetails.birthday.month, { delay: 30 });
    await page.focus("#edit-date-de-naissance", { delay: 300 });
    await page.type("#edit-date-de-naissance", reservationDetails.birthday.year, { delay: 30 });

    // Accept general terms and conditions
    await page.waitForSelector("#edit-cgu");
    await page.click("#edit-cgu");

    // Accept GDPR conditions
    await page.waitForSelector("#edit-rgpd-consentement");
    await page.click("#edit-rgpd-consentement");

    // Submit form
    await page.waitForSelector("#edit-submit");
    await page.click("#edit-submit");

    // Wait for new page to load
    await page.waitForSelector("#demande-caution-cheque-form");

    // Save URL to send it to bot
    // TODO: ALTERNATIVELY, WE COULD DIRECTLY CLICK ON "CHEQUE" AND SECURE THE RESERVATION INSTANTLY
    var url = await page.url();

    // Close tab to avoid memory leaks
    await page.close();
    browser.disconnect();

    return url;
}

function capitalise(string) {
    return string.charAt(0).toUpperCase() + string.slice(1)
}

function arrayIsEqual(array1, array2) {
    if (array1 === array2) return true;
    if (array1 == null || array2 == null) return false;
    if(array1.length !== array2.length) return false

    return array1.every((element, index) => array2.includes(element));
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
    // Read previous availabilities (if available)
    var previousAvailabilities;
    if (!existsSync(DATA_DIR_PATH)) {
        console.log("writeAvailabilitiesToJson: folder does not exist!")
        mkdirSync(DATA_DIR_PATH);
        writeFileSync(`${DATA_DIR_PATH}/${DATA_FILE_NAME}`, JSON.stringify({}))
        previousAvailabilities = {};
    } else {
        console.log("writeAvailabilitiesToJson: folder exists!")
        previousAvailabilities = JSON.parse(readFileSync(`${DATA_DIR_PATH}/${DATA_FILE_NAME}`));
    }

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

    // TODO: IF (in JSON) availableDates === wantedDates call makeReservation

    // Close browser
    await closeBrowser();

    // Map-loop over previousAvailablities, extract availablesDates from each JSON entry and convert hasNewChanges to true as soon as a new value is found
    var hasNewChanges = false;
    for (const refuge in refugeAvailabilities) {
        if(previousAvailabilities[refuge] === undefined)
            previousAvailabilities[refuge] = {};
            
        if(!arrayIsEqual(refugeAvailabilities[refuge], previousAvailabilities[refuge].availableDates)) {
            console.log("Unequal for " + refuge + ": refugeAvailablities has " + refugeAvailabilities[refuge] + " and prevAvailabilities has: " + previousAvailabilities[refuge].availableDates)
            previousAvailabilities[refuge].availableDates = refugeAvailabilities[refuge]
            hasNewChanges = true;
        }
    }
    
    
    // Write refuge availabilities to JSON file (if there are any new changes)
    // hasNewChanges = JSON.stringify(refugeAvailabilities) !== JSON.stringify(previousAvailabilities);
    if(hasNewChanges)
        writeFileSync(`${DATA_DIR_PATH}/${DATA_FILE_NAME}`, JSON.stringify(previousAvailabilities));
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
    capitalise,
    initialiseBrowser,
    writeAvailabilitiesToJson,
    makeReservation
}
