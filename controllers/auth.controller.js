//var md = require("md5");
var bcrypt = require("bcrypt");
var saltRounds = 10;
const dotenv = require("dotenv").config();
const jwt = require("jsonwebtoken");

const sgMail = require("@sendgrid/mail");
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const User = require('../models/user.model.js')
const Session = require("../models/session.model.js");

module.exports.login = function(req, res) {
  res.render("auth/login");
};

module.exports.postLogin = async function(req, res) {
  var authEmail = req.body.email;
  var authPassword = req.body.password;
  var user = await User.findOne({email: authEmail});
  
  if (!user) {
    res.render("auth/login", {
      errors: ["User does not exist !"],
      values: req.body
    });
    return;
  }

  const msg = {
    to: user.email,
    from: process.env.SENDGRID_EMAIL,
    subject: "Security alert: new or unusual login",
    text: "Looks like there was a login attempt from a new device or location. Your account has been locked.", html: "<strong>Your account has been locked.</strong>"
  };

  if (!user.wrongLoginCount) {
    user.wrongLoginCount = 0;
  }

  if (user.wrongLoginCount >= 4) {
    sgMail.send(msg);
    res.render("auth/login", {
      errors: ["Your account is locked! You have type wrong password 4 times!"],
      values: req.body
    });
    return;
  }

  if (!bcrypt.compareSync(authPassword, user.password)) {
    await User.findOneAndUpdate(
      { 
        email: authEmail 
      },
      {
        wrongLoginCount: ++user.wrongLoginCount
      }
    )
    res.render("auth/login", {
      errors: ["Wrong password !"],
      values: req.body
    });
    return;
  }

  res.cookie("userId", user.id, {
    signed: true
  });
  var sessionId = req.signedCookies.sessionId;
  if (sessionId) {
    await Session.findOneAndUpdate(
      {sessionId: sessionId},
      {userId: user.id}
    )
  }

  //const accessTokenKey = jwt.sign(user, process.env.ACCESS_TOKEN_KEY)
  res.redirect("/transactions");
};

module.exports.register = function(req, res) {
  res.render("auth/register");
};

module.exports.postRegister = async function(req, res) {
  var newEmail = req.body.email;
  var hashPassword = await bcrypt.hash(req.body.password, saltRounds);
  var newUser = {email: newEmail, password : hashPassword};
  var emailExists = User.find({email: newEmail});
  
  if (!emailExists) {
    res.render("auth/register", {
      errors: ["Email already exists !"],
      values: req.body
    });
  }

  await User.insertMany(newUser)
  res.render("auth/register", {
    message: 'Congras, Register Done !'
  });
};