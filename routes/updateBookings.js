// updateBookings.js

const updateBookingStatus = async (db) => {
    const completeSql = `
        UPDATE bookings
        SET status = 'completed'
        WHERE status = 'confirmed'
          AND end_time IS NOT NULL
          AND datetime(replace(end_time, 'T', ' ')) < CURRENT_TIMESTAMP
    `;

    const cancelSql = `
        UPDATE bookings
        SET status = 'cancelled'
        WHERE status = 'pending'
          AND start_time IS NOT NULL
          AND datetime(replace(start_time, 'T', ' ')) < CURRENT_TIMESTAMP
    `;

    return new Promise((resolve, reject) => {
        db.serialize(() => {
            db.run(completeSql, function (err) {
                if (err) return reject(err);

                const completedCount = this.changes;

                db.run(cancelSql, function (err) {
                    if (err) return reject(err);

                    const cancelledCount = this.changes;

                    resolve({
                        completed: completedCount,
                        cancelled: cancelledCount
                    });
                });
            });
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
