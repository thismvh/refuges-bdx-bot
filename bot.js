const { findRefuges, getAvailableDates } = require("./scraper");
const { Composer, WizardScene, Stage, session, Markup } = require("micro-bot");

// Refuges website
const BDX_REFUGES_URL = "https://lesrefuges.bordeaux-metropole.fr";

// Pre-defined messages the bot will use to interact with the user
const WELCOME_MESSAGE = "Coucou, j'ai entendu tu veux reserver un refuge? Viens avec moi... ;)";
const WHICH_REFUGE_MESSAGE = "Quel refuge est-ce que tu veux reserver?";
const LAST_NAME_MESSAGE = "Aaaw, that's a beautiful name! Thanks! Aaaaaaaaand what's the person's last name?";
const VALIDATION_MESSAGE = "Look at you! Trying to fool the almighty LobVR Bot... Please enter your real name :)";
const EMAIL_MESSAGE = "Perfect! What's the person's private email (to know where to send the welcome email to)?";
const CC_MESSAGE = "Aaaalright! And what's your own email address? (I'll set you in Cc so you're up to date)"
const HELP_MESSAGE = "This is the LobVR account generator bot. You give me name and email, I do the rest, meaning:\n\n1) Creating a LobVR account\n2) Inviting that LobVR account to ClickUp and\n3) Sending a confirmation email to the person's private email address to get them started\n\nAnything else the person might need to start working (e.g. get invited to Google Drive folders) I can't do, so please remember to do those things yourself :)\n\nSend /start to get me going. Send /clear to clear my memory while staying in the conversation. You can tell me at any time to /stop if you want and I'll end our conversation.\n\nLeeet's go!"

const ACTION_FETCH_AVAILABLE_DATES = "FETCH_DATES";

const bot = new Composer;

// Global refuges list
var allRefuges = [];

// Define a couple commands the user can trigger in the chat
bot.command("stop", (ctx) => {
  ctx.reply("k thx byeeeeeeeeeee");
  ctx.scene.leave()
});
bot.command("help", (ctx) => ctx.reply(HELP_MESSAGE));
bot.command("clear", (ctx) => {
  ctx.session = null;
  store.clear();
  ctx.reply("Got it! Cleared my memory just now. W-w-wait... Who are you again? Nevermind, send /start /help or /stop to continue.")
});

const contactDataWizard = new WizardScene(
  'CONTACT_DATA_WIZARD_SCENE_ID', // first argument is Scene_ID, same as for BaseScene
  // Ask user for the first name
  async (ctx) => {
    allRefuges = await findRefuges();
    // var refuges = allRefuges.map(refuge => [ { text: refuge.name, callback_data: refuge.name } ])
    await ctx.reply(WHICH_REFUGE_MESSAGE);
  
    // Does the button, display work after refactoring with images?
    await ctx.reply("Voici la liste de refuges:");
    for (const refuge of allRefuges) {
      await ctx.replyWithPhoto(refuge.img, {
        url: refuge.img,
        parse_mode: 'MarkdownV2',
        reply_markup: {
          inline_keyboard: [
           [ { text: refuge.name, callback_data: `${ACTION_FETCH_AVAILABLE_DATES}_${refuge.urlShort}` } ]
          ]
        }
      });
    }
    
    ctx.wizard.state.contactData = {};
    return ctx.wizard.next();
  },
  // Ask user for the last name
  (ctx) => {
    console.log("REACHED THE SECOND STEP!!! THE CURRENT REFUGE IS: " + ctx.wizard.state.currentRefuge);
    // First name validation
    if (ctx.message.text.length < 2) {
      ctx.reply(VALIDATION_MESSAGE);
      return;
    }

    console.log("WITHIN THE SECOND STEP, REACHED THE SECOND PART!!! THE CURRENT REFUGE IS: " + ctx.wizard.state.currentRefuge);

    ctx.wizard.state.contactData.fName = ctx.message.text;
    ctx.reply(LAST_NAME_MESSAGE);
    return ctx.wizard.next();
  },
  // Ask user for the email
  (ctx) => {
    // Last name validation
    if (ctx.message.text.length < 2) {
      ctx.reply(VALIDATION_MESSAGE);
      return;
    }
    ctx.wizard.state.contactData.lName = ctx.message.text;
    ctx.reply(EMAIL_MESSAGE);
    return ctx.wizard.next();
  },
  (ctx) => {
    // Cc email validation
    if (ctx.message.text.match("@") === null) {
      ctx.reply("Fiddlesticks! That's not a valid email address. Breathe in slowly and try again :)");
      return;
    }
    ctx.wizard.state.contactData.email = ctx.message.text;
    ctx.reply(CC_MESSAGE);
    return ctx.wizard.next();
  },
  // Pipe first name, last name and email into the account generator script
  async (ctx) => {
    // Email validation
    if (ctx.message.text.match("@") === null) {
      ctx.reply("Fiddlesticks! That's not a valid email address. Breathe in slowly and try again :)");
      return;
    }
    ctx.wizard.state.contactData.cc = ctx.message.text;
    await ctx.reply("Thank you for your replies, I'll create your LobVR account now");
    await ctx.reply("Please hang on tight for 1 or 2 minutes, I'm doing some extremely complex ML stuff... I'll let you know when I'm done :)");

    let { fName, lName, email, cc } = ctx.wizard.state.contactData;
    let { firstName, lastName, personalEmail, ccEmail, lobvrEmail, lobvrPass } = formatContactData([fName, lName, email, cc])

    await ctx.reply("Creating LobVR account now...");
    await createEmailAccount(firstName, lastName, lobvrEmail, lobvrPass)

    await ctx.reply("Done! Inviting to ClickUp now...");
    await inviteToClickup(lobvrEmail)

    await ctx.reply("Done! Sending confirmation email now...");
    await sendConfirmationEmail(lobvrEmail, lobvrPass, personalEmail, ccEmail, firstName)

    await ctx.reply("done!");
    await ctx.reply(`I created the account ${lobvrEmail} for our new team member ${fName} ${lName}!`);
    await ctx.reply("k thx byeeeeeeeeee")

    return ctx.scene.leave();
  },
);

