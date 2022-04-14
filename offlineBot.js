const http = require("http");
const cron = require("node-cron");
const { Composer, session, Telegraf, Scenes } = require("telegraf");
const WizardScene = Scenes.WizardScene;

const { findRefuges, initialiseBrowser, closeBrowser, getAvailableDates, makeReservation, capitalise } = require("./scraper");
const { delay, arrayIsEqual } = require("./helpers")
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
  NEW_MOON_FACE,
  GRIN,
  EXPLODING_HEAD,
  CONFUSED_FACE,
  WARNING,
  WINK,
  PORT,
  API_PATH_BASE,
  ROLLING_EYES
} = require("./constants");

const { updateRefuge } = require("./requests");

const token = process.env.BOT_TOKEN_ROBOCHOU
if (token === undefined) {
  throw new Error("BOT_TOKEN_ROBOCHOU must be provided!")
}

const stepHandler = new Composer()
stepHandler.action(new RegExp(ACTION_FETCH_AVAILABLE_DATES + "_+", "g"), async (ctx) => {
  // Answer callback to remove loading icon on button after clicking
  ctx.answerCbQuery();

  var relativeUrl = ctx.match.input.substring(ACTION_FETCH_AVAILABLE_DATES.length + 1);
  var refugeName = relativeUrl.toLowerCase().split(/[-\s]/).map(x => capitalise(x)).join(" ");

  console.log("YOOOOOOO, THIS IS THE CONTEXT AFTER PRESSING A BUTTON DAWG!: " + `${BDX_REFUGES_URL}/${relativeUrl}`);

  var fullUrl = `${BDX_REFUGES_URL}/${relativeUrl}`;
  // Add this refuge to database if in case it didn't yet exist
  // TODO: probably this should return the updated refuge to avoid fetching the refuge again 
  await updateRefuge({ name: relativeUrl, prettyName: refugeName, url: fullUrl, chatId: ctx.chat.id, notify: true }, relativeUrl)

  // Little feedback to user to keep attention
  await ctx.reply(`Ok, attend, je vais voir s'il y a des places libres pour ${refugeName} ...`);
  await delay(1500);
  
  // Fetch refuge from database
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
    await ctx.reply(`Woooohoooo!! ${PARTYING_FACE} ${PARTYING_FACE} Il y a des places libres pour ${refugeName}!!! Réserve directement sur: ${fullUrl}`);
    await delay(1000);
    return ctx.scene.enter(SCHEDULE_DATE_SCENE, { refugeUrlShort: relativeUrl });
  }
})

stepHandler.action(new RegExp(ACTION_MORE_REFUGES + "_+", "g"), async (ctx) => {
  // Answer callback to remove loading icon on button after clicking
  ctx.answerCbQuery();

  var moreRefugesAnswer = ctx.match.input.substring(ACTION_MORE_REFUGES.length + 1);
  var wantsMoreRefuges = moreRefugesAnswer === "YES";

  console.log("moreRefugesAnswer is looking like this: " + moreRefugesAnswer)

  if(wantsMoreRefuges)
    await ctx.reply("Ok, click sur un autre refuge donc! :)");
  else
    await ctx.reply(GOING_TO_SLEEP)
})

stepHandler.action(new RegExp(ACTION_SCHEDULE_DATE + "_+", "g"), async (ctx) => {
  // Answer callback to remove loading icon on button after clicking
  ctx.answerCbQuery();
  
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

    if(allRefuges.length == 0) {
      await ctx.reply(`Mince, je peux pas trouver les refuges ${ROLLING_EYES} Juste un moment, laisse moi effacer ma mémoire et essayer encore une fois...`)
      await delay(2000);
      return ctx.scene.enter(LIST_REFUGES_SCENE)
    }

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
    var gender = ctx.message.text.match(/[Mm]\./)
    ctx.wizard.state.reservationDetails.gender = gender === null ? "mme" : "m";
    await ctx.reply(`Ok, cool! Il me reste juste 2 choses pour finir...`);
    await delay(500)
    await ctx.reply(`D'abord, ton code postal:`)
    return ctx.wizard.next()
  },
  async (ctx) => {
    ctx.wizard.state.reservationDetails.postalCode = ctx.message.text;
    await ctx.reply(`Meeeeerci beacoup! ${GRIN}`);
    await delay(500)
    var refugeName = ctx.wizard.state.refugeUrlShort.toLowerCase().split(/[-\s]/).map(x => capitalise(x)).join(" ");
    await ctx.reply(`Et finalement, le nombre d'accompagnants qui veulent venir à ${refugeName} avec toi:`)
    return ctx.wizard.next()
  },
  async (ctx) => {
    ctx.wizard.state.reservationDetails.numGuests = ctx.message.text;
    const demoLink = "https://lesrefuges.bordeaux-metropole.fr/reservation/demande/caution/redirection/SxVz1dmPto79DNzmYCL5mOBUglCM1ZPxzJZ8Mh94I6M"
    await ctx.reply(`Trop cool! C'est toooout ${GRIN}. Quand il y a des places libres pour les jours que tu m'as dit je ferai la réservation et tu recevra un link comme ça ${demoLink} \n\n Il te faudra seulement clicker sur le link et décider quel mode de caution tu veux et c'est fini, tu a la place garantie!! ${PARTYING_FACE} \n\n Mais ATTENTION ${WARNING}${WARNING}${WARNING}, tu as seulement 2 heures pour donner la caution!! Il faut être vite ${WINK}`);
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
  // Greet user
  ctx.reply(WELCOME_MESSAGE)
    .then(() => ctx.scene.enter(LIST_REFUGES_SCENE));
});

