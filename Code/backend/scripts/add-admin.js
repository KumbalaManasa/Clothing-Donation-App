const bcrypt = require('bcryptjs');
const db = require('../src/db');

async function main() {
  const password = 'pavan0512';
  const saltRounds = 10;
  const passwordHash = await bcrypt.hash(password, saltRounds);

  const adminUsers = [
    {
      name: 'Pavan Kalyan',
      email: 'pavankalyangone12@gmail',
      phone: '+10000000000',
      role: 'admin',
      password_hash: passwordHash,
    },
    {
      name: 'Pavan Kalyan',
      email: 'pavankalyangone12@gmail.com',
      phone: '+10000000000',
      role: 'admin',
      password_hash: passwordHash,
    },
  ];

  console.log('Inserting/updating admin users in database...');

  for (const user of adminUsers) {
    const [result] = await db('users')
      .insert(user)
      .onConflict('email')
      .merge({
        name: user.name,
        role: user.role,
        password_hash: user.password_hash,
      })
      .returning(['id', 'name', 'email', 'role']);

    console.log(`Successfully configured admin user:`, result);
  }

  const allAdmins = await db('users').where({ role: 'admin' }).select('id', 'name', 'email', 'role');
  console.log('Current admins in database:', allAdmins);
}

main()
  .catch((err) => {
    console.error('Error adding admin user:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.destroy();
  });

