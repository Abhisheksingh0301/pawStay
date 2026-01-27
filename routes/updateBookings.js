// updateBookings.js

const updateBookingStatus = async (db) => {
        const sql = `
        UPDATE bookings
        SET status = 'completed'
        WHERE status = 'confirmed'
          AND end_time IS NOT NULL
          AND datetime(replace(end_time, 'T', ' ')) < CURRENT_TIMESTAMP
    `;

    return new Promise((resolve, reject) => {
        db.run(sql, function (err) {
            if (err) return reject(err);
            resolve(this.changes);
        });
    });
};

const checkcompletedBookings = async (db, userId) => {
    const sql = `
        SELECT b.booking_id, b.provider_id
        FROM bookings b
        INNER JOIN pets p ON b.pet_id = p.pet_id
        WHERE p.owner_id = ?
          AND b.status = 'completed'
          AND b.reviewed = 0
        LIMIT 1
    `;

    return new Promise((resolve, reject) => {
        db.get(sql, [userId], (err, row) => {
            if (err) return reject(err);
            resolve(row);
        });
    });
};

module.exports = {
    updateBookingStatus,
    checkcompletedBookings
};
