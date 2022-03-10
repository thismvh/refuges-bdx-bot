const { Composer, session, Telegraf, Scenes } = require("telegraf");
const WizardScene = Scenes.WizardScene;
const { readFileSync, watchFile, existsSync, mkdirSync, writeFileSync } = require("fs");

const { findRefuges, initialiseBrowser, capitalise } = require("./scraper");
const { 
  ACTION_FETCH_AVAILABLE_DATES,
  ACTION_MORE_REFUGES,
  ACTION_SCHEDULE_DATE,
  BDX_REFUGES_URL,
  LIST_REFUGES_SCENE,
  MORE_REFUGES_SCENE,
  SCHEDULE_DATE_SCENE,
  TRIGGER_DATE_SCHEDULING_SCENE,
  PARTYING_FACE,
  BROKEN_HEART,
  WELCOME_MESSAGE,
  CHIANT_CHECK_REFUGES,
  TINQUIETE_JY_VAIS,
  WHICH_REFUGE_MESSAGE,
  GOING_TO_SLEEP,
  DATA_DIR_PATH,
  DATA_FILE_NAME
} = require("./constants");

const token = process.env.BOT_TOKEN_OFF
if (token === undefined) {
  throw new Error("BOT_TOKEN_OFF must be provided!")
}

var chatId = null;

var trackedRefuges = new Set();

