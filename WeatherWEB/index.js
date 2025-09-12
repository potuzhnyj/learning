import express from "express";
import axios from "axios";
import bodyParser from "body-parser";
import "@dotenvx/dotenvx/config";

const app = express();
const port = 3000;
const API = process.env.API;

app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended: true }));

app.get("/", (req, res) => {
  res.render("index.ejs");
});

app.post("/city", async (req, res) => {
  const cityId = req.body.city;
  try {
    const response = await axios.get(
      `http://api.weatherapi.com/v1/forecast.json?key=${API}&q=${cityId}&days=8`
    );
    const current_location = response.data.location;
    const forecast = response.data.forecast.forecastday;
    res.render("index.ejs", {
      location: current_location,
      forecast: forecast,
    });
  } catch (error) {
    console.log(error.message);
  }
});

app.listen(port, () => {
  console.log(`Weather app listening on port ${port}`);
});
