const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const ReservationSchema = require("./reservation").schema

const refugeSchema = new Schema({
    name: { type: String, required: true },
    url: { type: String, required: true },
    availableDates: [String],
    wantedDates: [String],
    reservation: ReservationSchema,
    reservationUrls: [String],
    chatId: Number
})

const Refuge = mongoose.model("Refuge", refugeSchema);

module.exports = Refuge;