const stepHandler = new Composer()
stepHandler.action(new RegExp(ACTION_FETCH_AVAILABLE_DATES + "_+", "g"), async (ctx) => {
  var relativeUrl = ctx.match.input.substring(ACTION_FETCH_AVAILABLE_DATES.length + 1);
  var refugeName = relativeUrl.replace(/^(?:\/\/|[^/]+)*\//, '').toLowerCase().split(/[-\s]/).map(x => capitalise(x)).join(" ");

  console.log("YOOOOOOO, THIS IS THE CONTEXT AFTER PRESSING A BUTTON DAWG!: " + `${BDX_REFUGES_URL}/${relativeUrl}`);

  var fullUrl = `${BDX_REFUGES_URL}/${relativeUrl}`;
  if(trackedRefuges.has(fullUrl)) {
    ctx.reply("Je suis déjà ce refuge, choisi un autre :)");
    return
  }

  // Save refuge as already seen
  trackedRefuges.add(fullUrl);

  // Little feedback to user to keep attention
  await ctx.reply(`Ok, attend, je vais voir s'il y a des places libres pour ${refugeName} ...`);
  await delay(1500);

  // Only proceed if data file actually exists
  if(!existsSync("./data/refuges.json")) {
    await ctx.reply(`Mince!!! Il y a pas de places libres pour ${refugeName} ${BROKEN_HEART} Mais t'inquièèèèète, je t'envoie un message quand y en a!`);
    await delay(1000);
    return ctx.scene.enter(SCHEDULE_DATE_SCENE, { refugeUrlShort: relativeUrl });
  }

  var refugeAvailabilities = JSON.parse(readFileSync("./data/refuges.json"));
  var availabilityCurrentRefuge = refugeAvailabilities[relativeUrl].availableDates;

  if(availabilityCurrentRefuge.length == 0) {
    await ctx.reply(`Mince!!! Il y a pas de places libres pour ${refugeName} ${BROKEN_HEART}`);
    await delay(1000);
    return ctx.scene.enter(SCHEDULE_DATE_SCENE, { refugeUrlShort: relativeUrl });
  }
  else {
    await ctx.reply(`Woooohoooo!! ${PARTYING_FACE} ${PARTYING_FACE} Il y a des places libres pour ${refugeName}!!! Réserve directement sur: + ${fullUrl}`);
    await delay(1000);
    return ctx.scene.enter(MORE_REFUGES_SCENE);
  }
})

stepHandler.action(new RegExp(ACTION_MORE_REFUGES + "_+", "g"), async (ctx) => {
  var moreRefugesAnswer = ctx.match.input.substring(ACTION_MORE_REFUGES.length + 1);
  var wantsMoreRefuges = moreRefugesAnswer === "YES";

  console.log("moreRefugesAnswer is looking like this: " + moreRefugesAnswer)

  if(wantsMoreRefuges)
    await ctx.reply("Ok, click sur un autre refuge donc! :)");
  else
    await ctx.reply(GOING_TO_SLEEP)
})

stepHandler.action(new RegExp(ACTION_SCHEDULE_DATE + "_+", "g"), async (ctx) => {
  var scheduleDateAnswer = ctx.match.input.substring(ACTION_SCHEDULE_DATE.length + 1);
  var wantsDateSchedule = /_YES/.test(scheduleDateAnswer);
  var relativeUrl = scheduleDateAnswer.match(/(.*)?_/)[1];

  console.log("scheduleDateAnswer is looking like this: " + scheduleDateAnswer)

  if(wantsDateSchedule) {
    await ctx.reply("Ok, quels jours est\-ce que tu veux réserver? Par exemple, si c'est le 3 juin et le 19 juillet, écri-les comme ça: 03.06, 19.07");
    return ctx.scene.enter(TRIGGER_DATE_SCHEDULING_SCENE, { refugeUrlShort: relativeUrl });
  }
  else {
    await ctx.reply("Ok, cool :)");
    return ctx.scene.enter(MORE_REFUGES_SCENE);
  }
})

const listRefugesWizard = new WizardScene(
  LIST_REFUGES_SCENE,
  async (ctx) => {
    await initialiseBrowser(); 

    await delay(2000);
    await ctx.reply(CHIANT_CHECK_REFUGES);
    await delay(4000);
    await ctx.reply(TINQUIETE_JY_VAIS);
    await delay(6000);
    await ctx.reply(WHICH_REFUGE_MESSAGE)

    var allRefuges = await findRefuges();
    // var allRefuges = [
    //   { 
    //     name: "La Station Orbitale",
    //     img: "https://lesrefuges.bordeaux-metropole.fr/sites/MET-REFUGES-DRUPAL/files/styles/ph/public/2019-07/BM_Station_Orbitale_%28c%29_J-B_Menges_DJI_0787_940x400px.jpg?itok=I2SFSJvE",
    //     url: "https://lesrefuges.bordeaux-metropole.fr/la-station-orbitale",
    //     urlShort: "la-station-orbitale"
    //   },
    //   { 
    //     name: "Le Hamac",
    //     img: "https://lesrefuges.bordeaux-metropole.fr/sites/MET-REFUGES-DRUPAL/files/2019-02/Hamac_bruitdufrigo_028-940x400.jpg",
    //     url: "https://lesrefuges.bordeaux-metropole.fr/le-hamac",
    //     urlShort: "le-hamac"
    //   }
    // ]

    for (const refuge of allRefuges) {
      await ctx.replyWithPhoto(refuge.img, {
        url: refuge.img,
        parse_mode: "MarkdownV2",
        reply_markup: {
          inline_keyboard: [
            [ { text: refuge.name, callback_data: `${ACTION_FETCH_AVAILABLE_DATES}_${refuge.urlShort}` } ]
          ]
        }
      });
    }

    // This line is necessary, otherwise the stephandler won't be called
    return ctx.wizard.next()
  },
  stepHandler,
  async (ctx) => {
    await ctx.reply("Done from scene: " + LIST_REFUGES_SCENE)
    return await ctx.scene.leave()
  }
)

const scheduleDateWizard = new WizardScene(
  SCHEDULE_DATE_SCENE,
  async (ctx) => {
    console.log("Arrived at SCHEDULE_DATE_SCENE")
    await ctx.reply("Est\\-ce que tu veux me dire le jour qui tu veux réserver et alors je t'envoie un message quand il y a des places ce jour\\-là?", {
      parse_mode: "MarkdownV2",
      reply_markup: {
        inline_keyboard: [
          [ 
            { text: "Oui", callback_data: `${ACTION_SCHEDULE_DATE}_${ctx.wizard.state.refugeUrlShort}_YES` },
            { text: "Non", callback_data: `${ACTION_SCHEDULE_DATE}_${ctx.wizard.state.refugeUrlShort}_NO` }
          ]
        ]
      }
    });

    // This line is necessary, otherwise the stephandler won't be called
    return ctx.wizard.next();
  },
  stepHandler,
  async (ctx) => {
    await ctx.reply("Done from scene: " + MORE_REFUGES_SCENE)
    return await ctx.scene.leave()
  }
)

const triggerDateSchedulingWizard = new WizardScene(
  TRIGGER_DATE_SCHEDULING_SCENE,
  async (ctx) => {
    console.log("Arrived at TRIGGER_DATE_SCHEDULING_SCENE")
    // Wait for user's input
    return ctx.wizard.next();
  },
  async (ctx) => {
    console.log(`Current text is: ${ctx.message.text}`)
    // Extract days to track from user's message
    var datesToTrack = ctx.message.text.split(",").map(date => {
      var dateFormat = date.match(/(\d\d)\.(\d\d)/)
      return { day: dateFormat[1], month: dateFormat[2] }
    })

    // Write datesToTrack in JSON? Add it to the already existing JSON file?
    var previousDatesToTrack;
    if (!existsSync(DATA_DIR_PATH)) {
        mkdirSync(DATA_DIR_PATH);
        previousDatesToTrack = {};
    } else 
        previousDatesToTrack = JSON.parse(readFileSync(`${DATA_DIR_PATH}/${DATA_FILE_NAME}`));

    var urlShort = ctx.wizard.state.refugeUrlShort;
    if(previousDatesToTrack[urlShort] === undefined)
      previousDatesToTrack[urlShort] = {}
    previousDatesToTrack[urlShort].wantedDates = datesToTrack;

    // Write updated previousDatesToTrack into JSON file
    writeFileSync(`${DATA_DIR_PATH}/${DATA_FILE_NAME}`, JSON.stringify(previousDatesToTrack))

    // TODO: MAKE NEW ctx.wizard.next() AND ASK FOR RESERVATION DETAILS, STORE RESERVATION DETAILS IN A SEPARATE JSON FILE

    await ctx.reply("Ok, je fais attention à ces jours! :)");
    await delay(1000);
    return ctx.scene.enter(MORE_REFUGES_SCENE);
  },
  stepHandler,
  async (ctx) => {
    await ctx.reply("Done from scene: " + MORE_REFUGES_SCENE)
    return await ctx.scene.leave()
  }
)

const moreRefugesWizard = new WizardScene(
  MORE_REFUGES_SCENE,
  async (ctx) => {
    console.log("Arrived at new wizard scene, DO YOU WANT MORE REFUGES")
    await ctx.reply("Est\\-ce que tu veux réserver un autre refuge?", {
      parse_mode: "MarkdownV2",
      reply_markup: {
        inline_keyboard: [
          [ 
            { text: "Oui", callback_data: `${ACTION_MORE_REFUGES}_YES` },
            { text: "Non", callback_data: `${ACTION_MORE_REFUGES}_NO` }
          ]
        ]
      }
    });

    // This line is necessary, otherwise the stephandler won't be called
    return ctx.wizard.next();
  },
  stepHandler,
  async (ctx) => {
    await ctx.reply("Done from scene: " + MORE_REFUGES_SCENE)
    return await ctx.scene.leave()
  }
)

const bot = new Telegraf(token)
const stage = new Scenes.Stage([listRefugesWizard, scheduleDateWizard, triggerDateSchedulingWizard, moreRefugesWizard])

bot.use(session())
bot.use(stage.middleware())
// make this a cron job as well to avoid heroku sleep? execute this cron job like 2 minutes before periodicDateCheck???
bot.launch()

// This will be executed when the user inputs the command /start
bot.start((ctx) => {
  // Save chatId for later
  chatId = ctx.chat.id;

  // Greet user
  ctx.reply(WELCOME_MESSAGE)
    .then(() => ctx.scene.enter(LIST_REFUGES_SCENE));
});

// Enable graceful stop
process.once("SIGINT", () => bot.stop("SIGINT"))
process.once("SIGTERM", () => bot.stop("SIGTERM"))

// Create express server just so that Heroku recognizes this script as a web process
const express = require("express");
const expressApp = express();

const port = process.env.PORT || 3000
expressApp.get("/", (req, res) => {
  res.send("Hello World!")
})
expressApp.listen(port, () => {
  console.log(`Listening on port ${port}`)
})

// Ping heroku app every 20 minutes to prevent it from idling
var http = require("http");
const { relative } = require("path");
setInterval(() => {
  console.log("Pinging Heroku from offlineBot now...")
  http.get(process.env.BOT_DOMAIN)
}, 20 * 60 * 1000);

watchFile("./data/refuges.json", () => {
  console.log("Current chatId is: " + chatId)
  if(chatId === null)
    return

  var fileData = JSON.parse(readFileSync("./data/refuges.json"));

  var refuges = Array.from(trackedRefuges);
  for (const refuge of refuges) {
    var refugeShortUrl = refuge.replace(/^(?:\/\/|[^/]+)*\//, '');
    var refugeName = refugeShortUrl.replace(/^(?:\/\/|[^/]+)*\//, '').toLowerCase().split(/[-\s]/).map(x => capitalise(x)).join(" ");
    if(!!fileData[refugeShortUrl] && !!fileData[refugeShortUrl].availableDates && fileData[refugeShortUrl].availableDates.length > 0)
      bot.telegram.sendMessage(chatId, `Woooohoooo!! ${PARTYING_FACE} ${PARTYING_FACE} Il y a des places libres pour ${refugeName}!!! Réserve directement sur: ${refuge}`)
  }
})

async function delay(time) {
  await new Promise(resolve => setTimeout(resolve, time));
}