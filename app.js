// app.js
var createError = require("http-errors");
var express = require("express");
var path = require("path");
require("dotenv").config();
var cookieParser = require("cookie-parser");
var logger = require("morgan");
var indexRouter = require("./routes/index");
var usersRouter = require("./routes/authRoutes");
var cartRouter = require("./routes/cart");
const templateRoutes = require("./routes/templates");
const expressLayouts = require("express-ejs-layouts");
const session = require("express-session");

var cors = require("cors");
var app = express();
const { Sequelize } = require("sequelize");
// view engine setup

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

const { sequelize } = require("./models");
// sequelize.sync().then(() => console.log("✅ DB Synced"));
sequelize
  .sync({ alter: true })
  .then(() => console.log("✅ DB Synced with Alter"));
sequelize
  .authenticate()
  .then(() => {
    console.log("✅ DB Connected");
  })
  .catch((err) => {
    console.error("❌ DB Connection Error: ", err);
  });
app.use(
  session({
    secret: process.env.SESSION_SECRET || "secretkey",
    resave: false,
    saveUninitialized: false,
    cookie: { secure: process.env.SECURE }, // set secure: true if using HTTPS
  })
);
app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));
app.use("/templates", templateRoutes);

// app.use("/preview-files", express.static(path.join(__dirname, "uploads")));
app.use("/", indexRouter);
app.use("/cart", cartRouter);
app.use("/users", usersRouter);

app.use(cors());

// Set EJS as the view engine
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(expressLayouts);
app.set("layout", "layout"); // layout.ejs will be the layout
// Serve static files
app.use(express.static("public"));

// catch 404 and forward to error handler
app.use((req, res) => {
  res.status(404).render("404", { message: "Page not found" });
});

const port = process.env.PORT || 5000;

// app.listen(port, () => {
//   console.log(`Server is running on port ${port}`);
// });

// error handler
app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  console.log("Locals: ", res.locals);
  res.locals.message = err.message;
  res.locals.error = req.app.get("env") === "development" ? err : {};

  // render the error page
  res.status(err.status || 500);
  console.log(`${req.method} ${req.url} - ${err.message}`);
  res.status(500).json({ error: "Internal Server Error" });
});

module.exports = app;