const fetchAvailableDatesWizard = new WizardScene(
  `${ACTION_FETCH_AVAILABLE_DATES}_WIZARD_SCENE_ID`, // first argument is Scene_ID, same as for BaseScene
  // Ask user for the first name
  async (ctx) => {
    console.log("REACHED THE SECOND WIZARD SCENE!!!");

    // Go to URL of refuge and look for available dates 
    
    return ctx.wizard.next();
  },
  // Ask user for the last name
  (ctx) => {
    console.log("REACHED THE SECOND STEP!!! THE CURRENT REFUGE IS: " + ctx.wizard.state.refugeUrl);
    // First name validation
    if (ctx.message.text.length < 2) {
      ctx.reply(VALIDATION_MESSAGE);
      return;
    }

    console.log("WITHIN THE SECOND STEP, REACHED THE SECOND PART!!! THE CURRENT REFUGE IS: " + ctx.wizard.state.currentRefuge);

    // Go to URL of refuge and look for available dates 

    ctx.wizard.state.contactData.fName = ctx.message.text;
    ctx.reply(LAST_NAME_MESSAGE);
    return ctx.wizard.next();
  },
  // Ask user for the email
  (ctx) => {
    // Last name validation
    if (ctx.message.text.length < 2) {
      ctx.reply(VALIDATION_MESSAGE);
      return;
    }
    ctx.wizard.state.contactData.lName = ctx.message.text;
    ctx.reply(EMAIL_MESSAGE);
    return ctx.wizard.next();
  },
  (ctx) => {
    // Cc email validation
    if (ctx.message.text.match("@") === null) {
      ctx.reply("Fiddlesticks! That's not a valid email address. Breathe in slowly and try again :)");
      return;
    }
    ctx.wizard.state.contactData.email = ctx.message.text;
    ctx.reply(CC_MESSAGE);
    return ctx.wizard.next();
  },
  // Pipe first name, last name and email into the account generator script
  async (ctx) => {
    // Email validation
    if (ctx.message.text.match("@") === null) {
      ctx.reply("Fiddlesticks! That's not a valid email address. Breathe in slowly and try again :)");
      return;
    }
    ctx.wizard.state.contactData.cc = ctx.message.text;
    await ctx.reply("Thank you for your replies, I'll create your LobVR account now");
    await ctx.reply("Please hang on tight for 1 or 2 minutes, I'm doing some extremely complex ML stuff... I'll let you know when I'm done :)");

    let { fName, lName, email, cc } = ctx.wizard.state.contactData;
    let { firstName, lastName, personalEmail, ccEmail, lobvrEmail, lobvrPass } = formatContactData([fName, lName, email, cc])

    await ctx.reply("Creating LobVR account now...");
    await createEmailAccount(firstName, lastName, lobvrEmail, lobvrPass)

    await ctx.reply("Done! Inviting to ClickUp now...");
    await inviteToClickup(lobvrEmail)

    await ctx.reply("Done! Sending confirmation email now...");
    await sendConfirmationEmail(lobvrEmail, lobvrPass, personalEmail, ccEmail, firstName)

    await ctx.reply("done!");
    await ctx.reply(`I created the account ${lobvrEmail} for our new team member ${fName} ${lName}!`);
    await ctx.reply("k thx byeeeeeeeeee")

    return ctx.scene.leave();
  },
);

// Register the wizard scenes previously created
const stage = new Stage();
stage.register(contactDataWizard)
stage.register(fetchAvailableDatesWizard)

// to  be precise, session is not a must have for Scenes to work, but it sure is lonely without one
const store = new Map();
bot.use(session({ store }));
bot.use(stage.middleware());

// Log incoming message and its sender
bot.use(async (ctx, next) => {
  const start = new Date()
  await next()
  const response_time = new Date() - start
  const chat_from = `${ctx.message.chat.first_name} (id: ${ctx.message.chat.id})`
  console.log(`Chat from ${chat_from} (Response Time: ${response_time})`);
});

// This will be executed when the user inputs the command /start
bot.start((ctx) => {
  // Clear session to avoid data overlaps with previous session
  ctx.session = null;
  store.clear();
  // Greet user
  ctx.reply(WELCOME_MESSAGE)
    .then(() => ctx.scene.enter("CONTACT_DATA_WIZARD_SCENE_ID"));
});

bot.action(new RegExp(ACTION_FETCH_AVAILABLE_DATES + "_+", "g"), (ctx) => {
  var relativeUrl = ctx.match.input.substring(ACTION_FETCH_AVAILABLE_DATES.length + 1);
  console.log("YOOOOOOO, THIS IS THE CONTEXT AFTER PRESSING A BUTTON DAWG!: " + `${BDX_REFUGES_URL}/${relativeUrl}`);
  ctx.reply("This is the result you chose: " + `${BDX_REFUGES_URL}/${relativeUrl}`);

  return ctx.scene.enter(`${ACTION_FETCH_AVAILABLE_DATES}_WIZARD_SCENE_ID`, { refugeUrl: `${BDX_REFUGES_URL}/${relativeUrl}` });
})

module.exports = bot;