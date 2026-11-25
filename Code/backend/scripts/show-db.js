const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const knex = require('../src/db');

async function main() {
  console.log('\n=================== DATABASE PREVIEW ===================');
  const safeDbUrl = process.env.DATABASE_URL 
    ? process.env.DATABASE_URL.replace(/:[^:@]+@/, ':****@') 
    : 'No DATABASE_URL';
  console.log(`Target Database: ${safeDbUrl}\n`);
  
  try {
    console.log('📋 QUERY 1: SELECT id, email, role, full_name FROM users LIMIT 10;');
    const users = await knex('users').select('id', 'email', 'role', 'full_name').limit(10);
    if (users.length === 0) {
      console.log('  (No users found)');
    } else {
      console.table(users);
    }

    console.log('\n📦 QUERY 2: SELECT id, status, pickup_address_label, created_at FROM listings LIMIT 10;');
    const listings = await knex('listings').select('id', 'status', 'pickup_address_label', 'created_at').limit(10);
    if (listings.length === 0) {
      console.log('  (No listings found)');
    } else {
      console.table(listings);
    }
  } catch (err) {
    console.error('Database connection error:', err.message);
    console.log('\nTip: Make sure your PostgreSQL server is running or DATABASE_URL is reachable.');
  } finally {
    await knex.destroy();
    console.log('========================================================\n');
  }
}

main();
