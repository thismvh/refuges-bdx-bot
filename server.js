require('dotenv').config();

const mongoose = require("mongoose");
const Refuge = require("./models/refuge");
const { MONGO_DB_URI } = require("./constants");

const express = require("express");
const Reservation = require('./models/reservation');
const app = express();

app.use(express.json())

const port = process.env.PORT || 3000
mongoose.connect(MONGO_DB_URI)
  .then(() => app.listen(port, () => console.log(`Listening on port ${port}`)))
  .catch((err) => console.log(err))

app.get("/", (req, res) => {
  res.send("Hello World!")
})

app.get("/refuges/:name", (req, res) => {
  const filter = { name: req.params.name }
  Refuge.findOne(filter)
    .then((updatedRefuge) => {
      console.log()
      res.send(updatedRefuge)
    })
    .catch((err) => res.send(err))
})

app.post("/refuges", (req, res) => {
  console.log(req.body)
  const refuge = new Refuge(req.body)

  refuge.save()
    .then((newRefuge) => res.send(newRefuge))
    .catch((err) => res.send(err))
})

app.patch("/refuges/:name", async (req, res) => {
  console.log(req.body)
  const filter = { name: req.params.name };
  const update = req.body;

  if(update.reservation !== undefined) {
    var newReservation = await new Reservation(update.reservation);
    await newReservation.save();
    update.reservation = newReservation;
  }
  
  Refuge.findOneAndUpdate(filter, update, { new: true, upsert: true })
    .then((updatedRefuge) => {
      console.log()
      res.send(updatedRefuge)
    })
    .catch((err) => res.send(err))
})

app.get("/all-refuges", (req, res) => {
  Refuge.find()
    .then((allRefuges) => res.send(allRefuges))
    .catch((err) => console.log(err))
})