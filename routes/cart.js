// routes/cart.js
const express = require("express");
const router = express.Router();
const { Template } = require("../models");

// Route to get the cart page
router.get("/", async (req, res) => {
  console.log("Cart page accessed");
  const { templateId } = req.query; // Get template ID from URL query
  console.log("Template ID: ", templateId);

  if (!templateId) {
    return res.status(400).send("No template ID provided.");
  }

  // Fetch the template details from the database
  const template = await Template.findByPk(templateId);
  if (!template) {
    return res.status(404).send("Template not found.");
  }

  // Render cart page with template details
  res.render("cart", {
    template,
    hostingPlans: [
      { name: "Bronze", price: 2000 },
      { name: "Bronze Plus", price: 2500 },
      { name: "Silver", price: 3500 },
      { name: "Gold", price: 4500 },
    ],
  });
});


module.exports = router;
