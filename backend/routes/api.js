const express = require('express');
const router = express.Router();

const authController = require('../controllers/authController');
const shopController = require('../controllers/shopController');
const searchController = require('../controllers/searchController');

const authMiddleware = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

// --- PUBLIC AUTH ROUTES ---
router.post('/auth/user/register', authController.userRegister);
router.post('/auth/user/login', authController.userLogin);
router.post('/auth/shop/register', authController.shopRegister);
router.post('/auth/shop/login', authController.shopLogin);

// --- PROTECTED SHOP ROUTES (Web Client) ---
router.get('/shop/profile', authMiddleware('shop'), shopController.getShopProfile);
router.put('/shop/profile', authMiddleware('shop'), upload.single('shopImage'), shopController.updateShopProfile);

router.get('/shop/inventory', authMiddleware('shop'), shopController.getInventory);
router.post('/shop/inventory', authMiddleware('shop'), upload.single('medicineImage'), shopController.addInventoryItem);
router.put('/shop/inventory/:id', authMiddleware('shop'), upload.single('medicineImage'), shopController.updateInventoryItem);
router.delete('/shop/inventory/:id', authMiddleware('shop'), shopController.deleteInventoryItem);
router.post('/shop/inventory/bulk', authMiddleware('shop'), upload.single('excel'), shopController.bulkUploadInventory);

// --- PROTECTED USER ROUTES (Mobile Client) ---
router.get('/user/search', authMiddleware('user'), searchController.searchMedicine);
router.get('/user/history', authMiddleware('user'), searchController.getSearchHistory);
router.delete('/user/history', authMiddleware('user'), searchController.clearSearchHistory);
router.get('/user/shop/:shopId/inventory', authMiddleware('user'), searchController.getShopInventoryForUser);

module.exports = router;
