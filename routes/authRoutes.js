const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");

router.post("/auth/register", authController.register);
router.post("/auth/login", authController.login);
router.get("/login", authController.loginPage);


module.exports = router;
