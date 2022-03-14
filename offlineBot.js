const http = require("http");
const cron = require("node-cron");
const { Composer, session, Telegraf, Scenes } = require("telegraf");
const WizardScene = Scenes.WizardScene;

const { findRefuges, initialiseBrowser, capitalise } = require("./scraper");
const { delay } = require("./helpers")
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
  DATA_FILE_NAME,
  NEW_MOON_FACE,
  GRIN,
  EXPLODING_HEAD,
  CONFUSED_FACE,
  WARNING,
  WINK,
  PORT,
  API_PATH_BASE
} = require("./constants");

const { saveRefuge, updateRefuge } = require("./requests");

const token = process.env.BOT_TOKEN
if (token === undefined) {
  throw new Error("BOT_TOKEN must be provided!")
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
  // Add this refuge to database if in case it didn't yet exist
  // TODO: probably this should return the updated refuge to avoid fetching the refuge again 
  await updateRefuge({ name: relativeUrl, url: fullUrl }, relativeUrl)

  // Little feedback to user to keep attention
  await ctx.reply(`Ok, attend, je vais voir s'il y a des places libres pour ${refugeName} ...`);
  await delay(1500);
  
  // Fetch refuge from database
  // TODO: change this from localhost to process.env.BOT_DOMAIN || localhost depending on process.env.NODE_ENV
  var options = {
    hostname: process.env.SERVER_URL,
    path: `${API_PATH_BASE}/refuges/${relativeUrl}`,
  };
  var fetchedRefuge = await new Promise((resolve, reject) => {
      http.get(options, (res) => {
          var body = ""
          res.on("data", (chunk) => body += chunk );
          res.on("end", () => resolve(JSON.parse(body)));
      });
  })

  if(fetchedRefuge.availableDates.length == 0) {
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
    await ctx.reply("Ok, quels jours est\-ce que tu veux réserver? Par exemple, si c'est le 3 juin et le 19 juillet, écri-les comme ça: 3.6, 19.7");
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
    // Instead of writing the whole object, we need to only update the wantedDates property of this refuge (bzw. create the refuge if it does not exist yet)
    var newDates = { wantedDates: ctx.message.text.split(",") }
    await updateRefuge(newDates, ctx.wizard.state.refugeUrlShort)


    // TODO: MAKE NEW ctx.wizard.next() AND ASK FOR RESERVATION DETAILS, STORE RESERVATION DETAILS IN A SEPARATE JSON FILE

    await ctx.reply("Ok, je fais attention à ces jours! :)");
    await delay(1000);
    await ctx.reply(`Pour faire la réservation, j'aurais besoin de quelques dates ${NEW_MOON_FACE}`);
    await delay(500)
    await ctx.reply("Quel est ton prénom?");
    ctx.wizard.state.reservationDetails = {}
    return ctx.wizard.next();
  },
  async (ctx) => {
    ctx.wizard.state.reservationDetails.firstName = ctx.message.text;
    await ctx.reply("Trop beau prénom!");
    await delay(500)
    await ctx.reply("Et ton nom?")
    return ctx.wizard.next()
  },
  async (ctx) => {
    ctx.wizard.state.reservationDetails.lastName = ctx.message.text;
    await ctx.reply("Tant beau comme le prénom, quelle chance!");
    await delay(500)
    await ctx.reply("Et c'est quoi ton email?")
    return ctx.wizard.next()
  },
  async (ctx) => {
    ctx.wizard.state.reservationDetails.email = ctx.message.text;
    await ctx.reply("Bonne election d'email!");
    await delay(500)
    await ctx.reply("Et ton téléphone?")
    return ctx.wizard.next()
  },
  async (ctx) => {
    ctx.wizard.state.reservationDetails.phone = ctx.message.text;
    await ctx.reply(`J'ai vu des numéros plus beaux, mais oook, je le prends ${NEW_MOON_FACE}`);
    await delay(500)
    await ctx.reply(`Du coup, c'est quoi ta date de naissance? La mienne c'est le 08.06.1998, écri la tienne comme moi ${GRIN}`)
    return ctx.wizard.next()
  },
  async (ctx) => {
    ctx.wizard.state.reservationDetails.birthday = ctx.message.text;
    await ctx.reply(`Wow, mon frère aussi, quelle coïncidence! ${EXPLODING_HEAD}`);
    await delay(500)
    await ctx.reply(`Maintenant je suis désolé, mais pour la réservation, j'ai besoin de savoir ta civilité (M. ou Mme) ${CONFUSED_FACE}`)
    return ctx.wizard.next()
  },
  async (ctx) => {
    ctx.wizard.state.reservationDetails.gender = ctx.message.text;
    await ctx.reply(`Ok, cool! Il me reste juste 2 choses pour finir...`);
    await delay(500)
    await ctx.reply(`D'abord, ton code postal:`)
    return ctx.wizard.next()
  },
  async (ctx) => {
    ctx.wizard.state.reservationDetails.postalCode = ctx.message.text;
    await ctx.reply(`Meeeeerci beacoup! ${GRIN}`);
    await delay(500)
    await ctx.reply(`Et finalement, le nombre d'accompagnants qui veulent venir à ${ctx.wizard.state.refugeUrlShort} avec toi:`)
    return ctx.wizard.next()
  },
  async (ctx) => {
    ctx.wizard.state.reservationDetails.numGuests = ctx.message.text;
    const demoLink = "https://lesrefuges.bordeaux-metropole.fr/reservation/demande/caution/redirection/SxVz1dmPto79DNzmYCL5mOBUglCM1ZPxzJZ8Mh94I6M"
    await ctx.reply(`Trop cool! C'est toooout ${GRIN}. Quand il y a des places libres pour les jours que tu m'as dit je ferai la réservation et tu recevra un link comme ça ${demoLink} \n\n Il te faudra seulement clicker sur le link et décider quel mode de caution tu veux et c'est fini, tu a la place garantie!! ${PARTYING_FACE} \n\n Mais ATTENTION ${WARNING}${WARNING}${WARNING}, tu as seulement 20 minutes pour donner la caution!! Il faut être vite ${WINK}`);
    const newReservation = { reservation: ctx.wizard.state.reservationDetails };
    await updateRefuge(newReservation, ctx.wizard.state.refugeUrlShort)
    await delay(500)
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
const app = express();

app.get("/", (req, res) => {
  res.send("Hello World, this is offlineBot!")
})
app.listen(PORT, () => {
  console.log(`Listening on port ${PORT}`)
})

// Ping heroku app every 20 minutes to prevent it from idling
setInterval(() => {
  console.log("Pinging Heroku from offlineBot now...")
  http.get(process.env.BOT_DOMAIN)
}, 20 * 60 * 1000);

async function notifyOfAvailabilities() {
  console.log("Current chatId is: " + chatId)
  if(chatId === null) return

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

  for (const refuge of allRefuges) {
    var refugeName = refuge.name.replace(/^(?:\/\/|[^/]+)*\//, '').toLowerCase().split(/[-\s]/).map(x => capitalise(x)).join(" ");
    if(refuge.availableDates !== undefined && refuge.availableDates.length > 0)
      bot.telegram.sendMessage(chatId, `Woooohoooo!! ${PARTYING_FACE} ${PARTYING_FACE} Il y a des places libres pour ${refugeName}!!! Réserve directement sur: ${refuge}`)
  }
}

// Maybe we could send a GET request from the Netlify server as a sort of "webhook" to avoid constantly polling??
cron.schedule("30 * * * * *", () => {
  console.log("Notifying of potential new availabilities now...");
  notifyOfAvailabilities();
})