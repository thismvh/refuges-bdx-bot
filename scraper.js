require('dotenv').config();
const puppeteer = require("puppeteer");

const DEV_MODE = process.env.DEV_MODE;

const BDX_REFUGES_URL = "https://lesrefuges.bordeaux-metropole.fr";

// MAKE THIS A CLASS PLEASE, WOULD BE MORE ELEGANT!
// MAKE THIS A CLASS PLEASE, WOULD BE MORE ELEGANT!
// MAKE THIS A CLASS PLEASE, WOULD BE MORE ELEGANT!
// MAKE THIS A CLASS PLEASE, WOULD BE MORE ELEGANT!
// MAKE THIS A CLASS PLEASE, WOULD BE MORE ELEGANT!


async function findRefuges() {
    console.log("Starting Bordeaux Refuges scraping process");
    // Create browser instance
    const browser = await puppeteer.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });

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
            img: refuge.img
        }
    ))

    return realRefuges;
};


// MAKE THIS EXECUTE MULTIPLE TIMES A DAY SO THAT WE CAN GET NOTIFICATIONS
async function getAvailableDates(refugeUrl) {
    console.log("Starting getAvailableDates process");
    // Create browser instance
    const browser = await puppeteer.launch({
        headless: false,
        args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });

    // Open new tab
    const page = await browser.newPage();

    // Go to one.com login page
    await page.goto(refugeUrl);

    await page.waitForSelector(".hasDatepicker")

    // var daySelector = "[data-handler='selectDay']"
    var daySelector = ".ui-state-default";
    var nextMonthSelector = "[data-handler='next']"
    var availableDates = [];
    var monthsInAdvance = 5;
    for (let index = 0; index < [...Array(monthsInAdvance).keys()].length; index++) {
        console.log("availableDates has length" + availableDates.length)
        // Get available dates of current month
        await page.waitForSelector(daySelector)
        var newDates = await page.$$(daySelector)

        // Add available dates from this month to the total
        availableDates = availableDates.concat(newDates)

        // Go to next month
        await page.waitForSelector(nextMonthSelector)
        var nextMonthButton = await page.$(nextMonthSelector)
        await page.evaluate(e => e.click(), nextMonthButton);
    }

    return availableDates;
}

function capitalise(string) {
    return string.charAt(0).toUpperCase() + string.slice(1)
}

function replaceUmlaute(str) {
    const umlautMap = {
        '\u00dc': 'UE',
        '\u00c4': 'AE',
        '\u00d6': 'OE',
        '\u00fc': 'ue',
        '\u00e4': 'ae',
        '\u00f6': 'oe',
        '\u00df': 'ss',
    }

    return str
        .replace(/[\u00dc|\u00c4|\u00d6][a-z]/g, (a) => {
            const big = umlautMap[a.slice(0, 1)];
            return big.charAt(0) + big.charAt(1).toLowerCase() + a.slice(1);
        })
        .replace(new RegExp('[' + Object.keys(umlautMap).join('|') + ']', "g"),
            (a) => umlautMap[a]
        );
}

function getRefuges(page, selector) {
    return page.evaluate((sel) => {
        var images = []
        var urls = []
        var names = []
        let elements = Array.from(document.querySelectorAll(sel));
        let refuges = elements.map(element => {
            return { 
                name:  element.href.replace(/^(?:\/\/|[^/]+)*\//, ''),
                url: element.href,
                img: element.childNodes[0].src
            }
        })
        return refuges;
    }, selector);
};

// getAvailableDates("https://lesrefuges.bordeaux-metropole.fr/la-station-orbitale")
// findRefuges()

module.exports = {
    findRefuges,
    getAvailableDates
}
