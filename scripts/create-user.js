const fs = require('fs');
const bcrypt = require('bcrypt');
const readline = require('readline');

const USERS_FILE = 'data/users.json';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const ask = q => new Promise(res => rl.question(q, res));

(async () => {
  try {
    const role = await ask('Role (admin/seller): ');
    if (!['admin', 'seller'].includes(role)) {
      console.log('❌ Role không hợp lệ');
      process.exit();
    }

    const username = await ask('Username: ');
    const password = await ask('Password: ');
    const email = await ask('Email: ');

    const users = JSON.parse(fs.readFileSync(USERS_FILE));

    if (users.find(u => u.username === username)) {
      console.log('❌ Username đã tồn tại');
      process.exit();
    }

    const hashed = await bcrypt.hash(password, 10);

    const user = {
      id: role + '_' + Date.now(),
      username,
      password: hashed,
      email,
      role,
      createdAt: new Date().toISOString()
    };

    users.push(user);
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));

    console.log('✅ Tạo tài khoản thành công!');
    console.log({
      username,
      role,
      email
    });

    rl.close();
  } catch (err) {
    console.error('❌ Lỗi:', err);
    rl.close();
  }
})();
