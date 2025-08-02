// Database migration script to update bookings table
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
    sslmode: 'require'
  }
});

async function migrateDatabase() {
  try {
    console.log('Starting database migration...');
    
    // Check if email column exists
    const checkEmailColumn = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'bookings' AND column_name = 'email'
    `);
    
    const hasEmailColumn = checkEmailColumn.rows.length > 0;
    
    // Check if location column exists
    const checkLocationColumn = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'bookings' AND column_name = 'location'
    `);
    
    const hasLocationColumn = checkLocationColumn.rows.length > 0;
    
    console.log('Current table structure:');
    console.log('- Has email column:', hasEmailColumn);
    console.log('- Has location column:', hasLocationColumn);
    
    // Begin transaction
    await pool.query('BEGIN');
    
    try {
      // Remove email column if it exists
      if (hasEmailColumn) {
        console.log('Removing email column...');
        await pool.query('ALTER TABLE bookings DROP COLUMN email');
        console.log('Email column removed successfully');
      }
      
      // Add location column if it doesn't exist
      if (!hasLocationColumn) {
        console.log('Adding location column...');
        await pool.query('ALTER TABLE bookings ADD COLUMN location VARCHAR(255) NOT NULL DEFAULT \'Almora\'');
        console.log('Location column added successfully');
      }
      
      // Update purpose column type if needed
      console.log('Updating purpose column type...');
      await pool.query('ALTER TABLE bookings ALTER COLUMN purpose TYPE VARCHAR(255)');
      console.log('Purpose column type updated successfully');
      
      // Commit transaction
      await pool.query('COMMIT');
      console.log('Database migration completed successfully!');
      
    } catch (error) {
      // Rollback on error
      await pool.query('ROLLBACK');
      throw error;
    }
    
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run migration
migrateDatabase(); 