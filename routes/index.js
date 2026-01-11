var express = require('express');
var router = express.Router();
const bcrypt = require('bcrypt');
const db = require("../db/database");
const auth = require('./middleware/auth');

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


// Login get method
router.get('/login', (req, res) => {
  res.render('login', { title: 'PawStay Login' });
});

// Login post method
router.post('/login', async (req, res) => {
  try {
    const { txtemail, txtpwd } = req.body;

    // Get user by email
    db.get('SELECT * FROM users WHERE email = ?', [txtemail], async (err, user) => {
      if (err) {
        console.error('DB error:', err);
        return res.status(500).send('Internal server error');
      }

      if (!user) {
        return res.render('msg', {
          title: 'This email-ID is not registered with us',
          user: req.session.user || null
        });
      }

      // Check password
      const match = await bcrypt.compare(txtpwd, user.password);
      if (!match) {
        return res.render('msg', {
          title: 'Invalid password',
          user: req.session.user || null
        });
      }

      // Save user info in session
      req.session.user = {
        id: user.user_id,
        first_name: user.first_name,
        user_type: user.user_type
      };

      console.log('LOGIN SESSION:', req.session.user);

      // Redirect pet owner to dashboard
      if (user.user_type === 'pet_owner') {
        return res.redirect('/pet-owner/dashboard');
      }

      // Pet sitter: load provider info then render dashboard
      if (user.user_type === 'provider') {
        db.get('SELECT * FROM providers WHERE user_id = ?', [user.user_id], (err, provider) => {
          if (err) {
            console.error('Provider load error:', err);
            return res.status(500).send('Error loading provider');
          }

          return res.render('pet_sitter_dashboard', {
            title: 'Pet Sitter Dashboard',
            user: req.session.user, // session user is sent here
            provider
          });
        });
        return;
      }

      // Unknown user type
      return res.status(400).send('Unknown user type');
    });

  } catch (err) {
    console.error('Login error:', err);
    res.status(500).send('Internal server error');
  }
});


