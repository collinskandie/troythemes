const nodemailer = require("nodemailer");
const fs = require("fs");
const path = require("path");
const ejs = require("ejs");
require("dotenv").config();
const { chromium } = require("playwright");
const pdf = require("html-pdf");
const EMAIL_HOST = "mail.troycityafrica.com";
const EMAIL_PORT = 465;
const EMAIL_USER = "troyhost@troycityafrica.com";
const EMAIL_PASS = "!9OFkB)KH(9S";
const EMAIL_SECURE = true; // true for 465, false for other ports

transporter = nodemailer.createTransport({
  host: EMAIL_HOST,
  port: EMAIL_PORT,
  secure: EMAIL_SECURE, // true for 465, false for other ports
  auth: {
    user: EMAIL_USER,
    pass: EMAIL_PASS,
  },
});

async function generateInvoice(invoiceData) {
  try {
    
    const templatePath = path.join(__dirname, "../views", "invoice.ejs");
    if (!fs.existsSync(templatePath)) {
      console.error("EJS template not found at:", templatePath);
      return;
    }
    // Render the EJS template
    const htmlContent = await ejs
      .renderFile(templatePath, invoiceData)
      .catch((err) => {
        console.error("Error rendering EJS template:", err);
      });

    if (!htmlContent) {
      console.error("Failed to generate HTML content.");
      return;
    }
    // Define PDF path
    const pdfPath = path.join(
      __dirname,
      `../data/invoices/invoice_${invoiceData.invoiceId}.pdf`
    );
    // Generate PDF from HTML using html-pdf
    pdf
      .create(htmlContent, { format: "A4" })
      .toFile(pdfPath, async (err, res) => {
        if (err) {
          console.error("Error generating PDF:", err);
          return;
        }
        console.log("PDF generated successfully:", res.filename);
        // Send the invoice email
        await sendInvoiceEmail(invoiceData.customerEmail, pdfPath);
      });
  } catch (error) {
    console.error("Error generating invoice:", error);
  }
}
async function sendInvoiceEmail(email, pdfPath) {
  transporter = nodemailer.createTransport({
    host: EMAIL_HOST,
    port: EMAIL_PORT,
    secure: EMAIL_SECURE, // true for 465, false for other ports
    auth: {
      user: EMAIL_USER,
      pass: EMAIL_PASS,
    },
  });

  const mailOptions = {
    from: EMAIL_USER,
    to: email,
    subject: "Your Invoice",
    text: "Please find attached your invoice.",
    attachments: [{ filename: "invoice.pdf", path: pdfPath }],
  };

  await transporter.sendMail(mailOptions);
}

module.exports = { generateInvoice };
