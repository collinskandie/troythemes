// models/index.js
const { Sequelize } = require("sequelize");
const fs = require("fs");
const path = require("path");
require("dotenv").config();
const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    dialect: "mysql",
    logging: false,
  }
);
const db = {};
// Dynamically import all models in the `models` folder
fs.readdirSync(__dirname)
  .filter((file) => file !== "index.js" && file.endsWith(".js"))
  .forEach((file) => {
    const model = require(path.join(__dirname, file))(
      sequelize,
      Sequelize.DataTypes
    );
    db[model.name] = model;
  });

// Apply associations if defined
Object.keys(db).forEach((modelName) => {
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
});
// Add your associations here AFTER models are loaded
// if (db.Order && db.Template) {
//   db.Order.belongsTo(db.Template, { foreignKey: "templateId" });
// }
db.Order.belongsTo(db.Template, {
  foreignKey: "templateId",
  onDelete: "SET NULL", // or "CASCADE", depending on what you prefer
  hooks: true,
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;
module.exports = db;
