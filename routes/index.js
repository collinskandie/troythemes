// routes/index.js
const express = require("express");
const router = express.Router();
const path = require("path");
const { Template, Transaction, Order } = require("../models");
const { Op } = require("sequelize");
const nodemailer = require("nodemailer");
const { v4: uuidv4 } = require("uuid");
const { generateInvoice } = require("../controllers/main");
const { newMpesa } = require("../controllers/payment");
const fs = require("fs");

const EMAIL_HOST = "mail.troycityafrica.com";
const EMAIL_PORT = 465;
const EMAIL_USER = "troyhost@troycityafrica.com";
const EMAIL_PASS = "!9OFkB)KH(9S";
const EMAIL_SECURE = true; // true for 465, false for other ports
// const EMAIL_FROM = "troyhost@troycityafrica.com";

transporter = nodemailer.createTransport({
  host: EMAIL_HOST,
  port: EMAIL_PORT,
  secure: EMAIL_SECURE, // true for 465, false for other ports
  auth: {
    user: EMAIL_USER,
    pass: EMAIL_PASS,
  },
});

/* GET home page. */
router.get("/", async (req, res) => {
  try {
    const { name, category, minPrice, maxPrice } = req.query;

    // Build the filter object dynamically
    const filters = {};
    if (name) {
      filters.name = { [Op.like]: `%${name}%` }; // Use LIKE for MySQL
    }

    if (category) {
      filters.category = category;
    }
    if (minPrice || maxPrice) {
      filters.cost = {};
      if (minPrice) filters.cost[Op.gte] = parseFloat(minPrice);
      if (maxPrice) filters.cost[Op.lte] = parseFloat(maxPrice);
    }

    const templates = await Template.findAll({ where: filters });
    // if (!templates.length)
    //   return res.status(404).send("No templates match the search criteria.");

    res.render("index", { templates });
  } catch (error) {
    console.error("Error fetching templates:", error);
    res.status(500).send("Server Error");
  }
});

// Serve preview files correctly from /public/themes
router.use(
  "/preview",
  express.static(path.join(__dirname, "../public/themes"))
);

router.get("/api/template/:id", async (req, res) => {
  const { id } = req.params;
  console.log("ID: ", id);
  const template = await Template.findByPk(id);
  if (!template) return res.status(404).send("Template not found");

  res.json({ template: template });
});

router.get("/preview/:id/:templateName/*", async (req, res, next) => {
  const { id, templateName } = req.params;
  const filePath = req.params[0]; // captures the rest of the URL after /preview/:id/:templateName/

  const template = await Template.findByPk(id);
  if (!template)
    return res.status(404).render("404", { message: "Template not found" });

  const baseDir = path.join(__dirname, "../public", template.previewPath);
  const fullFilePath = path.join(baseDir, filePath);

  // Prevent directory traversal
  if (!fullFilePath.startsWith(baseDir)) {
    return res.status(403).send("Forbidden");
  }

  // Check if file exists
  if (!fs.existsSync(fullFilePath)) {
    return res.status(404).render("404", { message: "Preview file not found" });
  }

  res.sendFile(fullFilePath);
});

router.get("/preview/:id", async (req, res) => {
  const { id } = req.params;
  const template = await Template.findByPk(id);
  console.log("Template: ", template);
  if (!template) return res.status(404).send("Template not found");

  res.render("preview", { template: template });
});

router.get("/checkout", async (req, res) => {
  const selectedTemplate = req.query.templateId;
  const selectedPlan = req.query.planName;
  const planPrice = req.query.planPrice;

  // Fetch the template details
  const template = await Template.findByPk(selectedTemplate);

  if (!template) {
    return res.status(404).send("Template not found.");
  }

  res.render("checkout", {
    template,
    plan: selectedPlan,
    price: planPrice,
  });
});

