const bcrypt = require('bcrypt');
const db = require("../db/database");
var express = require('express');
var router = express.Router();
const auth = require('./middleware/auth');

/* GET users listing. */
router.get('/', function(req, res, next) {
  res.send('respond with a resource');
});

//Signup get method
router.get('/signup', async (req, res) => {
  try {
    res.render('signup', { title: "Join us..", user: req.session.user || null });
  } catch (err) {
    console.log(err);
    res.status(500).send('Internal Server Error');
  }
});


// Signup post form
router.post("/signup", async (req, res) => {
  try {
    const { txtfirstname, txtlstname, txtUserType, txtemail, txtphone, txtpwd, txtcnfrmpwd } = req.body;

    // 1. Check duplicate user (by email)
    const checkStmt = db.prepare(`
      SELECT COUNT(*) AS count
      FROM users
      WHERE email = ?
    `);

    const { count } = checkStmt.get(txtemail);

    if (count > 0) {
      console.log("Duplicate name");
      return res.render("msg", {
        title: "Duplicate name", user: req.session.user || null
      });
    }

    // 2. Check password match
    if (txtpwd !== txtcnfrmpwd) {
      return res.render("msg", {
        title: "Password didn't match", user: req.session.user || null
      });
    }

    // 3. Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(txtpwd, saltRounds);

    // 4. Insert new user
    const insertStmt = db.prepare(`
      INSERT INTO users (
        user_type,
        first_name,
        last_name,
        email,
        phone_number,
        password
      )
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    insertStmt.run(
      txtUserType,
      txtfirstname,
      txtlstname,
      txtemail,
      txtphone,
      hashedPassword
    );


    res.render("msg", {
      title: "Signup successful, now click on Login link", user: req.session.user || null
    });

  } catch (err) {
    console.error(err);
    res.status(500).send("Internal server error");
  }
});

//Logout
router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
});
module.exports = router;
