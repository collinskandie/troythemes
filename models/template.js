module.exports = (sequelize, DataTypes) => {
  const Template = sequelize.define("Template", {
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    category: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    cost: {
      type: DataTypes.FLOAT,
      allowNull: true,
      unique: false,
      defaultValue: 0.0,
    },
    image: {
      type: DataTypes.STRING,
    },
    previewPath: {
      type: DataTypes.STRING,
    },
    zipPath: {
      type: DataTypes.STRING,
    },
    downloads: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
  });

  return Template;
};
