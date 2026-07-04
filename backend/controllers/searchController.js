const Shop = require('../models/Shop');
const Inventory = require('../models/Inventory');
const User = require('../models/User');
const mongoose = require('mongoose');

// Helper to escape regex special characters
const escapeRegex = (string) => {
  return string.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
};

// Helper to clean mg/ml/g strength suffixes and numbers to match base medicine names
const cleanSearchQuery = (query) => {
  let clean = query.toLowerCase();
  
  // Remove strength/volume patterns like "500mg", "650 mg", "10ml", "5g"
  clean = clean.replace(/\d+\s*(mg|ml|mcg|g)\b/g, '');
  
  // Remove standalone numbers (e.g. tablet counts, etc)
  clean = clean.replace(/\b\d+\b/g, '');
  
  // Split into words, trim and filter out very short terms (length < 2)
  const words = clean.split(/[\s,\-\+]+/).map(w => w.trim()).filter(w => w.length >= 2);
  
  return words;
};

exports.searchMedicine = async (req, res) => {
  try {
    const { query, lat, lng, radius = 50 } = req.query; // radius in km, default 50km
    const userId = req.user.id;

    if (!query) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    // 1. Log search query to user's history
    await User.findByIdAndUpdate(userId, {
      $push: {
        searchHistory: {
          query: query.trim(),
          timestamp: new Date()
        }
      }
    });

    // 2. Find matching medicines that are NOT out of stock
    // Extract base keywords (ignoring strength suffixes) to make search fuzzy/strength-independent
    const cleanWords = cleanSearchQuery(query);
    let regexQuery = query.trim();
    if (cleanWords.length > 0) {
      const keywordRegex = cleanWords.map(w => escapeRegex(w)).join('|');
      regexQuery = `(${escapeRegex(query.trim())}|${keywordRegex})`;
    }

    const matchingMeds = await Inventory.find({
      medicineName: { $regex: regexQuery, $options: 'i' },
      isOutOfStock: false
    });

    if (matchingMeds.length === 0) {
      return res.status(200).json({
        message: 'No medicines found matching this query',
        results: []
      });
    }

    // Map shop ID to medicine details for easy lookups
    const shopToMedMap = {};
    matchingMeds.forEach(med => {
      if (!shopToMedMap[med.shop.toString()]) {
        shopToMedMap[med.shop.toString()] = [];
      }
      shopToMedMap[med.shop.toString()].push({
        medicineId: med._id,
        medicineName: med.medicineName,
        price: med.price,
        medicineImage: med.medicineImage
      });
    });

    const shopIds = Object.keys(shopToMedMap).map(id => new mongoose.Types.ObjectId(id));

    // 3. Perform geospatial near query if coordinates are provided
    let results = [];

    if (lat && lng) {
      // Find shops within range of coordinate ordered by distance
      let nearbyShops = await Shop.aggregate([
        {
          $geoNear: {
            near: {
              type: 'Point',
              coordinates: [parseFloat(lng), parseFloat(lat)] // [lng, lat]
            },
            distanceField: 'distance', // Output field with distance in meters
            maxDistance: parseFloat(radius) * 1000, // max distance in meters
            query: { _id: { $in: shopIds } },
            spherical: true
          }
        }
      ]);

      // Auto-expansion UX: If no pharmacies are found within the selected radius,
      // expand search to show the nearest registered pharmacy in the database matching the medicine
      let isRadiusExpanded = false;
      if (nearbyShops.length === 0) {
        nearbyShops = await Shop.aggregate([
          {
            $geoNear: {
              near: {
                type: 'Point',
                coordinates: [parseFloat(lng), parseFloat(lat)]
              },
              distanceField: 'distance',
              query: { _id: { $in: shopIds } },
              spherical: true
            }
          }
        ]);
        isRadiusExpanded = true;
      }

      // Merge shop info with corresponding medicines
      results = nearbyShops.map(shop => ({
        shopId: shop._id,
        shopName: shop.shopName,
        email: shop.email,
        phone: shop.phone,
        address: shop.address,
        shopImage: shop.shopImage,
        location: shop.location,
        distanceInKm: parseFloat((shop.distance / 1000).toFixed(2)),
        medicines: shopToMedMap[shop._id.toString()] || [],
        isRadiusExpanded
      }));
    } else {
      // If no coordinates, just fetch details of the shops matching these IDs
      const shops = await Shop.find({ _id: { $in: shopIds } }).select('-password');
      results = shops.map(shop => ({
        shopId: shop._id,
        shopName: shop.shopName,
        email: shop.email,
        phone: shop.phone,
        address: shop.address,
        shopImage: shop.shopImage,
        location: shop.location,
        distanceInKm: null,
        medicines: shopToMedMap[shop._id.toString()] || []
      }));
    }

    res.status(200).json({
      query,
      radius: lat && lng ? `${radius} km` : 'none',
      count: results.length,
      results
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// --- USER SEARCH HISTORY (Last 7 Days) ---

exports.getSearchHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Filter history to last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const activeHistory = user.searchHistory
      .filter(item => item.timestamp >= sevenDaysAgo)
      .sort((a, b) => b.timestamp - a.timestamp); // newest first

    res.status(200).json({
      userId: user._id,
      username: user.username,
      searchHistory: activeHistory
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.clearSearchHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    await User.findByIdAndUpdate(userId, { $set: { searchHistory: [] } });
    res.status(200).json({ message: 'Search history cleared successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getShopInventoryForUser = async (req, res) => {
  try {
    const { shopId } = req.params;
    const shop = await Shop.findById(shopId).select('-password');
    if (!shop) {
      return res.status(404).json({ error: 'Shop not found' });
    }

    const items = await Inventory.find({ shop: shopId }).sort({ medicineName: 1 });

    res.status(200).json({
      shop: {
        id: shop._id,
        shopName: shop.shopName,
        email: shop.email,
        phone: shop.phone,
        address: shop.address,
        shopImage: shop.shopImage,
        location: shop.location
      },
      inventory: items.map(item => ({
        medicineId: item._id,
        medicineName: item.medicineName,
        price: item.price,
        medicineImage: item.medicineImage,
        isAvailable: !item.isOutOfStock
      }))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
