import express from "express";
import bodyParser from "body-parser";
import pg from "pg";

const app = express();
const port = 3000;

const db = new pg.Client({
  user: "postgres",
  host: "localhost",
  database: "world",
  password: "123456",
  port: 5432,
});
db.connect();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

async function checkVisited() {
  const result = await db.query("SELECT country_code FROM visited_countries");
  let countries = [];
  result.rows.forEach((country) => {
    countries.push(country.country_code);
  });
  return countries;
}
// GET home page
app.get("/", async (req, res) => {
  const countries = await checkVisited();
  res.render("index.ejs", { countries: countries, total: countries.length });
});

app.post("/add", async (req, res) => {
  const countries = await checkVisited();
  var newOne = req.body["country"];

  if (newOne.length > 1) {
    let capFirstLetter = newOne[0].toUpperCase();
    let restOfGreeting = newOne.slice(1).toLowerCase();
    newOne = capFirstLetter + restOfGreeting;

    const code = await db.query(
      "SELECT country_code FROM countries WHERE country_name = $1",
      [newOne]
    );
    if (code.rows.length !== 0) {
      const data = code.rows[0];
      console.log(code);
      let already = countries.includes(data.country_code);

      if (already === false) {
        await db.query(
          "INSERT INTO visited_countries(country_code) VALUES ($1)",
          [data.country_code]
        );
        res.redirect("/");
      } else {
        res.render("index.ejs", {
          countries: countries,
          total: countries.length,
          error: "Country has already been added, try again.",
        });
      }
    } else {
      res.render("index.ejs", {
        countries: countries,
        total: countries.length,
        error: "Country name does not exist, try again.",
      });
    }
  } else {
    res.render("index.ejs", {
      countries: countries,
      total: countries.length,
      error: "Please write some country before trying to add it.",
    });
  }
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
