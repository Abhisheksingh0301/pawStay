var express = require('express');
var router = express.Router();
const bcrypt = require('bcrypt');
const db = require("../db/database");

const multer = require('multer');
const path = require('path');

// Storage config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'public/uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + '-' + file.originalname;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    if (!['.png', '.jpg', '.jpeg'].includes(ext.toLowerCase())) {
      return cb(new Error('Only images allowed'));
    }
    cb(null, true);
  }
});


/* GET home page. */
router.get('/', function (req, res, next) {
  res.render('index', {
    title: 'PawStay',
    user: req.session.user || null
  });
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

// Login get method
router.get('/login', (req, res) => {
  res.render('login', { title: 'PawStay Login' });
});

// Login post method
router.post('/login', async (req, res) => {
  try {
    const { txtemail, txtpwd } = req.body;

    db.get(
      'SELECT * FROM users WHERE email = ?',
      [txtemail],
      async (err, user) => {
        if (err) {
          console.error(err);
          return res.status(500).send('Internal server error');
        }

        if (!user) {
          return res.render('msg', { title: 'This email-ID is not registered with us', user: req.session.user || null });
        }

        const match = await bcrypt.compare(txtpwd, user.password);

        if (!match) {
          return res.render('msg', { title: 'Invalid password', user: req.session.user || null });
        }

        // Save session
        req.session.userId = user.user_id;
        req.session.userType = user.user_type;

        // PET OWNER
        if (user.user_type === 'pet_owner') {
          return res.redirect('/pet-owner/dashboard');
        }

        // PET SITTER
        db.get(
          'SELECT * FROM providers WHERE user_id = ?',
          [user.user_id],
          (err, provider) => {
            if (err) {
              console.error(err);
              return res.status(500).send('Error loading provider');
            }

            res.render('pet_sitter_dashboard', {
              title: 'Pet Sitter Dashboard',
              user,
              provider
            });
          }
        );
      }
    );
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal server error');
  }
});
//Show profile page to create profile for pet sitter --get--
router.get('/pet_sitter_create-profile/:userId', (req, res) => {
  if (!req.session.userId) {
    return res.redirect('/login');
  }

  const userId = req.params.userId;

  // Get user
  db.get(
    'SELECT * FROM users WHERE user_id = ?',
    [userId],
    (err, user) => {
      if (err) return res.status(500).send('Error loading user');

      // Check if provider already exists
      db.get(
        'SELECT * FROM providers WHERE user_id = ?',
        [userId],
        (err, provider) => {
          if (provider) {
            // Profile already exists → go to dashboard
            return res.redirect('/pet_sitter_dashboard');
          }

          res.render('pet_sitter_create-profile', {
            title: 'Create Profile',
            user
          });
        }
      );
    }
  );
});


//Pet sitter create profile post method
router.post(
  '/pet_sitter/create-profile',
  upload.single('profile_picture'),
  (req, res) => {

    if (!req.session.userId) {
      return res.redirect('/login');
    }

    const {
      user_id,
      bio,
      certifications,
      years_of_experience,
      services_offered,
      price_per_service
    } = req.body;

    const profilePicture = req.file
      ? `/uploads/${req.file.filename}`
      : null;

    const sql = `
      INSERT INTO providers (
        user_id,
        bio,
        certifications,
        years_of_experience,
        profile_picture,
        services_offered,
        price_per_service,
        rating
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const servicesString = Array.isArray(services_offered)
      ? services_offered.join(',')
      : services_offered;
    const values = [
      user_id,
      bio,
      certifications,
      years_of_experience,
      profilePicture,
      servicesString,
      price_per_service,
      0
    ];

    db.run(sql, values, function (err) {
      if (err) {
        console.error(err);
        return res.status(500).send('Error saving profile');
      }

      // Success → go to dashboard
      res.redirect('/pet_sitter_dashboard');
    });
  }
);

router.get('/pet_sitter_dashboard', (req, res) => {

  // 1. Check login
  if (!req.session.userId) {
    return res.redirect('/login');
  }

  // 2. Load user from DB using session userId
  db.get(
    'SELECT * FROM users WHERE user_id = ?',
    [req.session.userId],
    (err, user) => {
      if (err) {
        console.error(err);
        return res.status(500).send('Error loading user');
      }

      if (!user) {
        return res.redirect('/login');
      }

      // 3. Load provider info
      db.get(
        'SELECT * FROM providers WHERE user_id = ?',
        [user.user_id],
        (err, provider) => {
          if (err) {
            console.error(err);
            return res.status(500).send('Error loading provider');
          }

          res.render('pet_sitter_dashboard', {
            title: 'Pet Sitter Dashboard',
            user,
            provider
          });
        }
      );
    }
  );
});
//Logout
router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
});

//Pet Sitter edit profile -get method
router.get('/pet_sitter/edit-profile/:userId', (req, res) => {
  if (!req.session.userId) {
    return res.redirect('/login');
  }

  const userId = req.params.userId;

  db.get(
    `
    SELECT
      -- user fields
      u.user_id,
      u.first_name,
      u.last_name,
      u.email,
      u.phone_number,
      u.location,
      u.profile_picture AS user_profile_picture,

      -- provider fields
      p.bio,
      p.certifications,
      p.years_of_experience,
      p.services_offered,
      p.price_per_service,
      p.profile_picture AS provider_profile_picture
    FROM users u
    JOIN providers p ON u.user_id = p.user_id
    WHERE u.user_id = ?
    `,
    [userId],
    (err, row) => {
      if (err) {
        console.error(err);
        return res.status(500).send('Database error');
      }

      if (!row) {
        return res.status(404).send('Profile not found');
      }

      res.render('pet_sitter_edit-profile', {
        title: 'Edit Profile',
        user: {
          user_id: row.user_id,
          first_name: row.first_name,
          last_name: row.last_name,
          email: row.email,
          phone_number: row.phone_number,
          location: row.location,
          profile_picture: row.user_profile_picture
        },
        provider: {
          bio: row.bio,
          certifications: row.certifications,
          years_of_experience: row.years_of_experience,
          services_offered: row.services_offered,
          price_per_service: row.price_per_service,
          profile_picture: row.provider_profile_picture
        }
      });
    }
  );
});



//Pet Sitter edit profile -post method
router.post('/pet_sitter/edit-profile/:userId', (req, res) => {
  const userId = req.params.userId;

  const {
    bio,
    certifications,
    years_of_experience,
    price_per_service
  } = req.body;

  const services_offered = req.body['services_offered[]']
    ? Array.isArray(req.body['services_offered[]'])
      ? req.body['services_offered[]'].join(', ')
      : req.body['services_offered[]']
    : '';

  console.log('Services Offered:', services_offered);

  db.run(
    `UPDATE providers
     SET bio = ?,
         certifications = ?,
         years_of_experience = ?,
         services_offered = ?,
         price_per_service = ?
     WHERE user_id = ?`,
    [
      bio,
      certifications,
      years_of_experience,
      services_offered,
      price_per_service,
      userId
    ],
    (err) => {
      if (err) {
        return res.status(500).send('Failed to update profile');
      }

      res.redirect('/pet_sitter_dashboard');
    }
  );
});



//Pet owner dashboard
router.get('/pet-owner/dashboard', (req, res) => {
  if (!req.session.userId) {
    return res.redirect('/login');
  }

  const userId = req.session.userId;

  // Get user info
  db.get(
    'SELECT * FROM users WHERE user_id = ?',
    [userId],
    (err, user) => {
      if (err) {
        console.error(err);
        return res.status(500).send('Error loading user');
      }

      // Get pets for this owner
      db.all(
        'SELECT * FROM pets WHERE owner_id = ?',
        [userId],
        (err, pets) => {
          if (err) {
            console.error(err);
            return res.status(500).send('Error loading pets');
          }

          res.render('pet_owner_dashboard', {
            title: 'Pet Owner Dashboard',
            user,
            pets: pets || []
          });
        }
      );
    }
  );
});

//pet owner add pet get method
router.post('/pets/add', (req, res) => {
  if (!req.session.userId) {
    return res.redirect('/login');
  }

  const {
    pet_name,
    pet_type,
    breed,
    size,
    age,
    allergies,
    behavior_notes,
    medical_records
  } = req.body;

  db.run(
    `INSERT INTO pets (
      owner_id, pet_name, pet_type, breed, size, age, allergies, behavior_notes, medical_records
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      req.session.userId,
      pet_name,
      pet_type,
      breed,
      size,
      age,
      allergies,
      behavior_notes,
      medical_records
    ],
    (err) => {
      if (err) {
        console.error(err);
        return res.status(500).send('Error adding pet');
      }

      res.redirect('/pet-owner/dashboard');
    }
  );
});


module.exports = router;
