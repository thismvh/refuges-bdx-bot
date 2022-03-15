require('dotenv').config();
const puppeteer = require("puppeteer");
const cron = require("node-cron");
const { updateRefuge } = require('./requests');
const { capitalise, splitDateString } = require("./helpers")

const { BDX_REFUGES_URL, MONTHS_TO_NUMS, API_PATH_BASE } = require("./constants");

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
    var browser, page;
    var realRefuges = []
    try {
        // Connect to browser instance
        browser = await puppeteer.connect({ browserWSEndpoint: browserEndpoint });
        console.log("Successfully connected to browser!!");

        // Open new tab
        const page = await browser.newPage();
        console.log("Successfully opened new page!!");

        // Go to Refuges home page
        await page.goto(BDX_REFUGES_URL);
        console.log("Successfully went to refuges Bordeaux website!!");

        // Wait for refuges to load
        var allRefugesSelector = "[class*='colonne-1 field--type-image'] a, [class*='colonne-2 field--type-image'] a, [class*='colonne-3 field--type-image'] a";
        var fakeRefugesSelector = "a[href*='les-refuges']";
        await page.waitForSelector(allRefugesSelector);
        await page.waitForSelector(fakeRefugesSelector);
        console.log("Successfully waited for selectors!!");

        // Get list of all refuges
        var allRefuges = await getRefuges(page, allRefugesSelector);
        var fakeRefuges = await getRefuges(page, fakeRefugesSelector);
        realRefuges = allRefuges.filter(refuge => !fakeRefuges.map(ref => ref.name).includes(refuge.name));

        realRefuges = realRefuges.map(refuge => (
            {
                name: refuge.name.toLowerCase().split(/[-\s]/).map(x => capitalise(x)).join(" "),
                url: refuge.url,
                urlShort: refuge.urlShort,
                img: refuge.img
            }
        ))
    } catch (err) {
        console.log(err)
    } finally {
        // Close tab to avoid memory leaks
        if(page !== undefined) await page.close();
        if(browser !== undefined) browser.disconnect();

        return realRefuges;
    }
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
        currentMonth = await currentMonth.evaluate(el => el.innerText.toLowerCase());
        currentMonth = MONTHS_TO_NUMS[currentMonth];
        
        var newDates = await page.$$(daySelector);
        newDates = await Promise.all(newDates.map(dayElem => dayElem.evaluate(el => el.innerText)))
        newDates = newDates.map(day => `${day}.${currentMonth}`)

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
    console.log("Starting makeReservation process...")
    // Connect to browser
    const browser = await puppeteer.connect({ browserWSEndpoint: browserEndpoint });
    console.log("Successfully connected to browser!")

    // Go to URL
    const page = await browser.newPage(); 
    console.log("Successfully opened a new page!") 
    await page.goto(refugeUrl);
    console.log("Successfully went to URL!")

    var nextMonthSelector = "[data-handler='next']"
    var currentMonth;
    var isCorrectMonth = false
    wantedDate = splitDateString(wantedDate);
    while(!isCorrectMonth) {
        console.log(`currentMonth is: ${currentMonth}`)
        // Update current month
        currentMonth = await page.$(".ui-datepicker-month")
        currentMonth = await currentMonth.evaluate(el => el.innerText.toLowerCase());
        currentMonth = MONTHS_TO_NUMS[currentMonth];

        if(currentMonth === wantedDate.month) {
            isCorrectMonth = true
            break
        }

        // Go to next month
        await page.waitForSelector(nextMonthSelector)
        var nextMonthButton = await page.$(nextMonthSelector)
        await page.evaluate(e => e.click(), nextMonthButton);

        if(currentMonth === wantedDate.month) isCorrectMonth = true
    }
    console.log(`Arrived at correct month, which is: ${currentMonth} and should be ${wantedDate.month}`)

    // Select day
    var daySelector = `.opened[data-handler='selectDay'] [data-date='${wantedDate.day}']`;
    console.log(`makeReservation: daySelector is: ${daySelector}`)
    try {
        await page.waitForSelector(daySelector, { timeout: 1000 })
    } catch (err){
        console.log("makeReservation: no available dates were found!")
        console.log(err)
        return null
    }
    var dayElement = await page.$(daySelector)
    await page.evaluate(e => e.click(), dayElement);
    console.log("Successfully clicked available day!")

    // Click page suivante
    await page.waitForSelector("#edit-wizard-next");
    await page.click("#edit-wizard-next");
    console.log("Successfully clicked to start the form!")

    // Select number of guests
    await page.waitForSelector("#edit-nombre-d-accompagnants");
    await page.select("#edit-nombre-d-accompagnants", reservationDetails.numGuests);
    await page.waitForTimeout(1000)

    // Select gender
    var gender = reservationDetails.gender
    await page.waitForSelector("#edit-civilite-mme");
    await page.click("#edit-civilite-mme");
    console.log("Successfully clicked gender!")

    // Input last name
    await page.waitForSelector("#edit-nom");
    await page.type("#edit-nom", reservationDetails.lastName, { delay: 30 });
    console.log("Successfully typed first name!")

    // Input first name
    await page.waitForSelector("#edit-prenom");
    await page.type("#edit-prenom", reservationDetails.firstName, { delay: 30 });
    console.log("Successfully typed last name!")

    // Input phone number
    await page.waitForSelector("#edit-telephone");
    await page.type("#edit-telephone", reservationDetails.phone, { delay: 30 });
    console.log("Successfully typed phone!")

    // Input email
    await page.waitForSelector("#edit-email");
    await page.type("#edit-email", reservationDetails.email, { delay: 30 });
    console.log("Successfully typed email!")

    // Input postal code
    await page.waitForSelector("#edit-code-postal");
    await page.type("#edit-code-postal", reservationDetails.postalCode, { delay: 30 });
    console.log("Successfully typed postal code!")

    // Input date of birth
    var birthday = splitDateString(reservationDetails.birthday);
    await page.waitForSelector("#edit-date-de-naissance");
    await page.type("#edit-date-de-naissance", birthday.day, { delay: 30 });
    await page.focus("#edit-date-de-naissance", { delay: 300 });
    await page.type("#edit-date-de-naissance", birthday.month, { delay: 30 });
    await page.focus("#edit-date-de-naissance", { delay: 300 });
    await page.type("#edit-date-de-naissance", birthday.year, { delay: 30 });
    console.log("Successfully typed birthday!")

    // Accept general terms and conditions
    await page.waitForSelector("#edit-cgu");
    await page.click("#edit-cgu");
    console.log("Successfully agreed to terms!")

    // Accept GDPR conditions
    await page.waitForSelector("#edit-rgpd-consentement");
    await page.click("#edit-rgpd-consentement");
    console.log("Successfully agreed to GDPR!")

    // Submit form
    await page.waitForSelector("#edit-submit");
    await page.click("#edit-submit");
    console.log("Successfully submitted!")

    // Wait for new page to load
    await page.waitForSelector("#demande-caution-cheque-form");
    console.log("Successfully arrived at new page!")

    // Save URL to send it to bot
    // TODO: ALTERNATIVELY, WE COULD DIRECTLY CLICK ON "CHEQUE" AND SECURE THE RESERVATION INSTANTLY
    var url = await page.url();
    console.log(`url of current page is: ${url}`)

    // Close tab to avoid memory leaks
    await page.close();
    browser.disconnect();

    return url;
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

