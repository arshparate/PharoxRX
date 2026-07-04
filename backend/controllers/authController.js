const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Shop = require('../models/Shop');

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_key_pharma';

// Helper to generate JWT token
const generateToken = (id, role) => {
  return jwt.sign({ id, role }, JWT_SECRET, { expiresIn: '7d' });
};

// --- USER AUTH HANDLERS (Mobile App) ---

exports.userRegister = async (req, res) => {
  try {
    const { username, email, password, confirmPassword } = req.body;

    if (!username || !email || !password || !confirmPassword) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ error: 'Passwords do not match' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({
      username,
      email,
      password: hashedPassword,
      searchHistory: []
    });

    await user.save();
    const token = generateToken(user._id, 'user');

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: { id: user._id, username: user.username, email: user.email }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.userLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const token = generateToken(user._id, 'user');
    res.status(200).json({
      message: 'Login successful',
      token,
      user: { id: user._id, username: user.username, email: user.email }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// --- SHOP AUTH HANDLERS (Web App) ---

exports.shopRegister = async (req, res) => {
  try {
    const { shopName, email, password, confirmPassword } = req.body;

    if (!shopName || !email || !password || !confirmPassword) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ error: 'Passwords do not match' });
    }

    const existingShop = await Shop.findOne({ email });
    if (existingShop) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    // Initialize shop with default coordinates [longitude, latitude]
    const shop = new Shop({
      shopName,
      email,
      password: hashedPassword,
      location: {
        type: 'Point',
        coordinates: [77.2090, 28.6139] // Default to Delhi coordinates [lng, lat]
      }
    });

    await shop.save();
    const token = generateToken(shop._id, 'shop');

    res.status(201).json({
      message: 'Shop registered successfully',
      token,
      shop: { id: shop._id, shopName: shop.shopName, email: shop.email }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.shopLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const shop = await Shop.findOne({ email });
    if (!shop) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, shop.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const token = generateToken(shop._id, 'shop');
    res.status(200).json({
      message: 'Login successful',
      token,
      shop: {
        id: shop._id,
        shopName: shop.shopName,
        email: shop.email,
        address: shop.address,
        phone: shop.phone,
        location: shop.location,
        shopImage: shop.shopImage
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