//Show profile page to create profile for pet sitter --get--
router.get('/pet_sitter_create-profile/:userId', auth, (req, res) => {
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
  upload.single('profile_picture'), auth,
  (req, res) => {

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

router.get('/pet_sitter_dashboard', auth, (req, res) => {

  db.get(
    'SELECT * FROM users WHERE user_id = ?',
    [req.session.user.id],
    (err, user) => {
      if (err) {
        console.error(err);
        return res.status(500).send('Error loading user');
      }

      if (!user) {
        return res.redirect('/login');
      }

      // Load provider info
      db.get(
        'SELECT * FROM providers WHERE user_id = ?',
        [req.session.user.id],
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


//Pet Sitter edit profile -get method
router.get('/pet_sitter/edit-profile/:userId', auth, (req, res) => {
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

// Pet Sitter edit profile - POST method
router.post('/pet_sitter/edit-profile/:userId', auth, (req, res) => {
  const userId = req.params.userId;

  const {
    bio,
    certifications,
    years_of_experience,
    price_per_service,
    location,
    first_name,
    last_name,
    phone
  } = req.body;
  // console.log('Received form data:', req.body);
  const services_offered = req.body['services_offered[]']
    ? Array.isArray(req.body['services_offered[]'])
      ? req.body['services_offered[]'].join(', ')
      : req.body['services_offered[]']
    : '';

  //console.log('Services Offered:', services_offered);

  db.serialize(() => {
    db.run('BEGIN TRANSACTION');

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
      function (err) {
        if (err) {
          db.run('ROLLBACK');
          return res.status(500).send('Failed to update providers table');
        }

        db.run(
          `UPDATE users
           SET first_name = ?, last_name = ?, phone_number = ?, location = ?
           WHERE user_id = ?`,
          [first_name, last_name, phone, location, userId],
          function (err) {
            if (err) {
              db.run('ROLLBACK');
              return res.status(500).send('Failed to update users table');
            }

            db.run('COMMIT', () => {
              res.redirect('/pet_sitter_dashboard');
            });
          }
        );
      }
    );
  });
});

// Pet owner dashboard
router.get('/pet-owner/dashboard', auth, (req, res) => {
  const userId = req.session.user.id;

  // 1. Get user info
  db.get(
    'SELECT * FROM users WHERE user_id = ?',
    [userId],
    (err, user) => {
      if (err) {
        console.error(err);
        return res.status(500).send('Error loading user');
      }

      // 2. Get pets for this owner
      db.all(
        'SELECT * FROM pets WHERE owner_id = ?',
        [userId],
        (err, pets) => {
          if (err) {
            console.error(err);
            return res.status(500).send('Error loading pets');
          }
          console.log('Pets:', pets);
          // 3. Get providers with user info
          db.all(
            `
            SELECT
              users.user_id,
              users.first_name,
              users.last_name,
              users.email,
              users.phone_number,
              users.location,
              users.profile_picture AS user_profile_picture,

              providers.provider_id,
              providers.bio,
              providers.certifications,
              providers.years_of_experience,
              providers.services_offered,
              providers.price_per_service,
              providers.rating,
              providers.profile_picture AS provider_profile_picture
            FROM providers
            INNER JOIN users
              ON providers.user_id = users.user_id
            `,
            [],
            (err, providers) => {
              if (err) {
                console.error(err);
                return res.status(500).send('Error loading providers');
              }
              //console.log('Providers:', providers);
              db.all(`
             SELECT
              b.booking_id,
              b.start_time,
              b.end_time,
              b.price,
              b.status,
              b.payment_status,
              p.pet_name,
              u.first_name AS provider_first_name,
              u.last_name AS provider_last_name,
              r.profile_picture AS provider_profile_picture
            FROM bookings b
            INNER JOIN pets p ON b.pet_id = p.pet_id
            INNER JOIN providers r ON r.provider_id = b.provider_id
            INNER JOIN users u ON u.user_id = r.user_id
            WHERE p.owner_id = ?
                `,req.session.user.id, (err,bookings)=>{
                  if(err){
                    console.error(err);
                  }
                   console.log("Bookings:",bookings);
              // 4. Render dashboard
              res.render('pet_owner_dashboard', {
                title: 'Pet Owner Dashboard',
                user: req.session.user,
                pets: pets || [],
                providers: providers || [],
                bookings:bookings||[],
                firstnm:providers.first_name,
                lastnm:providers.last_name
              });
            }
          );
        }
      )}
      );
    }
  );
});


// Pet booking page by the pet owner
router.get('/pet-owner/bookings/:providerId', auth, (req, res) => {
  const providerId = req.params.providerId;
  const userId = req.session.user.id;
  db.get(
    `
  SELECT
              users.user_id,
              users.first_name,
              users.last_name,
              users.email,
              users.phone_number,
              users.location,
              users.profile_picture AS user_profile_picture,

              providers.provider_id,
              providers.bio,
              providers.certifications,
              providers.years_of_experience,
              providers.services_offered,
              providers.price_per_service,
              providers.rating,
              providers.profile_picture AS provider_profile_picture
            FROM providers
            INNER JOIN users
              ON providers.user_id = users.user_id
              WHERE providers.provider_id = ? 
  `,
    [providerId],
    (err, providers) => {
      if (err) {
        console.error(err);
        return res.status(500).send('Error loading providers');
      }
      db.all(
        `SELECT * FROM PETS WHERE owner_id = ? ORDER BY pet_name`,
        [userId],
        (err, pets) => {
          if (err) {
            console.error(err);
            return res.status(500).send('Error loading pets');
          }
          // console.log("Providers",providers);
          res.render('pet_bookings', { title: 'My Bookings', user: req.session.user || null, providers, pets });
        });
    });
});


// GET: Show edit form for a pet
router.get('/pets/:id/edit', auth, (req, res) => {
  const petId = req.params.id;
  const userId = req.session.user.id;
  const userName = req.session.user.name;
  db.get('SELECT * FROM pets WHERE pet_id = ?', [petId], (err, pet) => {
    if (err) {
      console.error(err);
      return res.status(500).send('Database error');
    }
    if (!pet) return res.status(404).send('Pet not found');

    res.render('edit_pet', { title: `Edit ${pet.pet_name}`, pet });
  });
});

// Show Add Pet form
router.get('/pets/add', auth, (req, res) => {
  res.render('add_pets', {
    title: 'Add a Pet',
    //user: { id: req.session.user.id, name: req.session.user.name }
    user: req.session.user
  });
});

//pet owner add pet get method
router.post('/pets/add', auth, (req, res) => {

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
      req.session.user.id,
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

// Update pet (PUT)
router.put('/pets/:id', auth, (req, res) => {
  const petId = req.params.id;
  const { pet_name, pet_type, breed, size, age, allergies, behavior_notes, medical_records } = req.body;

  const stmt = `
    UPDATE pets
    SET pet_name = ?, pet_type = ?, breed = ?, size = ?, age = ?, allergies = ?, behavior_notes = ?, medical_records = ?
    WHERE pet_id = ?
  `;

  db.run(stmt, [pet_name, pet_type, breed, size, age, allergies, behavior_notes, medical_records, petId], function (err) {
    if (err) {
      console.error('Error updating pet:', err);
      return res.status(500).send('Database error while updating pet');
    }
    // Redirect back to dashboard
    res.redirect('/pet-owner/dashboard');
  });
});

// Delete a pet from pets table
router.post('/pets/:petId/delete', auth, (req, res) => {
  const petId = req.params.petId;
  db.run(`DELETE FROM pets WHERE pet_id = ?`, [petId], (err) => {
    if (err) {
      console.error(err);
      return res.status(500).send('Error deleting pet');
    }

    res.redirect('/pet-owner/dashboard');
  });

});

//pet owner post method
router.post('/pet-owner/bookings', auth, (req, res) => {
  // const providerId = req.params.providerId;
  const { pet_id, provider_id, start_time, end_time, price_per_service } = req.body;
  console.log('Booking data:', req.body);
  db.run(`
    INSERT INTO bookings (pet_id, provider_id, start_time, end_time, status, price, payment_status) 
    VALUES (?, ?, ?, ?, 'pending', ?, 'pending')
    `,
    [pet_id, provider_id, start_time, end_time, parseFloat(price_per_service)],
    function (err) {
      if (err) {
        console.error(err);
        return res.status(500).send('Error creating booking');
      }
      res.redirect('/pet-owner/dashboard');
    })
})

module.exports = router;
