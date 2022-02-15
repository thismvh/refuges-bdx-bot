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
    await page.waitForSelector("[class*='lien-colonne'] a, [class*='lien-refuge-colonne'] a");
    await page.waitForSelector("a[href*='les-refuges']");
    
    // Get list of all refuges
    var allRefuges = await getRefuges(page, "[class*='lien-colonne'] a, [class*='lien-refuge-colonne'] a");
    var fakeRefuges = await getRefuges(page, "a[href*='les-refuges']");
    var realRefuges = allRefuges.filter(refuge => !fakeRefuges.includes(refuge));

    realRefuges = realRefuges.map(refuge => 
        refuge.toLowerCase().split(/[-\s]/).map(x => capitalise(x)).join(" ")
    )
};

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
        let elements = Array.from(document.querySelectorAll(sel));
        let links = elements.map(element =>
            // Get relative URL 
            element.href.replace(/^(?:\/\/|[^/]+)*\//, '')
        )
        return links;
    }, selector);
};

module.exports = {
    findRefuges
}
