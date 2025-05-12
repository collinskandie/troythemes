module.exports = (sequelize, DataTypes) => {
  const Order = sequelize.define("Order", {
    templateId: {
      type: DataTypes.INTEGER,
      allowNull: true, // required if you're using SET NULL
      references: {
        model: "Templates",
        key: "id",
      },
      onDelete: "SET NULL", // or "CASCADE"
    },
    hostingId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    invoiceId: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    fullName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    phone: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    paymentMethod: {
      type: DataTypes.ENUM("mpesa", "card", "paypal"),
      allowNull: false,
      defaultValue: "mpesa",
    },
    totalAmount: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },
    paymentStatus: {
      type: DataTypes.ENUM("pending", "paid", "failed"),
      defaultValue: "pending",
    },
    orderStatus: {
      type: DataTypes.ENUM("pending", "completed", "cancelled"),
      defaultValue: "pending",
    },
    orderDate: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  });

  return Order;
};