router.post("/complete-purchase", async (req, res) => {
  try {
    const {
      templateId,
      hostingId,
      fullName,
      // selectedPlan,
      email,
      phone,
      totalPrice,
      paymentMethod,
    } = req.body;

    console.log("Request body:", req.body);

    const invoiceId = "INV-" + uuidv4().slice(0, 8).toUpperCase();

    const order = await Order.create({
      templateId,
      hostingId: hostingId || null,
      invoiceId,
      fullName,
      email,
      phone,
      paymentMethod,
      totalAmount: totalPrice,
      paymentStatus: "pending",
      orderStatus: "pending",
      orderDate: new Date(),
    });
    const selectedPlanRaw = req.body.selectedPlan;
    let selectedPlan = {};
    let planPrice = 0;
    let items = [];

    if (selectedPlanRaw) {
      selectedPlan = JSON.parse(selectedPlanRaw);
      planPrice = parseFloat((selectedPlan.price || "0").replace(/,/g, ""));
      items.push({
        description: selectedPlan.name,
        amount: planPrice,
      });
      //add domain plans cost
      if (hostingId) {
        items.push({
          description: "Domain free " + order.domainName,
          amount: 0,
        });
      }
    }
    // find template details by id
    const template = await Template.findByPk(templateId);
    if (!template) {
      return res.status(404).send("Template not found.");
    }
    // add tenplate cost to items
    items.push({
      description:
        template.name +
        " - " +
        template.category +
        " - " +
        template.description,
      amount: parseFloat(template.cost),
    });

    const invoiceData = {
      invoiceId: invoiceId,
      invoiceDate: order.orderDate,
      dueDate: order.orderDate,
      status: "UNPAID",
      name: order.fullName,
      customerEmail: order.email,
      // customerLocation: order.address,
      items: items,
      total: order.totalAmount,
      balance: order.totalAmount,
      transactions: [],
      message: "Thank you for your order",
    };

    // send invoice via mail
    generateInvoice(invoiceData);

    // create invoice and send email to user
    res.render("complete-order", { order: order });

    // res.status(201).json({ message: "Order placed", order });
  } catch (error) {
    console.error("Error creating order:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/payment", async (req, res) => {
  try {
    const { invoiceId, amount, phone } = req.body;
    const order = Order.findAll({
      where: {
        invoiceId: invoiceId,
      },
    });

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }
    // call the mpesa function
    // console.log("Order phone:", phone);
    const mpesa = await newMpesa(amount, invoiceId, phone, order.invoiceId);

    if (mpesa.success) {
      return res.json({
        success: true,
        message: "Payment Initiated Successfully!",
        transactionId: mpesa.transactionId,
        MerchantRequestID: mpesa.MerchantRequestID,
        CheckoutRequestID: mpesa.CheckoutRequestID,
      });
    } else {
      return res.json({ success: false, message: "Payment Failed!" });
    }
  } catch (error) {
    console.log(error);
  }
});

// Route to check payment status
router.get("/check-payment/:invoiceId", async (req, res) => {
  const { invoiceId } = req.params;

  const transaction = await Transaction.findOne({
    where: {
      invoiceId: invoiceId,
    },
  });
  if (!transaction) {
    return res.status(404).json({ error: "Transaction not found" });
  }

  // Check if payment is successful
  if (transaction.paymentStatus === "paid") {
    return res.json({
      success: true,
      status: "completed",
      message: "Payment successful",
      data: transaction,
    });
  } else if (transaction.paymentStatus === "failed") {
    return res.json({
      success: false,
      status: "failed",
      message: "Payment failed",
      data: transaction,
    });
  } else if (transaction.paymentStatus === "pending") {
    return res.json({
      success: false,
      status: "pending",
      message: "Payment still pending",
      data: transaction,
    });
  }
});
router.get("/update-invoice/:invoiceId", (req, res) => {
  const { invoiceId } = req.params;
  const orders = readData();
  const order = orders.find((o) => o.invoiceId === invoiceId);

  if (!order) {
    return res.status(404).json({ error: "order not found" });
  }

  const invoiceData = {
    invoiceId: order.invoiceId,
    invoiceDate: order.date,
    dueDate: order.date,
    status: "PAID",
    name: order.name,
    customerEmail: order.email,
    customerLocation: order.address,
    items: [
      { description: order.selected_package, amount: order.package_cost },
      { description: `Domain free ${order.domainName}`, amount: 0 },
    ],
    total: order.package_cost,
    balance: 0,
    transactions: [],
    message: "Payment successful",
  };
  // send invoice via mail
  generateInvoice(invoiceData);

  // Check if payment is successful
  if (payment.status === "completed") {
    return res.json({
      success: true,
      status: "completed",
      message: "Payment successful",
      data: payment,
    });
  }

  // If payment is still pending
  return res.json({
    success: false,
    status: "pending",
    message: "Payment still pending",
    data: payment,
  });
});

// Function to update transaction
const updateTransaction = (status, phone, trans_id, trans_date, amount) => {
  try {
    let transactions = readInvoiceData();
    let transaction = transactions.find((t) => t.phone === phone);

    if (transaction) {
      transaction.status = status;
      transaction.trans_id = trans_id;
      transaction.trans_date = trans_date;
      transaction.amount = amount;
    }

    // Save updated transactions
    fs.writeFileSync(dataFilePath, JSON.stringify(transactions, null, 2));
    console.log("Transaction updated successfully");
  } catch (error) {
    console.error("Error updating transaction:", error);
  }
};

router.get("/payment-sucess/:invoiceId", async (req, res) => {
  try {
    const invoiceId = req.params.invoiceId || req.query.invoiceId;

    const order = await Order.findAll({
      where: {
        invoiceId: invoiceId,
      },
    });

    if (order.length === 0) {
      return res.status(404).json({ error: "Order not found" });
    }

    const orderData = order[0]; // get the first matching order
    console.log("Order: ", orderData);
    console.log("templateId: ", orderData.templateId);

    const template = await Template.findByPk(orderData.templateId);
    if (!template) {
      return res.status(404).send("Template not found.");
    }

    const invoiceData = {
      invoiceId: orderData.invoiceId,
      invoiceDate: orderData.orderDate,
      dueDate: orderData.orderDate,
      status: "PAID",
      name: orderData.fullName,
      customerEmail: orderData.email,
      customerLocation: orderData.address,
      items: [
        { description: template.name, amount: orderData.totalAmount },
        { description: `Domain free ${order.domainName}`, amount: 0 },
        { description: order.selectedPlan, amount: orderData.planPrice },
      ],
      total: orderData.totalAmount,
      balance: 0,
      transactions: [],
      message: "Payment successful",
    };

    // Generate and send invoice via email
    generateInvoice(invoiceData);
    if (order.status === "completed") {
      return res.json({
        success: true,
        status: "completed",
        message: "Payment successful",
        data: order,
        template: template,
      });
    }

    // Render success page
    res.render("payment-sucess");
  } catch (error) {
    console.error("Error processing payment:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});
// Callback Route
router.post("/callback", (req, res) => {
  try {
    const callbackData = req.body;
    let status, amount, trans_id, trans_date, phone;

    if (!callbackData.Body.stkCallback.CallbackMetadata) {
      console.log("M-Pesa Callback Error:", callbackData.Body.stkCallback);
      status = "Error";
      trans_id = callbackData.Body.stkCallback.MerchantRequestID || "Unknown";
      res.json({ message: "Received error callback" });
      return;
    }

    // Extracting data from callback
    const metadata = callbackData.Body.stkCallback.CallbackMetadata.Item;
    amount = metadata[0]?.Value || 0;
    trans_id = metadata[1]?.Value || "Unknown";
    trans_date = metadata[2]?.Value || new Date().toISOString();
    phone = metadata[3]?.Value || "Unknown";
    status = "Success";

    // Update transaction in JSON file
    updateTransaction(status, phone, trans_id, trans_date, amount);

    res.json({ message: "Callback received and processed successfully" });
  } catch (error) {
    console.error("Error processing callback:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/download-invoice/:invoiceId", (req, res) => {
  const { invoiceId } = req.params;
  const pdfPath = path.join(
    __dirname,
    `../data/invoices/invoice_${invoiceId}.pdf`
  );

  console.log("Checking for invoice:", pdfPath);

  // Check if file exists before sending
  if (!fs.existsSync(pdfPath)) {
    console.error("Invoice not found:", pdfPath);
    return res
      .status(404)
      .json({ success: false, message: "Invoice not found!" });
  }

  // Send the invoice for download
  res.download(pdfPath, `invoice_${invoiceId}.pdf`);
});

router.get("/payment/:invoiceId", (req, res) => {
  const invoiceId = req.params.invoiceId;

  fs.readFile(invoicesFile, "utf8", (err, data) => {
    if (err) {
      return res.status(500).send("Failed to load invoices");
    }

    const invoices = JSON.parse(data);
    const invoice = invoices.find((inv) => inv.id == invoiceId);

    if (!invoice) {
      return res.status(404).send("Invoice not found");
    }

    res.render("payment", { invoice });
  });
});

module.exports = router;
