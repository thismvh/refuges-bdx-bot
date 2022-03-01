const { Composer, session, Telegraf, Stage } = require("telegraf");
const WizardScene = require("telegraf/scenes/wizard");

const { periodicDateCheck, findRefuges, initialiseBrowser, capitalise, dateNotifier } = require("./scraper");

const token = process.env.BOT_TOKEN_OFF
if (token === undefined) {
  throw new Error("BOT_TOKEN_OFF must be provided!")
}

// Refuges website
const BDX_REFUGES_URL = "https://lesrefuges.bordeaux-metropole.fr";

// SCENE NAMES
const LIST_REFUGES_SCENE = "LIST_REFUGES_SCENE"
const SPECIFIC_REFUGE_SCENE = "SPECIFIC_REFUGE_SCENE"
const MORE_REFUGES_SCENE = "MORE_REFUGES_SCENE"

// Smiley codes
const GRIN = "\u{1F601}"
const BROKEN_HEART = "\u{1F494}"
const ROLLING_EYES = "\u{1F644}"
const WINK = "\u{1F609}"
const PARTYING_FACE = "\u{1F973}"
const SLEEPING_FACE = "\u{1F634}"
const WAVING_HAND = "\u{1F44B}"

// Pre-defined bot messages
const WELCOME_MESSAGE = `Coucou, j'ai entendu tu veux reserver un refuge? ${GRIN}`;
const CHIANT_CHECK_REFUGES = `Mais pfff, c'est chiant d'aller à la site web tout le temps pour voir s'il y a des places, non? ${ROLLING_EYES}`
const TINQUIETE_JY_VAIS = `T'inquièèèèète, j'y vais à ta place et quand je vois des places disponibles je t'envoie un message et puis tu peux être la première à réserver ${WINK}`
const WHICH_REFUGE_MESSAGE = `Quel refuge est-ce que tu veux reserver?`;
const GOING_TO_SLEEP = `Ok, je vais faire dodo alors ${SLEEPING_FACE} Réveille-moi en écrivant /start dans ce chat ou en appuyant sur les /start bleus. Tschuuuus! ${WAVING_HAND}`

// Bot actions
const ACTION_FETCH_AVAILABLE_DATES = "FETCH_DATES";
const ACTION_MORE_REFUGES = "MORE_REFUGES";

var trackedRefuges = new Set();

const stepHandler = new Composer()
stepHandler.action(new RegExp(ACTION_FETCH_AVAILABLE_DATES + "_+", "g"), (ctx) => {
  var relativeUrl = ctx.match.input.substring(ACTION_FETCH_AVAILABLE_DATES.length + 1);
  console.log("YOOOOOOO, THIS IS THE CONTEXT AFTER PRESSING A BUTTON DAWG!: " + `${BDX_REFUGES_URL}/${relativeUrl}`);

  var fullUrl = `${BDX_REFUGES_URL}/${relativeUrl}`;
  if(trackedRefuges.has(fullUrl)) {
    ctx.reply("Je suis déjà ce refuge, choisi un autre :)");
    return
  }

  trackedRefuges.add(fullUrl);
  return ctx.scene.enter(SPECIFIC_REFUGE_SCENE, { refugeUrl: fullUrl })
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

const listRefugesWizard = new WizardScene(
  "LIST_REFUGES_SCENE",
  async (ctx) => {
    initialiseBrowser(); 

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

const specificRefugeWizard = new WizardScene(
  "SPECIFIC_REFUGE_SCENE",
  async (ctx) => {
    console.log("This is ctx.wizard.state.refugeUrl in new scene: " + ctx.wizard.state.refugeUrl)
    // TODO: REFACTOR THIS UGLINESS
    var refugeName = ctx.wizard.state.refugeUrl.replace(/^(?:\/\/|[^/]+)*\//, '').toLowerCase().split(/[-\s]/).map(x => capitalise(x)).join(" ");
    await ctx.reply(`Ok, attend, je vais voir s'il y a des places libres pour ${refugeName} ...`)
    // Go to URL of refuge and look for available dates
    await periodicDateCheck(ctx.wizard.state.refugeUrl);
    // await getAvailableDatesDummy(ctx.wizard.state.refugeUrl)

    // Properly subscribe and unsubscribe listeners of dateNotifier to avoid memory leaks
    // dateNotifier.setMaxListeners(dateNotifier.getMaxListeners() + 1)
    dateNotifier.on("noDates", onNoDates)
    dateNotifier.on("yesDates", onYesDates)

    var hasAvailableDates = false;
    var firstNo = true;
    async function onNoDates() {
      // await cleanup()
      console.log("No dates available!!");
      if(firstNo || hasAvailableDates) {
        firstNo = false;
        hasAvailableDates = false;
        await ctx.reply(`Mince!!! Il y a pas de places libres pour ${refugeName} ${BROKEN_HEART} Mais t'inquièèèèète, je t'envoie un message quand y en a!`);
        await delay(3000)
        return ctx.scene.enter(MORE_REFUGES_SCENE, { refugeUrl: ctx.wizard.state.refugeUrl });
      }
    }

    var firstYes = true;
    async function onYesDates() {
      // await cleanup()
      console.log("Yes dates available!!");
      if(firstYes || !hasAvailableDates) {
        firstYes = false;
        hasAvailableDates = true;
        await ctx.reply(`Woooohoooo!! ${PARTYING_FACE} ${PARTYING_FACE} Il y a des places libres pour ${refugeName}!!! Réserve directement sur: + ${ctx.wizard.state.refugeUrl}`)
        return ctx.scene.enter(MORE_REFUGES_SCENE, { refugeUrl: ctx.wizard.state.refugeUrl });
      }
    }

    async function cleanup() {
      dateNotifier.removeListener("noDates", onNoDates)
      dateNotifier.removeListener("yesDates", onYesDates)
      // this promise is done, so we lower the maximum number of listeners
      dateNotifier.setMaxListeners(dateNotifier.getMaxListeners() - 1)
    }
  },
  async (ctx) => {
    await ctx.reply("Done from scene: " + SPECIFIC_REFUGE_SCENE)
    return await ctx.scene.leave()
  }
)

const moreRefugesWizard = new WizardScene(
  "MORE_REFUGES_SCENE",
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
const stage = new Stage([listRefugesWizard, specificRefugeWizard, moreRefugesWizard])

bot.use(session())
bot.use(stage.middleware())
bot.launch()

// This will be executed when the user inputs the command /start
bot.start((ctx) => {
  // Greet user
  ctx.reply(WELCOME_MESSAGE)
    .then(() => ctx.scene.enter(LIST_REFUGES_SCENE));
});

// Enable graceful stop
process.once("SIGINT", () => bot.stop("SIGINT"))
process.once("SIGTERM", () => bot.stop("SIGTERM"))

async function delay(time) {
  await new Promise(resolve => setTimeout(resolve, time));
}