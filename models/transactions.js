module.exports = (sequelize, DataTypes) => {
  const Transaction = sequelize.define("Transaction", {
    invoiceId: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    transId: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    phone: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    MerchantRequestID: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    CheckoutRequestID: {
      type: DataTypes.STRING,
      allowNull: true,
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
    TransactionStatus: {
      type: DataTypes.ENUM("pending", "completed", "cancelled"),
      defaultValue: "pending",
    },
    TransactionDate: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  });

  return Transaction;
};
