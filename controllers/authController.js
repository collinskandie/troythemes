const jwt = require("jsonwebtoken");
const { User } = require("../models");

const createToken = (user) => {
  return jwt.sign({ id: user.id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
};

exports.register = async (req, res) => {
  try {
    const { firstName, lastName, email, phone, password } = req.body;
    console.log(req.body);
    // Check if user already exists
    // const existingUser = await User.findAll({ where: { email } });
    // if (existingUser) {
    //   return res.status(400).json({ error: "User already exists" });
    // }

    const user = await User.create({
      firstName,
      lastName,
      email,
      phone,
      password,
    });
    console.log(user);
    res.status(201).json({ message: "User created successfully" });
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: "email may already exist or bad input" });
  }
};
exports.loginPage = (req, res) => {
  res.render("login", { template: null });
};

exports.login = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ where: { email } });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    req.session.user = user.id;

    const token = createToken(user);
    res.json({ token });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
};
