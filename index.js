require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const { configuration } = require("./config/jwt-config");
const cors = require('cors');
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const router = require("./src/routes/index");

app.use(
  "/",
  configuration.unless({
    path: ["/auth", '/auth/register'],
  }),
  cors({
    origin: '*'
  }),
  router
);


const dbUser = process.env.DB_USER;
const dbPassword = process.env.DB_PASSWORD;

mongoose
  .connect(
    `mongodb+srv://${dbUser}:${dbPassword}@unixjwt.8olc586.mongodb.net/prod?retryWrites=true&w=majority`
  )
  .then(() => {
    app.listen(8080, () => {
      console.log("Conectou ao Banco 👍");
    });
  })
  .catch((err) => console.log(err));
