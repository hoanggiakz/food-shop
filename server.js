const express = require('express');
const session = require('express-session');
const multer = require('multer');
const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs');

// Load environment variables (optional - nâng cao)
// Nếu muốn dùng file .env, chạy: npm install dotenv
// Sau đó uncomment dòng dưới:
// require('dotenv').config();
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:"],
      },
    },
  })
);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static('uploads'));
app.use('/public', express.static('public'));

// Session configuration
app.use(session({
  secret: 'food-shop-secret-key-2025',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 } // 24 hours
}));

// Tạo thư mục cần thiết nếu chưa có
const createDirectories = () => {
  ['data', 'uploads', 'public', 'private'].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
};

// Khởi tạo file JSON nếu chưa có
const initializeData = () => {
  const defaultData = {
    'data/users.json': [
      {
        id: 1,
        username: 'admin',
        password: 'admin123',
        role: 'admin',
        email: 'admin@foodshop.com'
      }
    ],
    'data/products.json': [],
    'data/invoices.json': []
  };

  Object.entries(defaultData).forEach(([file, data]) => {
    if (!fs.existsSync(file)) {
      fs.writeFileSync(file, JSON.stringify(data, null, 2));
    }
  });
};

createDirectories();
initializeData();

// Helper functions để đọc/ghi JSON
const readJSON = (filename) => {
  try {
    const data = fs.readFileSync(filename, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error(`Error reading ${filename}:`, err);
    return [];
  }
};

const writeJSON = (filename, data) => {
  try {
    fs.writeFileSync(filename, JSON.stringify(data, null, 2));
    return true;
  } catch (err) {
    console.error(`Error writing ${filename}:`, err);
    return false;
  }
};

// Cấu hình Multer để upload ảnh
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    const nameWithoutExt = path.basename(file.originalname, ext);
    const cleanName = nameWithoutExt
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/[^a-z0-9]/g, '');
    cb(null, `${cleanName}_${timestamp}${ext}`);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const mimetype = allowedTypes.test(file.mimetype);
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Chỉ chấp nhận file ảnh (jpg, jpeg, png, gif)'));
  }
});

// Cấu hình Nodemailer
// CÁCH 1: Cấu hình trực tiếp (Dễ dàng - cho người mới)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'hoanggiakz@gmail.com',        // ← Thay bằng email của bạn
    pass: 'oirl apym nyzf xmwf'            // ← Thay bằng App Password 16 ký tự
  }
  // Nếu gặp lỗi SSL, thêm:
  // tls: { rejectUnauthorized: false }
});

// CÁCH 2: Dùng biến môi trường .env (Nâng cao - bảo mật hơn)
// Uncomment đoạn dưới nếu bạn đã cài dotenv và tạo file .env
/*
const transporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE || 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});
*/

// CÁCH 3: Dùng Ethereal (Test - không cần cấu hình)
// Truy cập https://ethereal.email/create để lấy thông tin
/*
const transporter = nodemailer.createTransport({
  host: 'smtp.ethereal.email',
  port: 587,
  auth: {
    user: 'your-ethereal-email@ethereal.email',
    pass: 'your-ethereal-password'
  }
});
*/

// Middleware kiểm tra quyền
const requireAuth = (req, res, next) => {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Bạn cần đăng nhập' });
  }
  next();
};

const requireAdmin = (req, res, next) => {
  if (!req.session.user || req.session.user.role !== 'admin') {
    return res.status(403).json({ error: 'Chỉ Admin mới có quyền truy cập' });
  }
  next();
};

const requireSeller = (req, res, next) => {
  if (!req.session.user || req.session.user.role !== 'seller') {
    return res.status(403).json({ error: 'Chỉ Người bán mới có quyền truy cập' });
  }
  next();
};

// ========== ROUTES AUTHENTICATION ==========

// Đăng nhập
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const users = readJSON('data/users.json');
  
  const user = users.find(u => u.username === username && u.password === password);
  
  if (user) {
    req.session.user = {
      id: user.id,
      username: user.username,
      role: user.role,
      email: user.email
    };
    res.json({ 
      success: true, 
      role: user.role,
      username: user.username
    });
  } else {
    res.status(401).json({ error: 'Tên đăng nhập hoặc mật khẩu không đúng' });
  }
});

// Đăng xuất
app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

// Kiểm tra session
app.get('/api/check-auth', (req, res) => {
  if (req.session.user) {
    res.json({ 
      authenticated: true, 
      user: req.session.user 
    });
  } else {
    res.json({ authenticated: false });
  }
});

// ========== ROUTES ADMIN ==========

// Lấy danh sách người bán
app.get('/api/admin/sellers', requireAdmin, (req, res) => {
  const users = readJSON('data/users.json');
  const sellers = users.filter(u => u.role === 'seller');
  res.json(sellers);
});

