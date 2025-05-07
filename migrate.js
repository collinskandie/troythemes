const { sequelize } = require("./models");

sequelize
  .sync({ force: false })
  .then(() => {
    console.log("Tables synced.");
    process.exit();
  })
  .catch((err) => {
    console.error("Error syncing tables:", err);
    process.exit(1);
  });
