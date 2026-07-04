const fs = require('fs');
const xlsx = require('xlsx');
const Shop = require('../models/Shop');
const Inventory = require('../models/Inventory');

// --- SHOP PROFILE ---

exports.updateShopProfile = async (req, res) => {
  try {
    const shopId = req.user.id;
    const { shopName, address, phone, latitude, longitude } = req.body;

    const updateData = {};
    if (shopName) updateData.shopName = shopName;
    if (address) updateData.address = address;
    if (phone) updateData.phone = phone;

    // Check if coordinates were passed
    if (latitude !== undefined && longitude !== undefined) {
      updateData.location = {
        type: 'Point',
        coordinates: [parseFloat(longitude), parseFloat(latitude)] // [lng, lat]
      };
    }

    // Check if shop image was uploaded
    if (req.file) {
      updateData.shopImage = `/uploads/${req.file.filename}`;
    }

    const updatedShop = await Shop.findByIdAndUpdate(shopId, updateData, { new: true });
    
    if (!updatedShop) {
      return res.status(404).json({ error: 'Shop not found' });
    }

    res.status(200).json({
      message: 'Profile updated successfully',
      shop: {
        id: updatedShop._id,
        shopName: updatedShop.shopName,
        email: updatedShop.email,
        address: updatedShop.address,
        phone: updatedShop.phone,
        location: updatedShop.location,
        shopImage: updatedShop.shopImage
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get current shop profile info
exports.getShopProfile = async (req, res) => {
  try {
    const shop = await Shop.findById(req.user.id).select('-password');
    if (!shop) {
      return res.status(404).json({ error: 'Shop not found' });
    }
    res.status(200).json(shop);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// --- INVENTORY MANAGEMENT (CRUD) ---

exports.getInventory = async (req, res) => {
  try {
    const shopId = req.user.id;
    const items = await Inventory.find({ shop: shopId }).sort({ createdAt: -1 });
    res.status(200).json(items);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.addInventoryItem = async (req, res) => {
  try {
    const shopId = req.user.id;
    const { medicineName, price, isOutOfStock } = req.body;

    if (!medicineName || !price) {
      return res.status(400).json({ error: 'Medicine name and price are required' });
    }

    const itemData = {
      shop: shopId,
      medicineName,
      price: parseFloat(price),
      isOutOfStock: isOutOfStock === 'true' || isOutOfStock === true
    };

    if (req.file) {
      itemData.medicineImage = `/uploads/${req.file.filename}`;
    }

    const newItem = new Inventory(itemData);
    await newItem.save();

    res.status(201).json({
      message: 'Inventory item added successfully',
      item: newItem
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateInventoryItem = async (req, res) => {
  try {
    const shopId = req.user.id;
    const itemId = req.params.id;
    const { medicineName, price, isOutOfStock } = req.body;

    // Verify ownership
    const item = await Inventory.findOne({ _id: itemId, shop: shopId });
    if (!item) {
      return res.status(404).json({ error: 'Inventory item not found or unauthorized' });
    }

    if (medicineName) item.medicineName = medicineName;
    if (price !== undefined) item.price = parseFloat(price);
    if (isOutOfStock !== undefined) {
      item.isOutOfStock = isOutOfStock === 'true' || isOutOfStock === true;
    }

    if (req.file) {
      item.medicineImage = `/uploads/${req.file.filename}`;
    }

    await item.save();

    res.status(200).json({
      message: 'Inventory item updated successfully',
      item
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deleteInventoryItem = async (req, res) => {
  try {
    const shopId = req.user.id;
    const itemId = req.params.id;

    // Verify ownership and delete
    const deletedItem = await Inventory.findOneAndDelete({ _id: itemId, shop: shopId });
    if (!deletedItem) {
      return res.status(404).json({ error: 'Inventory item not found or unauthorized' });
    }

    res.status(200).json({ message: 'Inventory item deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// --- EXCEL BULK UPLOAD ---

exports.bulkUploadInventory = async (req, res) => {
  try {
    const shopId = req.user.id;

    if (!req.file) {
      return res.status(400).json({ error: 'Please upload an Excel file (.xlsx, .xls) or CSV' });
    }

    const filePath = req.file.path;
    
    // Read the Excel sheet
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Convert worksheet to JSON array of objects
    const rows = xlsx.utils.sheet_to_json(worksheet);

    if (rows.length === 0) {
      fs.unlinkSync(filePath); // delete uploaded temp file
      return res.status(400).json({ error: 'Uploaded sheet is empty' });
    }

    const parsedItems = [];
    
    // Process rows
    for (const row of rows) {
      // Find column names dynamically (case-insensitive checks)
      let name = '';
      let price = 0;
      let outOfStock = false;

      for (const key of Object.keys(row)) {
        const lowerKey = key.toLowerCase().trim();
        
        if (lowerKey.includes('name') || lowerKey.includes('medicine') || lowerKey.includes('title')) {
          name = row[key];
        } else if (lowerKey.includes('price') || lowerKey.includes('rate') || lowerKey.includes('cost')) {
          price = parseFloat(row[key]) || 0;
        } else if (lowerKey.includes('stock') || lowerKey.includes('status') || lowerKey.includes('avail')) {
          const val = String(row[key]).toLowerCase().trim();
          if (val.includes('out') || val.includes('false') || val.includes('no') || val === '0') {
            outOfStock = true;
          }
        }
      }

      if (name) {
        parsedItems.push({
          shop: shopId,
          medicineName: name,
          price: price,
          isOutOfStock: outOfStock
        });
      }
    }

    if (parsedItems.length === 0) {
      fs.unlinkSync(filePath);
      return res.status(400).json({ error: 'Could not parse any valid medicines. Make sure columns like "Medicine Name" and "Price" are present.' });
    }

    // Insert to DB
    const insertedItems = await Inventory.insertMany(parsedItems);

    // Clean up uploaded file
    fs.unlinkSync(filePath);

    res.status(201).json({
      message: `Successfully imported ${insertedItems.length} inventory items.`,
      count: insertedItems.length
    });
  } catch (error) {
    // Make sure we clean up the file in case of error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: error.message });
  }
};