// Additional commands
bot.command("list", async (ctx) => {
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

  var availabilitiesSummary = allRefuges.reduce((accumulator, refuge) => accumulator + `${refuge.prettyName}:\n ${refuge.availableDates.join(", ")} \n\n`, "");
  ctx.reply(`Pour tous les refuges, les dates disponibles sont: \n\n${availabilitiesSummary}`)
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

async function notifyOfAvailabilities() {
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

  for (const refuge of allRefuges) {
    // Get new available dates
    var hasNewAvailabilities = false;
    var update = {};
    var availableDates = await getAvailableDates(refuge.url);
    var reservedDate;
    update.availableDates = availableDates;
    // Take current notify as base value. If anything changed, it will be overwritten down below
    update.notify = refuge.notify;

    // Only re-notify the user about the same refuge when availableDates was 0 before
    if(availableDates.length === 0) update.notify = true

    // Only update database if there's any new info to add
    hasNewAvailabilities = !arrayIsEqual(refuge.availableDates, availableDates);

    // If any of the user's wantedDates is available, go ahead and make the reservation
    var compatibleDates = refuge.wantedDates.filter(value => availableDates.includes(value));
    for (const date of compatibleDates) {
        // makeReservation returns a confirmation URL
        var confirmationUrl = await makeReservation(refuge.url, date, refuge.reservation)
        // Update the reservationUrls if a successful reservation could be made
        if(confirmationUrl != null) {
            reservedDate = date;
            if(update.reservationUrls === undefined) update.reservationUrls = []
            update.reservationUrls.push(confirmationUrl)
            // Remove the current date from wantedDates since we successfully made a reservation for that day
            update.wantedDates = refuge.wantedDates.filter(item => item !== date)
            update.notify = true;
        }
    }

    // Notify of new availabilities in case there are any
    if(!update.notify && !hasNewAvailabilities) continue

    var refugeName = refuge.name.toLowerCase().split(/[-\s]/).map(x => capitalise(x)).join(" ");
    if(availableDates.length > 0 && update.notify) {
      await bot.telegram.sendMessage(refuge.chatId, `Woooohoooo!! ${PARTYING_FACE} ${PARTYING_FACE} ${refugeName} a des places libres les jours ${availableDates.join(", ")}!!! Réserve directement sur: ${refuge.url}`)
      update.notify = false;
    }
    
    if(update.reservationUrls !== undefined && update.reservationUrls.length > 0 && update.notify) {
      // TODO: Why even keep an array of URLs if there's always just 0 or 1 values inside it?
      var confirmationUrl = update.reservationUrls.pop()
      await bot.telegram.sendMessage(refuge.chatId, `Eloooo, j'ai fait une réservation pour toiiiii pour ${refugeName} le jour ${reservedDate}... ${NEW_MOON_FACE} Il te faut seulement clicker sur ce link: ${confirmationUrl}\n\net décider quel mode de caution tu veux et c'est fini, tu a la place garantie!! ${PARTYING_FACE}\n\nMais ATTENTION ${WARNING}${WARNING}${WARNING}, tu as seulement 2 heures pour donner la caution!! Tu dois être vite! ${WINK}`)
      update.notify = false
    }

    var userWasNotified = update.notify === false || update.reservationUrls !== undefined
    // console.log(`userWasNotified is ${userWasNotified}, hasNewAvailabilities is ${hasNewAvailabilities} and update is ${JSON.stringify(update)}`)
    if(hasNewAvailabilities || userWasNotified)
      await updateRefuge(update, refuge.name)
  }

  // Close browser
  await closeBrowser();
}

// TODO: Maybe we could send a GET request from the Netlify server as a sort of "webhook" to avoid constantly polling??
cron.schedule("* 7-23 * 3-11 *", () => {
  console.log("Notifying of potential new availabilities now...");
  notifyOfAvailabilities();
}, { timezone: "Europe/Paris" })