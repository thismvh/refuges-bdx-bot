// BOT CONSTANTS
// Refuges website
const BDX_REFUGES_URL = "https://lesrefuges.bordeaux-metropole.fr";

// SCENE NAMES
const LIST_REFUGES_SCENE = "LIST_REFUGES_SCENE"
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
const WELCOME_MESSAGE = `Coucou, j'ai entendu tu veux réserver un refuge? ${GRIN}`;
const CHIANT_CHECK_REFUGES = `Mais pfff, c'est chiant d'aller à la site web tout le temps pour voir s'il y a des places, non? ${ROLLING_EYES}`
const TINQUIETE_JY_VAIS = `T'inquièèèèète, j'y vais à ta place et quand je vois des places disponibles je t'envoie un message et puis tu peux être la première à réserver ${WINK}`
const WHICH_REFUGE_MESSAGE = `Quel refuge est-ce que tu veux réserver?`;
const GOING_TO_SLEEP = `Ok, je vais faire dodo alors ${SLEEPING_FACE} Réveille-moi en écrivant /start dans ce chat ou en appuyant sur les /start bleus. Tschuuuus! ${WAVING_HAND}`

// Bot actions
const ACTION_FETCH_AVAILABLE_DATES = "FETCH_DATES";
const ACTION_MORE_REFUGES = "MORE_REFUGES";


// SCRAPER CONSTANTS
const DATA_DIR_PATH = "./data"
const DATA_FILE_NAME = "refuges.json"

module.exports = {
    BDX_REFUGES_URL,
    LIST_REFUGES_SCENE,
    MORE_REFUGES_SCENE,
    GRIN,
    BROKEN_HEART,
    ROLLING_EYES,
    WINK,
    PARTYING_FACE,
    SLEEPING_FACE,
    WAVING_HAND,
    WELCOME_MESSAGE,
    CHIANT_CHECK_REFUGES,
    TINQUIETE_JY_VAIS,
    WHICH_REFUGE_MESSAGE,
    GOING_TO_SLEEP,
    ACTION_FETCH_AVAILABLE_DATES,
    ACTION_MORE_REFUGES,
    DATA_DIR_PATH,
    DATA_FILE_NAME
}