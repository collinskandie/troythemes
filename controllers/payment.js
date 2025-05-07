const axios = require("axios");
// const { saveBase64Image } = require("./savefile");
const { v4: uuidv4 } = require("uuid");
const fs = require("fs");
const path = require("path");
const { Transaction } = require("../models");
const Order = require("../models/order");
const DATA_FILE = path.join(__dirname, "../data/payments.json");

const MPESA_PAYBILL = 4083313;
const MPESA_PASSKEY =
  "8531669c50b3e21bf912c8919dede2c4d0a8e40cd5e0b69eb968b42704c54808";
const MPESA_CONSUMER_KEY = "3FiOGz5XHM1pzC0Y7E4SZtGaL4xT5IT9";
const MPESA_CONSUMER_SECRET = "2e1ZAH1u2GgYxxr2";
// Function to read existing data
const readData = () => {
  if (!fs.existsSync(DATA_FILE)) return [];
  const data = fs.readFileSync(DATA_FILE, "utf8");
  return data ? JSON.parse(data) : [];
};

// Function to save data
const saveData = (data) => {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf8");
};

async function generateToken() {
  try {
    const secret = MPESA_CONSUMER_SECRET;
    const consumerKey = MPESA_CONSUMER_KEY;
    const auth = Buffer.from(`${consumerKey}:${secret}`).toString("base64");

    const response = await axios.get(
      "https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials",
      // "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials",
      {
        headers: {
          Authorization: `Basic ${auth}`,
        },
      }
    );
    return response.data.access_token;
  } catch (error) {
    console.error("Error generating token:", error.message);
    // console.log(error);
    throw new Error("Failed to generate M-Pesa token");
  }
}
async function newMpesa(cost, invoiceno, mpesano, selected_package) {
  try {
    const token = await generateToken();
    const transid = "TRANS-" + uuidv4().slice(0, 8).toUpperCase();
    const mpesa_no = mpesano.substring(1);
    // const amount = parseInt(cost.replace(/,/g, ""), 10);
    const amount = parseInt(cost.replace(/,/g, ""), 10);
    if (isNaN(amount)) throw new Error("Invalid cost value");

    // Create initial transaction record
    const transaction = {
      TransactionStatus: "pending",
      phone: mpesa_no,
      totalAmount: amount,
      invoiceId: invoiceno,
      transId: transid,
      TransactionDate: new Date(),
    };
    // Save transaction to the database
    const newTrans = await Transaction.create(transaction);
    console.log("Transaction created:", newTrans);

    const date = new Date();
    const timestamp =
      date.getFullYear() +
      ("0" + (date.getMonth() + 1)).slice(-2) +
      ("0" + date.getDate()).slice(-2) +
      ("0" + date.getHours()).slice(-2) +
      ("0" + date.getMinutes()).slice(-2) +
      ("0" + date.getSeconds()).slice(-2);

    const shortcode = MPESA_PAYBILL;
    const passkey = MPESA_PASSKEY;
    const till = MPESA_PAYBILL;

    const password = Buffer.from(shortcode + passkey + timestamp).toString(
      "base64"
    );
    const mpesaResponse = await axios.post(
      // "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest",
      "https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest",
      {
        BusinessShortCode: shortcode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: "CustomerPayBillOnline",
        Amount: amount,
        PartyA: `254${mpesa_no}`,
        PartyB: till,
        PhoneNumber: `254${mpesa_no}`,
        CallBackURL: "https://troyhost.troycityafrica.com/api/callback",
        AccountReference: `${invoiceno}`,
        TransactionDesc: `Payment of ${selected_package}`,
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    console.log("M-Pesa API response:", mpesaResponse.data);

    // Extract M-Pesa details
    const { MerchantRequestID, CheckoutRequestID, ResponseCode } =
      mpesaResponse.data;

    if (ResponseCode !== "0") {
      return { success: false, message: "M-Pesa request failed" };
    }

    const updatedTransaction = await Transaction.update(
      {
        paymentStatus: "pending",
        MerchantRequestID: MerchantRequestID,
        CheckoutRequestID: CheckoutRequestID,
      },
      {
        where: { invoiceId: invoiceno },
      }
    );

    console.log("Transaction updated:", updatedTransaction);

    return {
      success: true,
      message: "Payment request in progress",
      transactionId: transid,
      MerchantRequestID,
      CheckoutRequestID,
    };
  } catch (error) {
    console.error("Error while making M-Pesa request:", error);
    return {
      success: false,
      message: "Payment request failed. Please try again.",
    };
  }
}

async function confirmPayment(req, res) {
  try {
    // Get the transaction ID from the request parameters
    const transid = req.params.Id;
    const transaction = await Transaction.findByPk(transid);

    // Check if the transaction exists
    if (transaction) {
      const transStatus = transaction.status;
      const transReference = transaction.trans_id;
      console.log(transReference);
      console.log(transStatus);

      // Respond with a success status and transaction details
      res.status(200).json({
        success: true,
        transactionId: transid,
        status: transStatus,
        reference: transReference,
      });
    } else {
      // Handle the case where the transaction doesn't exist
      res.status(404).json({
        success: false,
        message: "Transaction not found",
      });
    }
  } catch (error) {
    console.error(error);
    // Log the error message or stack trace
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
}
async function mpesaCallBack(req, res) {
  const callbackdata = req.body;
  let status = "";
  let amount = "";
  let trans_id = "";
  let phone = "";
  if (!callbackdata.Body.stkCallback.CallbackMetadata) {
    console.log(callbackdata.Body.stkCallback);
    status = "Error";
    trans_id = callbackdata.Body.stkCallback;
    res.json("ok");
  } else {
    const body = callbackdata.Body.stkCallback.CallbackMetadata;
    amount = callbackdata.Body.stkCallback.CallbackMetadata.Item[0].Value;
    trans_id = callbackdata.Body.stkCallback.CallbackMetadata.Item[1].Value;
    trans_date = callbackdata.Body.stkCallback.CallbackMetadata.Item[2].Value;
    phone = callbackdata.Body.stkCallback.CallbackMetadata.Item[3].Value;
    status = "Success";
    latestTrans;
  }
  updateTransaction(status, latestTrans, trans_id);
}
async function savePayment(req, res) {
  try {
    // console.log(req.body.cartItems);
    // console.log(req.body);
    var customizationItems = req.body.customization;
    const user = generateInvoiceNumber();
    const {
      first_name,
      last_name,
      county,
      address,
      apartment,
      town_city,
      street,
      post_code,
      phone,
      email,
      payment_method,
      mpesa_confirmation,
      cartItems,
      total,
    } = req.body;
    const items = cartItems;
    const new_amount = total;

    const billing_address = await billingAdress(
      first_name,
      last_name,
      county,
      address,
      apartment,
      town_city,
      post_code,
      phone,
      email,
      user,
      payment_method
    );
    // console.log(billing_address);

    const invoiceNumber = await generateInvoiceNumber();
    createSale(user, items, invoiceNumber, new_amount);
    createReceiptItems(items, invoiceNumber, mpesa_confirmation);
    // save cust details
    createCustomization(customizationItems, invoiceNumber);
    const payment_status = savePaymentDetails(
      mpesa_confirmation,
      new_amount,
      phone,
      invoiceNumber,
      payment_method
    );
    const invoiceDate = Date.now();
    sendInvoice(items, email, total, invoiceNumber, invoiceDate);
    res.status(201).json({
      success:
        "Payment successfully recieved, we are going to review and call you back",
      payment_status,
      user,
    });
  } catch (error) {
    console.error(error);
    console.error(error.data);
    res.status(500).json(error.data);
  }
}
async function createReceiptItems(items, invoiceNumber) {
  try {
    for (const item of items) {
      const receiptItem = await ReceiptItem.create({
        productId: item.productId,
        cost: parseFloat(item.price),
        quantity: item.quantity,
        invoiceNumber: invoiceNumber,
      });
      await receiptItem.save();
      console.log(`ReceiptItem created for product ID ${item.productId}`);
    }
    console.log("All ReceiptItems created and saved successfully.");
  } catch (error) {
    console.error(`Error creating ReceiptItems: ${error.message}`);
  }
}
// async function createCustomization(customizationItems, invoiceNumber) {
//   try {
//     for (const item of customizationItems) {
//       var base64Image = customizationItems.newImages;
//       // Save the base64 image and get the file name
//       const savedImageName = saveBase64Image(base64Image);
//       const customization = await Customization.create({
//         productId: item.productId,
//         customization: item.customization,
//         invoiceNumber: invoiceNumber,
//         imageUrl: savedImageName, // Assuming you have a field to store the image URL or name
//       });
//       await customization.save();
//       console.log(`Customization created for product ID ${item.productId}`);
//     }
//     console.log("All Customization created and saved successfully.");
//   } catch (error) {
//     console.error(`Error creating Customization: ${error.message}`);
//   }
// }
function updateTransaction(status, latestTrans, trans) {
  Transaction.update(
    {
      status: status,
      trans_id: trans,
    },
    {
      where: {
        id: latestTrans,
      },
    }
  )
    .then(([updatedCount, updatedRows]) => {
      if (updatedCount > 0) {
        console.log(
          `Updated ${updatedCount} transaction(s) with id ${latestTrans} and phone ${phone}`
        );
        // Do something on successful update
      } else {
        console.log(`No transactions found with id ${latestTrans}`);
        // Handle the case where no matching transactions were found
      }
    })
    .catch((error) => {
      console.error("Error updating transaction:", error);
      // Handle the error
    });
}

async function createSale(user, items, invoiceNumber, totalCost) {
  try {
    const itemsCount = items.length;
    const sale = await Sale.create({
      itemsCount,
      totalCost,
      user,
      invoiceNumber,
    });
    // Get the generated invoiceNumber from the database
    const generatedInvoiceNumber = sale.getDataValue("invoiceNumber");

    console.log(
      `Sale entry created with invoice number: ${generatedInvoiceNumber}`
    );
    // Return the generated invoice number
    return generatedInvoiceNumber;
  } catch (error) {
    console.error(`Error creating sale entry: ${error.message}`);
    throw error;
  }
}
function generateInvoiceNumber() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");

  // Generate a random number between 1000 and 9999
  const randomPart = Math.floor(Math.random() * 9000) + 1000;
  // Combine date/time and random part to create the invoice number
  const invoiceNumber = `${year}${month}${day}${hours}${minutes}${seconds}${randomPart}`;

  return invoiceNumber;
}

async function newCard(req, res) {
  try {
    console.log(req.body);

    return res.json(201);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error addding customer" });
  }
}
// async function saveDispatch(req, res) {
//   try {
//     const { invoiceNumber, deliveryPersonName, description, images } = req.body;
//     const imageFilenames = [];
//     const newStatus = "dispatched";

//     if (req.body.images) {
//       for (const image of images) {
//         const imageData = image;
//         const newImageName = await saveBase64Image(imageData);
//         imageFilenames.push(newImageName);
//       }
//     }
//     const sale = await Sale.findByPk(invoiceNumber);
//     sale.status = newStatus;

//     // Save the changes
//     await sale.save();

//     const newDispatch = await Dispatch.create({
//       invoiceNumber: invoiceNumber,
//       deliveryPersonName: deliveryPersonName,
//       description: description,
//       imageURL: imageFilenames,
//     });

//     return res.status(201).json({
//       success: true,
//       message: "Items Successfully dispatched",
//       product: newDispatch,
//     });
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ error: "Error saving dispatch" });
//   }
// }
async function getDispatch(req, res) {
  try {
    const invoice = req.params.invoiceId;
    const dispatch = await Dispatch.findOne({
      where: { invoiceNumber: invoice },
    });
    console.log(dispatch);

    if (dispatch) {
      return res.status(200).json({
        data: dispatch,
        success: true,
      });
    } else {
      return res.status(404).json({
        success: false,
        message: "Dispatch not found",
      });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
}
async function savePaymentDetails(
  trans_id,
  amount,
  phone,
  invoiceNumber,
  paymentMethod
) {
  try {
    const payment = new Payments();
    payment.referenceNumber = trans_id;
    payment.invoiceTotal = amount;
    payment.accountNumber = phone;
    payment.invoiceNumber = invoiceNumber;
    payment.paymentMethod = paymentMethod;

    payment
      .save()
      .then((data) => {
        console.log(data);
        return {
          status: "success",
          message: `Payment successful, ${trans_id}`,
          payment,
        };
      })
      .catch((error) => {
        console.log(error);
      });
  } catch (error) {
    console.error(error);
    return {
      error: "Internal server error",
      status: 500,
    };
  }
}
module.exports = {
  newMpesa,
  newCard,
  mpesaCallBack,
  getDispatch,
  savePayment,
  confirmPayment,
};
