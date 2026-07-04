/**
 * Integration Verification Test Script
 * Verifies all API endpoints of the Pharma Management System
 * Run with: node test_api.js (after starting the server)
 */

const BASE_URL = 'http://localhost:5000/api';

async function runTests() {
  console.log('🚀 Starting integration test suite...');
  
  let shopToken = '';
  let userToken = '';
  let shopId = '';

  const timestamp = Date.now();
  const testUser = {
    username: `testuser_${timestamp}`,
    email: `user_${timestamp}@test.com`,
    password: 'password123',
    confirmPassword: 'password123'
  };

  const testShop = {
    shopName: `Test Pharmacy ${timestamp}`,
    email: `shop_${timestamp}@test.com`,
    password: 'password123',
    confirmPassword: 'password123'
  };

  try {
    // 1. Register Shop
    console.log('\n1. Registering Shop...');
    const registerShopRes = await fetch(`${BASE_URL}/auth/shop/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testShop)
    });
    const registerShopData = await registerShopRes.json();
    if (registerShopRes.status !== 201) throw new Error(`Shop registration failed: ${registerShopData.error}`);
    shopToken = registerShopData.token;
    shopId = registerShopData.shop.id;
    console.log(`✅ Shop Registered. ID: ${shopId}`);

    // 2. Login Shop
    console.log('\n2. Logging in Shop...');
    const loginShopRes = await fetch(`${BASE_URL}/auth/shop/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testShop.email, password: testShop.password })
    });
    const loginShopData = await loginShopRes.json();
    if (loginShopRes.status !== 200) throw new Error(`Shop login failed: ${loginShopData.error}`);
    console.log(`✅ Shop Logged In.`);

    // 3. Update Shop Location Details
    console.log('\n3. Setting Shop Location Details...');
    const updateLocationRes = await fetch(`${BASE_URL}/shop/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${shopToken}`
      },
      body: JSON.stringify({
        address: '12 Main Street, Connaught Place, New Delhi',
        phone: '+919876543210',
        latitude: 28.6304, // Delhi coordinates
        longitude: 77.2177
      })
    });
    const updateLocationData = await updateLocationRes.json();
    if (updateLocationRes.status !== 200) throw new Error(`Update profile failed: ${updateLocationData.error}`);
    console.log(`✅ Shop Coordinates configured: [${updateLocationData.shop.location.coordinates.join(', ')}]`);

    // 4. Add Medicine to Inventory
    console.log('\n4. Adding Paracetamol to Inventory...');
    const addMedRes = await fetch(`${BASE_URL}/shop/inventory`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${shopToken}`
      },
      body: JSON.stringify({
        medicineName: 'Paracetamol 650mg',
        price: '4.50',
        isOutOfStock: false
      })
    });
    const addMedData = await addMedRes.json();
    if (addMedRes.status !== 201) throw new Error(`Add medicine failed: ${addMedData.error}`);
    const medId = addMedData.item._id;
    console.log(`✅ Added ${addMedData.item.medicineName} ($${addMedData.item.price})`);

    // 5. Register User (Mobile)
    console.log('\n5. Registering User...');
    const registerUserRes = await fetch(`${BASE_URL}/auth/user/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testUser)
    });
    const registerUserData = await registerUserRes.json();
    if (registerUserRes.status !== 201) throw new Error(`User registration failed: ${registerUserData.error}`);
    userToken = registerUserData.token;
    console.log(`✅ User Registered: ${registerUserData.user.username}`);

    // 6. User Search Medicine (Geospatial sorted)
    console.log('\n6. Geospatial Searching for "paracetamol" nearby (Delhi)...');
    // Search close to CP Delhi coordinates
    const searchRes = await fetch(`${BASE_URL}/user/search?query=paracetamol&lat=28.6139&lng=77.2090&radius=10`, {
      headers: { 'Authorization': `Bearer ${userToken}` }
    });
    const searchData = await searchRes.json();
    if (searchRes.status !== 200) throw new Error(`Search failed: ${searchData.error}`);
    console.log(`✅ Search query completed. Found ${searchData.count} shops.`);
    searchData.results.forEach((shop, index) => {
      console.log(`   [${index + 1}] ${shop.shopName} - Distance: ${shop.distanceInKm} km away`);
      shop.medicines.forEach(m => {
        console.log(`       - Medicine: ${m.medicineName} ($${m.price})`);
      });
    });

    // 7. Get User Search History
    console.log('\n7. Checking Search History...');
    const historyRes = await fetch(`${BASE_URL}/user/history`, {
      headers: { 'Authorization': `Bearer ${userToken}` }
    });
    const historyData = await historyRes.json();
    if (historyRes.status !== 200) throw new Error(`Get history failed: ${historyData.error}`);
    console.log(`✅ Fetched Search History. Total queries in history: ${historyData.searchHistory.length}`);
    historyData.searchHistory.forEach(item => {
      console.log(`   - "${item.query}" searched on ${item.timestamp}`);
    });

    console.log('\n🎉 ALL API INTEGRATION TESTS PASSED SUCCESSFULLY! 🎉');
  } catch (err) {
    console.error(`\n❌ TEST FAILS: ${err.message}`);
    process.exit(1);
  }
}

// Check if running directly
if (require.main === module) {
  runTests();
}
