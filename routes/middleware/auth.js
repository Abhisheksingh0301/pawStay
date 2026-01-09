// const db = require("../../db/database"); // adjust path as needed

// module.exports = function (req, res, next) {
//   //if (req.session && req.session.userId) {
//   if (req.session && req.session.user) {

//     // User is authenticated
//     return next();
//   } else {
//     const query = `
//       SELECT user_id, first_name, last_name, email
//       FROM users
//       ORDER BY first_name ASC
//     `;

//     db.all(query, [], (err, rows) => {
//       if (err) {
//         console.error(err);
//         return next(err);
//       }

//       res.render("login", {
//         title: "PawStay Login",
//         userId: req.session.userId,
//         empdata: rows
//       });
//     });
//   }
// };

module.exports = function (req, res, next) {
  if (req.session && req.session.user) {
    return next();
  }

  return res.redirect('/login');
};
