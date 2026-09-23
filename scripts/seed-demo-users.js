// AJ SPORTS demo users seed (development only).
// Creates 1 admin + 10 customers with bcrypt-hashed passwords.
// Idempotent by email; sends no emails/OTPs; refuses production
// and any database that is not kicks-dev.

import bcrypt from 'bcryptjs';
import { connectDatabase, closeDatabase } from '../src/config/database.js';
import { env } from '../src/config/env.js';
import User from '../src/modules/users/model.js';
import { authService } from '../src/modules/auth/service.js';

const DEMO_USERS = [
  { firstName: 'AJ SPORTS', lastName: 'Admin', email: 'admin@ajsports.com', password: 'admin123', role: 'ADMIN' },
  ...Array.from({ length: 10 }, (_, index) => {
    const number = String(index + 1).padStart(2, '0');
    return {
      firstName: 'AJ Customer',
      lastName: number,
      email: `customer${number}@ajsports.com`,
      password: 'customer123',
      role: 'CUSTOMER',
    };
  }),
];

async function main() {
  if (env.nodeEnv === 'production' && process.env.ALLOW_SEED_IN_PRODUCTION !== 'true') {
    console.error('SEED BLOCKED in production. Set ALLOW_SEED_IN_PRODUCTION=true to override explicitly.');
    process.exit(1);
  }
  await connectDatabase();
  try {
    const dbName = (process.env.MONGO_URI || '').split('?')[0].split('/').pop();
    console.log('TARGET_DB=' + dbName);
    if (dbName !== 'kicks-dev') {
      console.error('REFUSING: expected kicks-dev database.');
      process.exit(1);
    }
    let created = 0;
    let existing = 0;
    for (const demo of DEMO_USERS) {
      const email = demo.email.toLowerCase();
      const found = await User.findOne({ email }).lean();
      if (found) {
        existing += 1;
        console.log(`EXISTS role=${found.role} email=${email}`);
        continue;
      }
      await User.create({
        firstName: demo.firstName,
        lastName: demo.lastName,
        email,
        password: await bcrypt.hash(demo.password, 12),
        role: demo.role,
        isActive: true,
        emailVerified: true,
      });
      created += 1;
      console.log(`CREATED role=${demo.role} email=${email}`);
    }

    // Verification: counts, roles, uniqueness, hashing, flags.
    const users = await User.find({ email: { $in: DEMO_USERS.map((u) => u.email) } }).select('+password').lean();
    const admins = users.filter((u) => u.role === 'ADMIN');
    const customers = users.filter((u) => u.role === 'CUSTOMER');
    const uniqueEmails = new Set(users.map((u) => u.email));
    const plaintextLeak = users.some((u) => u.password === 'admin123' || u.password === 'customer123');
    console.log('VERIFY_TOTAL=' + users.length);
    console.log('VERIFY_ADMINS=' + admins.length);
    console.log('VERIFY_CUSTOMERS=' + customers.length);
    console.log('VERIFY_UNIQUE_EMAILS=' + uniqueEmails.size);
    console.log('VERIFY_ALL_HASHED=' + String(users.every((u) => typeof u.password === 'string' && /^\$2[ab]\$12\$/.test(u.password))));
    console.log('VERIFY_NO_PLAINTEXT=' + String(!plaintextLeak));
    console.log('VERIFY_ALL_VERIFIED=' + String(users.every((u) => u.emailVerified === true)));
    console.log('VERIFY_ALL_ACTIVE=' + String(users.every((u) => u.isActive === true)));

    // Login verification through the real auth logic (no tokens printed).
    const adminLogin = await authService.login({ email: 'admin@ajsports.com', password: 'admin123' });
    console.log('LOGIN_ADMIN=' + (adminLogin?.user?.role === 'ADMIN' ? 'OK' : 'FAIL'));
    const customerLogin = await authService.login({ email: 'customer01@ajsports.com', password: 'customer123' });
    console.log('LOGIN_CUSTOMER01=' + (customerLogin?.user?.role === 'CUSTOMER' ? 'OK' : 'FAIL'));

    // Untouched collections spot-check.
    const Product = (await import('../src/modules/products/model.js')).default;
    const Order = (await import('../src/modules/orders/model.js')).default;
    const Inventory = (await import('../src/modules/inventory/model.js')).default;
    console.log('PRODUCTS=' + (await Product.countDocuments()));
    console.log('INVENTORY=' + (await Inventory.countDocuments()));
    console.log('ORDERS=' + (await Order.countDocuments()));
    console.log(`SUMMARY created=${created} existing=${existing}`);
  } finally {
    await closeDatabase();
  }
}

main().catch((error) => {
  console.error('DEMO USER SEED FAILED');
  console.error(error);
  process.exit(1);
});
