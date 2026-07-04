const mongoose = require('mongoose');

const SearchHistorySchema = new mongoose.Schema({
  query: { type: String, required: true },
  timestamp: { type: Date, default: Date.now }
});

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  searchHistory: [SearchHistorySchema]
}, { timestamps: true });

module.exports = mongoose.model('User', UserSchema);
