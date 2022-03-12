const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const refugeSchema = new Schema({
    name: { type: String, required: true },
    url: { type: String, required: true },
    availableDates: { type: [String], required: true },
    wantedDates: { type: [String], required: true }
})

const Refuge = mongoose.model("Refuge", refugeSchema);

module.exports = Refuge;