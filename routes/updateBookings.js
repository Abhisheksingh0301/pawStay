// Function to update booking status
module.exports = async function updateBookingStatus(db) {
    // const now = new Date().toISOString().slice(0, 16);

    const sql = `
        UPDATE bookings
        SET status = 'completed'
        WHERE status != 'completed'
        AND end_time IS NOT NULL
        AND end_time < CURRENT_TIMESTAMP  --This CURRENT_TIMESTAMP will comes from server time
    `;

    return new Promise((resolve, reject) => {
        db.run(sql, function (err) {
            if (err) {
                return reject(err);
            }
            resolve(this.changes); 
        });
    });
};

module.exports=async function checkcompletedBookings(db, userId){
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
            if (err) {
                return reject(err);
            }
            resolve(row); 
        });
    });
}   