const db = require('./database');

db.serialize(() => {

  db.run(`
  CREATE TABLE IF NOT EXISTS users (
    user_id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_type TEXT NOT NULL CHECK (user_type IN ('pet_owner', 'provider')),
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    phone_number TEXT,
    password TEXT NOT NULL,
    profile_picture TEXT,
    date_joined DATETIME DEFAULT CURRENT_TIMESTAMP,
    location TEXT
  );
 `);
  db.run(`
  CREATE TABLE IF NOT EXISTS providers (
    provider_id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    bio TEXT,
    certifications TEXT,
    years_of_experience INTEGER CHECK (years_of_experience >= 0),
    profile_picture TEXT,
    services_offered TEXT,
    price_per_service REAL CHECK (price_per_service >= 0),
    rating REAL CHECK (rating >= 0 AND rating <= 5),
  
    FOREIGN KEY (user_id) REFERENCES users(user_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
);

 `);
  db.run(`
  CREATE TABLE IF NOT EXISTS pets (
    pet_id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_id INTEGER NOT NULL,
    pet_name TEXT NOT NULL,
    pet_type TEXT NOT NULL CHECK (pet_type IN ('dog', 'cat', 'exotic')),
    breed TEXT,
    size TEXT CHECK (size IN ('Small', 'Medium', 'Large')),
    age INTEGER CHECK (age >= 0),
    allergies TEXT,
    behavior_notes TEXT,
    medical_records TEXT,

    FOREIGN KEY (owner_id) REFERENCES users(user_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
  );
 `);
  db.run(`
  CREATE TABLE IF NOT EXISTS bookings (
    booking_id INTEGER PRIMARY KEY AUTOINCREMENT,
    pet_id INTEGER NOT NULL,
    provider_id INTEGER NOT NULL,
    start_time DATETIME NOT NULL,
    end_time DATETIME NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'confirmed', 'completed', 'canceled')),
    price REAL CHECK (price >= 0),
    payment_status TEXT NOT NULL CHECK (payment_status IN ('paid', 'pending', 'failed')),

    FOREIGN KEY (pet_id) REFERENCES pets(pet_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    FOREIGN KEY (provider_id) REFERENCES providers(provider_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CHECK (end_time > start_time)
  );
 `);
  db.run(`
  CREATE TABLE IF NOT EXISTS reviews (
    review_id INTEGER PRIMARY KEY AUTOINCREMENT,
    booking_id INTEGER NOT NULL,
    rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    review_text TEXT,
    photo_update TEXT,

    FOREIGN KEY (booking_id) REFERENCES bookings(booking_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
  );
`);
  db.run(`
  CREATE TABLE IF NOT EXISTS schedules (
    schedule_id INTEGER PRIMARY KEY AUTOINCREMENT,
    provider_id INTEGER NOT NULL,
    available_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    is_available INTEGER NOT NULL DEFAULT 1 CHECK (is_available IN (0, 1)),

    FOREIGN KEY (provider_id) REFERENCES providers(provider_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CHECK (end_time > start_time)
  );
`);
  db.run(`
  CREATE TABLE IF NOT EXISTS payments (
    payment_id INTEGER PRIMARY KEY AUTOINCREMENT,
    booking_id INTEGER NOT NULL,
    amount REAL NOT NULL CHECK (amount >= 0),
    payment_method TEXT NOT NULL,
    payment_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (booking_id) REFERENCES bookings(booking_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
  );
`);
db.run(`
  CREATE TABLE IF NOT EXISTS messages (
    message_id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_id INTEGER NOT NULL,
    receiver_id INTEGER NOT NULL,
    message_content TEXT NOT NULL,
    sent_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (sender_id) REFERENCES users(user_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    FOREIGN KEY (receiver_id) REFERENCES users(user_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CHECK (sender_id <> receiver_id)
  );
`);
db.run(`
  CREATE TABLE IF NOT EXISTS trust_badges (
    badge_id INTEGER PRIMARY KEY AUTOINCREMENT,
    provider_id INTEGER NOT NULL,
    badge_name TEXT NOT NULL,
    awarded_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (provider_id) REFERENCES providers(provider_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
  );
`);
db.run(`
  CREATE TABLE IF NOT EXISTS insurance (
    insurance_id INTEGER PRIMARY KEY AUTOINCREMENT,
    pet_owner_id INTEGER NOT NULL,
    provider_id INTEGER NOT NULL,
    coverage_start DATETIME NOT NULL,
    coverage_end DATETIME NOT NULL,
    coverage_amount REAL NOT NULL CHECK (coverage_amount >= 0),

    FOREIGN KEY (pet_owner_id) REFERENCES users(user_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    FOREIGN KEY (provider_id) REFERENCES providers(provider_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CHECK (coverage_end > coverage_start)
  );
`);

});

module.exports = db;