async function updateAvailabilities() {
    // Read previous availabilities (if available)
    // TODO: change this from localhost to process.env.BOT_DOMAIN || localhost depending on process.env.NODE_ENV
    var options = {
        hostname: process.env.SERVER_URL,
        path: `${API_PATH_BASE}/all-refuges`,
    };
    var allRefuges = await new Promise((resolve, reject) => {
        http.get(options, (res) => {
            var body = ""
            res.on("data", (chunk) => body += chunk );
            res.on("end", () => resolve(JSON.parse(body)));
        });
    })

    if(allRefuges.length == 0) return

    // Initialise browser
    await initialiseBrowser(); 

    // Get availabilities for each refuges
    for (const refuge of allRefuges) {
        var update = {};
        var availableDates = await getAvailableDates(refuge.url);
        update.availableDates = availableDates;

        // If any of the user's wantedDates is available, go ahead and make the reservation
        var compatibleDates = refuge.wantedDates.filter(value => availableDates.includes(value));
        for (const date of compatibleDates) {
            // makeReservation returns a URL as a confirmation link
            var urlToChequeVsCarte = await makeReservation(refuge.url, date, refuge.reservation)
            // Update the reservationUrls if a successful reservation could be made
            if(urlToChequeVsCarte != null) {
                if(update.reservationUrls === undefined)
                    update.reservationUrls = []
                update.reservationUrls.push(urlToChequeVsCarte)
            }
        }
        console.log(`update is looking like: ${JSON.stringify(update)}`)
        await updateRefuge(update, refuge.name)
    }

    // Close browser
    await closeBrowser();
}

// Ping heroku app every 20 minutes to prevent it from idling
var http = require("http");
setInterval(() => {
  console.log("Pinging Heroku from scraper now...")
  http.get(process.env.BOT_DOMAIN)
}, 20 * 60 * 1000);

cron.schedule("* * * * *", () => {
    console.log("Writing availabilities to JSON now...");
    updateAvailabilities();
})

module.exports = {
    findRefuges,
    getAvailableDates,
    capitalise,
    initialiseBrowser,
    updateAvailabilities,
    makeReservation
}