// Tạo tài khoản người bán
app.post('/api/admin/sellers', requireAdmin, (req, res) => {
  const { username, password, email } = req.body;
  const users = readJSON('data/users.json');
  
  // Kiểm tra username đã tồn tại
  if (users.find(u => u.username === username)) {
    return res.status(400).json({ error: 'Tên đăng nhập đã tồn tại' });
  }
  
  const newSeller = {
    id: Date.now(),
    username,
    password,
    email,
    role: 'seller',
    createdAt: new Date().toISOString()
  };
  
  users.push(newSeller);
  writeJSON('data/users.json', users);
  
  res.json({ success: true, seller: newSeller });
});

// Xóa tài khoản người bán
app.delete('/api/admin/sellers/:id', requireAdmin, (req, res) => {
  const sellerId = parseInt(req.params.id);
  let users = readJSON('data/users.json');
  
  users = users.filter(u => u.id !== sellerId);
  writeJSON('data/users.json', users);
  
  res.json({ success: true });
});

// Lấy tất cả sản phẩm (Admin)
app.get('/api/admin/products', requireAdmin, (req, res) => {
  const products = readJSON('data/products.json');
  res.json(products);
});

// Xóa hoặc ẩn sản phẩm
app.patch('/api/admin/products/:id', requireAdmin, (req, res) => {
  const productId = parseInt(req.params.id);
  const { status } = req.body;
  
  const products = readJSON('data/products.json');
  const product = products.find(p => p.id === productId);
  
  if (!product) {
    return res.status(404).json({ error: 'Không tìm thấy sản phẩm' });
  }
  
  product.status = status;
  writeJSON('data/products.json', products);
  
  res.json({ success: true, product });
});

// ========== ROUTES SELLER ==========

// Lấy sản phẩm của người bán
app.get('/api/seller/products', requireSeller, (req, res) => {
  const products = readJSON('data/products.json');
  const myProducts = products.filter(p => p.sellerId === req.session.user.id);
  res.json(myProducts);
});

// Tạo sản phẩm mới
app.post('/api/seller/products', requireSeller, upload.array('images', 10), (req, res) => {
  const { name, price, unit, description, thumbnailIndex } = req.body;
  
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'Vui lòng upload ít nhất 1 ảnh' });
  }
  
  const images = req.files.map(file => `/uploads/${file.filename}`);
  const thumbnail = images[parseInt(thumbnailIndex) || 0];
  
  const products = readJSON('data/products.json');
  
  const newProduct = {
    id: Date.now(),
    name,
    price: parseFloat(price),
    unit,
    description,
    images,
    thumbnail,
    sellerId: req.session.user.id,
    sellerEmail: req.session.user.email,
    status: 'active',
    createdAt: new Date().toISOString()
  };
  
  products.push(newProduct);
  writeJSON('data/products.json', products);
  
  res.json({ success: true, product: newProduct });
});

// Cập nhật sản phẩm
app.put('/api/seller/products/:id', requireSeller, upload.array('newImages', 10), (req, res) => {
  const productId = parseInt(req.params.id);
  const { name, price, unit, description, thumbnailIndex, existingImages } = req.body;
  
  const products = readJSON('data/products.json');
  const product = products.find(p => p.id === productId && p.sellerId === req.session.user.id);
  
  if (!product) {
    return res.status(404).json({ error: 'Không tìm thấy sản phẩm' });
  }
  
  // Xử lý ảnh cũ và ảnh mới
  let images = [];
  if (existingImages) {
    images = JSON.parse(existingImages);
  }
  
  if (req.files && req.files.length > 0) {
    const newImages = req.files.map(file => `/uploads/${file.filename}`);
    images = [...images, ...newImages];
  }
  
  if (images.length === 0) {
    return res.status(400).json({ error: 'Sản phẩm phải có ít nhất 1 ảnh' });
  }
  
  const thumbnail = images[parseInt(thumbnailIndex) || 0];
  
  product.name = name;
  product.price = parseFloat(price);
  product.unit = unit;
  product.description = description;
  product.images = images;
  product.thumbnail = thumbnail;
  product.updatedAt = new Date().toISOString();
  
  writeJSON('data/products.json', products);
  
  res.json({ success: true, product });
});

// Xóa sản phẩm
app.delete('/api/seller/products/:id', requireSeller, (req, res) => {
  const productId = parseInt(req.params.id);
  let products = readJSON('data/products.json');
  
  const product = products.find(p => p.id === productId && p.sellerId === req.session.user.id);
  
  if (!product) {
    return res.status(404).json({ error: 'Không tìm thấy sản phẩm' });
  }
  
  // Xóa file ảnh
  product.images.forEach(img => {
    const filePath = path.join(__dirname, img);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  });
  
  products = products.filter(p => p.id !== productId);
  writeJSON('data/products.json', products);
  
  res.json({ success: true });
});

// ========== ROUTES PUBLIC ==========

// Lấy danh sách sản phẩm (chỉ active)
app.get('/api/products', (req, res) => {
  const products = readJSON('data/products.json');
  const activeProducts = products.filter(p => p.status === 'active');
  res.json(activeProducts);
});

// Lấy chi tiết sản phẩm
app.get('/api/products/:id', (req, res) => {
  const productId = parseInt(req.params.id);
  const products = readJSON('data/products.json');
  const product = products.find(p => p.id === productId && p.status === 'active');
  
  if (!product) {
    return res.status(404).json({ error: 'Không tìm thấy sản phẩm' });
  }
  
  res.json(product);
});

// Tạo đơn hàng
app.post('/api/orders', async (req, res) => {
  try {
    const { productId, customerName, customerEmail, quantity } = req.body;
    
    // Validate input
    if (!productId || !customerName || !customerEmail || !quantity) {
      return res.status(400).json({ 
        success: false,
        error: 'Vui lòng điền đầy đủ thông tin' 
      });
    }
    
    const products = readJSON('data/products.json');
    const product = products.find(p => p.id === parseInt(productId));
    
    if (!product) {
      return res.status(404).json({ 
        success: false,
        error: 'Không tìm thấy sản phẩm' 
      });
    }
    
    const total = product.price * quantity;
    
    const invoices = readJSON('data/invoices.json');
    
    const newInvoice = {
      id: Date.now(),
      productId: product.id,
      productName: product.name,
      productPrice: product.price,
      productUnit: product.unit,
      quantity: parseInt(quantity),
      total,
      customerName,
      customerEmail,
      sellerId: product.sellerId,
      sellerEmail: product.sellerEmail,
      createdAt: new Date().toISOString()
    };
    
    invoices.push(newInvoice);
    writeJSON('data/invoices.json', invoices);
    
    // Gửi email (bất đồng bộ, không chặn response)
    sendOrderEmails(product, newInvoice, customerName, customerEmail, quantity, total);
    
    res.json({ success: true, invoice: newInvoice });
  } catch (error) {
    console.error('Order creation error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Có lỗi xảy ra khi tạo đơn hàng' 
    });
  }
});

// Hàm gửi email riêng biệt
async function sendOrderEmails(product, invoice, customerName, customerEmail, quantity, total) {
  try {
    // Gửi email cho khách hàng
    const customerMailOptions = {
      from: 'your-email@gmail.com',
      to: customerEmail,
      subject: '✅ Xác nhận đơn hàng - Food Shop',
      html: `
        <h2>Cảm ơn bạn đã đặt hàng!</h2>
        <p>Xin chào <strong>${customerName}</strong>,</p>
        <p>Đơn hàng của bạn đã được ghi nhận thành công:</p>
        <ul>
          <li>Sản phẩm: ${product.name}</li>
          <li>Giá: ${product.price.toLocaleString('vi-VN')} VNĐ/${product.unit}</li>
          <li>Số lượng: ${quantity} ${product.unit}</li>
          <li>Tổng tiền: <strong>${total.toLocaleString('vi-VN')} VNĐ</strong></li>
        </ul>
        <p>Mã đơn hàng: <strong>#${invoice.id}</strong></p>
        <p>Chúng tôi sẽ liên hệ với bạn sớm nhất!</p>
      `
    };
    
    // Gửi email cho người bán
    const sellerMailOptions = {
      from: 'your-email@gmail.com',
      to: product.sellerEmail,
      subject: '🔔 Bạn có đơn hàng mới!',
      html: `
        <h2>Đơn hàng mới từ ${customerName}</h2>
        <p>Chi tiết đơn hàng:</p>
        <ul>
          <li>Sản phẩm: ${product.name}</li>
          <li>Số lượng: ${quantity} ${product.unit}</li>
          <li>Tổng tiền: <strong>${total.toLocaleString('vi-VN')} VNĐ</strong></li>
        </ul>
        <p><strong>Thông tin khách hàng:</strong></p>
        <ul>
          <li>Tên: ${customerName}</li>
          <li>Email: ${customerEmail}</li>
        </ul>
        <p>Mã đơn hàng: <strong>#${invoice.id}</strong></p>
      `
    };
    
    await transporter.sendMail(customerMailOptions);
    await transporter.sendMail(sellerMailOptions);
    console.log('✅ Emails sent successfully');
  } catch (err) {
    console.error('⚠️ Email sending error:', err.message);
    // Không fail request nếu email lỗi
  }
}

// ========== SERVE HTML FILES ==========

// Trang public
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/product.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'product.html'));
});

app.get('/login.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Trang private (cần auth)
app.get('/admin', requireAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, 'private', 'admin.html'));
});

app.get('/seller', requireSeller, (req, res) => {
  res.sendFile(path.join(__dirname, 'private', 'seller.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`🍔 Food Shop Server đang chạy tại http://localhost:${PORT}`);
  console.log(`📁 Cấu trúc thư mục đã được khởi tạo`);
  
});