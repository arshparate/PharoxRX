import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import 'package:geolocator/geolocator.dart';
import 'api_service.dart';
import 'auth_screen.dart';
import 'map_screen.dart';
import 'profile_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final _searchController = TextEditingController();
  
  bool _isLoading = false;
  double _radius = 10.0; // Search radius in km
  List<dynamic> _searchResults = [];
  List<dynamic> _searchHistory = [];
  
  // Simulated User Location (New Delhi center)
  double _userLat = 28.6139;
  double _userLng = 77.2090;
  bool _isGpsActive = false;

  // Bottom Navigation Index
  int _currentIndex = 0;

  @override
  void initState() {
    super.initState();
    _loadSearchHistory();
    _getCurrentLocation(); // Automatically request location on load
  }

  Future<void> _getCurrentLocation() async {
    bool serviceEnabled;
    LocationPermission permission;

    try {
      // Geolocator.isLocationServiceEnabled() checks device-specific OS settings.
      // On web/browsers, we can directly request geolocation permissions.
      if (!kIsWeb) {
        serviceEnabled = await Geolocator.isLocationServiceEnabled();
        if (!serviceEnabled) {
          debugPrint('Location services are disabled on device.');
          return;
        }
      }

      permission = await Geolocator.checkPermission();
      debugPrint('Current GPS Permission Status: $permission');

      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
        if (permission == LocationPermission.denied) {
          debugPrint('GPS Permission was denied.');
          return;
        }
      }
      
      if (permission == LocationPermission.deniedForever) {
        debugPrint('GPS Permission is permanently denied.');
        return;
      } 

      debugPrint('Fetching GPS position...');
      final position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          timeLimit: Duration(seconds: 8),
        ),
      );
      
      debugPrint('Successfully fetched GPS position: ${position.latitude}, ${position.longitude}');

      setState(() {
        _userLat = position.latitude;
        _userLng = position.longitude;
        _isGpsActive = true;
      });
    } catch (e) {
      debugPrint('Error getting GPS location: $e');
    }
  }

  Future<void> _loadSearchHistory() async {
    final history = await ApiService.getSearchHistory();
    setState(() => _searchHistory = history);
  }

  Future<void> _performSearch(String query) async {
    if (query.trim().isEmpty) return;
    
    _searchController.text = query;
    setState(() => _isLoading = true);
    
    final response = await ApiService.searchMedicines(
      query: query.trim(),
      latitude: _userLat,
      longitude: _userLng,
      radiusInKm: _radius,
    );

    setState(() => _isLoading = false);

    if (response['success'] == true) {
      setState(() {
        _searchResults = response['results'] ?? [];
      });
      _loadSearchHistory(); // refresh history list
    } else {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(response['error'] ?? 'Search failed'),
            backgroundColor: Colors.red[600],
          ),
        );
      }
    }
  }

  void _clearHistory() async {
    final success = await ApiService.clearSearchHistory();
    if (success) {
      setState(() => _searchHistory = []);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Search history cleared')),
        );
      }
    }
  }

  void _toggleTab(int index) {
    if (index == _currentIndex) return;

    if (index == 1) {
      // Map view
      Navigator.of(context).push(
        MaterialPageRoute(
          builder: (_) => MapScreen(
            searchResults: _searchResults,
            userLat: _userLat,
            userLng: _userLng,
            radiusInKm: _radius,
          ),
        ),
      );
    } else if (index == 2) {
      // Profile view
      Navigator.of(context).push(
        MaterialPageRoute(
          builder: (_) => ProfileScreen(
            onLogout: () {
              Navigator.of(context).pushReplacement(
                MaterialPageRoute(builder: (_) => const AuthScreen()),
              );
            },
          ),
        ),
      ).then((_) => _loadSearchHistory());
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    return Scaffold(
      appBar: AppBar(
        title: Row(
          children: [
            Hero(
              tag: 'logo',
              child: ClipRRect(
                borderRadius: BorderRadius.circular(20),
                child: Image.asset(
                  'assets/logo.jpeg',
                  width: 32,
                  height: 32,
                  fit: BoxFit.cover,
                  errorBuilder: (context, error, stackTrace) => Icon(
                    Icons.local_pharmacy,
                    color: theme.primaryColor,
                  ),
                ),
              ),
            ),
            const SizedBox(width: 10),
            const Text('PharmaCare'),
          ],
        ),
        actions: [
          // Simulated location display/editor
          Padding(
            padding: const EdgeInsets.only(right: 8.0),
            child: TextButton.icon(
              icon: Icon(
                _isGpsActive ? Icons.gps_fixed : Icons.location_on, 
                size: 16, 
                color: _isGpsActive ? Colors.tealAccent : theme.primaryColor
              ),
              label: Text(
                _isGpsActive ? 'GPS Active' : 'Delhi (Simulated)',
                style: TextStyle(
                  fontSize: 12, 
                  color: _isGpsActive 
                      ? Colors.teal 
                      : (isDark ? Colors.white70 : Colors.black87),
                  fontWeight: _isGpsActive ? FontWeight.bold : FontWeight.normal
                ),
              ),
              onPressed: () {
                showDialog(
                  context: context,
                  builder: (context) => AlertDialog(
                    title: Text(_isGpsActive ? 'Active GPS Coordinates' : 'Simulated Location Coordinates'),
                    content: Text(
                      _isGpsActive
                          ? 'Your current GPS position is:\n\nLatitude: $_userLat\nLongitude: $_userLng\n\nDistance calculations are active based on your live location.'
                          : 'Your simulated GPS position is:\n\nLatitude: $_userLat\nLongitude: $_userLng\n\nThis coordinate is used to compute shop distances. Grant GPS permissions to use your live location.',
                    ),
                    actions: [
                      if (!_isGpsActive)
                        TextButton(
                          onPressed: () {
                            Navigator.pop(context);
                            _getCurrentLocation();
                          },
                          child: const Text('Enable GPS'),
                        ),
                      TextButton(
                        onPressed: () => Navigator.pop(context),
                        child: const Text('OK'),
                      ),
                    ],
                  ),
                );
              },
            ),
          ),
        ],
      ),
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Search & Radius Card
          Padding(
            padding: const EdgeInsets.all(16.0),
            child: Card(
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: Column(
                  children: [
                    // Search Bar
                    TextField(
                      controller: _searchController,
                      decoration: InputDecoration(
                        hintText: 'Enter medicine name...',
                        prefixIcon: const Icon(Icons.search),
                        suffixIcon: IconButton(
                          icon: const Icon(Icons.send),
                          onPressed: () => _performSearch(_searchController.text),
                        ),
                      ),
                      onSubmitted: _performSearch,
                    ),
                    const SizedBox(height: 12),
                    
                    // Radius Slider Row
                    Row(
                      children: [
                        const Icon(Icons.radar, size: 18, color: Colors.grey),
                        const SizedBox(width: 8),
                        Text(
                          'Search Radius: ${_radius.round()} km',
                          style: const TextStyle(fontWeight: FontWeight.w500, fontSize: 13),
                        ),
                        Expanded(
                          child: Slider(
                            value: _radius,
                            min: 1.0,
                            max: 100.0,
                            divisions: 99,
                            activeColor: theme.primaryColor,
                            label: '${_radius.round()} km',
                            onChanged: (val) {
                              setState(() => _radius = val);
                            },
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ),

          // Search History (Chips)
          if (_searchHistory.isNotEmpty) ...[
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16.0),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'Recent Searches (7 days)',
                    style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                  ),
                  GestureDetector(
                    onTap: _clearHistory,
                    child: const Text(
                      'Clear',
                      style: TextStyle(color: Colors.red, fontWeight: FontWeight.bold, fontSize: 12),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 8),
            SizedBox(
              height: 38,
              child: ListView.builder(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 16.0),
                itemCount: _searchHistory.length,
                itemBuilder: (context, index) {
                  final item = _searchHistory[index];
                  return Padding(
                    padding: const EdgeInsets.only(right: 8.0),
                    child: ActionChip(
                      label: Text(item['query'] ?? ''),
                      labelStyle: TextStyle(
                        fontSize: 12,
                        color: isDark ? Colors.teal[200] : theme.primaryColor,
                      ),
                      backgroundColor: theme.primaryColor.withOpacity(0.08),
                      side: BorderSide(color: theme.primaryColor.withOpacity(0.2)),
                      onPressed: () => _performSearch(item['query']),
                    ),
                  );
                },
              ),
            ),
            const SizedBox(height: 16),
          ],

          // Results Title
          const Padding(
            padding: EdgeInsets.symmetric(horizontal: 16.0),
            child: Text(
              'Pharmacies Nearby',
              style: TextStyle(fontWeight: FontWeight.w800, fontSize: 18),
            ),
          ),
          const SizedBox(height: 8),

          // Loading and Result list
          Expanded(
            child: _isLoading
                ? Center(
                    child: CircularProgressIndicator(
                      valueColor: AlwaysStoppedAnimation<Color>(theme.primaryColor),
                    ),
                  )
                : _searchResults.isEmpty
                    ? Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.medication_liquid, size: 64, color: Colors.grey.withOpacity(0.4)),
                            const SizedBox(height: 12),
                            Text(
                              'Search for a medicine to see shops',
                              style: TextStyle(color: Colors.grey[500], fontSize: 14),
                            ),
                          ],
                        ),
                      )
                    : ListView.builder(
                        padding: const EdgeInsets.symmetric(horizontal: 16.0),
                        itemCount: _searchResults.length,
                        itemBuilder: (context, index) {
                          final shopItem = _searchResults[index];
                          final List medicines = shopItem['medicines'] ?? [];
                          final double distance = shopItem['distanceInKm'] ?? 0.0;

                          return Card(
                            margin: const EdgeInsets.only(bottom: 12.0),
                            child: InkWell(
                              borderRadius: BorderRadius.circular(16),
                              onTap: () => _showShopInventoryCatalog(shopItem['shopId'] ?? '', shopItem['shopName'] ?? 'Pharmacy'),
                              child: Padding(
                                padding: const EdgeInsets.all(16.0),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.stretch,
                                  children: [
                                  // Shop details header
                                  Row(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      // Shop image or placeholder
                                      ClipRRect(
                                        borderRadius: BorderRadius.circular(8),
                                        child: shopItem['shopImage'] != null
                                            ? Image.network(
                                                '${ApiService.baseUrl.replaceAll('/api', '')}${shopItem['shopImage']}',
                                                width: 50,
                                                height: 50,
                                                fit: BoxFit.cover,
                                                errorBuilder: (_, __, ___) => _buildShopPlaceholder(theme),
                                              )
                                            : _buildShopPlaceholder(theme),
                                      ),
                                      const SizedBox(width: 12),
                                      Expanded(
                                        child: Column(
                                          crossAxisAlignment: CrossAxisAlignment.start,
                                          children: [
                                            Text(
                                              shopItem['shopName'] ?? 'Pharmacy',
                                              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                                            ),
                                            const SizedBox(height: 2),
                                            Text(
                                              shopItem['address'] ?? 'No address provided',
                                              style: TextStyle(color: Colors.grey[500], fontSize: 12),
                                              maxLines: 2,
                                              overflow: TextOverflow.ellipsis,
                                            ),
                                          ],
                                        ),
                                      ),
                                      // Distance label
                                      Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                        decoration: BoxDecoration(
                                          color: theme.primaryColor.withOpacity(0.1),
                                          borderRadius: BorderRadius.circular(8),
                                        ),
                                        child: Text(
                                          '${distance.toStringAsFixed(1)} km',
                                          style: TextStyle(
                                            color: theme.primaryColor,
                                            fontWeight: FontWeight.bold,
                                            fontSize: 11,
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                  const Divider(height: 24),
                                  
                                  // Medicine info list
                                  Column(
                                    children: medicines.map((med) {
                                      return Padding(
                                        padding: const EdgeInsets.symmetric(vertical: 4.0),
                                        child: Row(
                                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                          children: [
                                            Row(
                                              children: [
                                                Icon(Icons.fiber_manual_record, size: 8, color: theme.primaryColor),
                                                const SizedBox(width: 8),
                                                Text(
                                                  med['medicineName'] ?? '',
                                                  style: const TextStyle(fontWeight: FontWeight.w500, fontSize: 14),
                                                ),
                                              ],
                                            ),
                                            Text(
                                              '\$${parseFloat(med['price']).toStringAsFixed(2)}',
                                              style: TextStyle(
                                                fontWeight: FontWeight.bold,
                                                color: theme.primaryColor,
                                                fontSize: 14,
                                              ),
                                            ),
                                          ],
                                        ),
                                      );
                                    }).toList(),
                                  ),
                                  const SizedBox(height: 12),
                                  
                                  // Actions row
                                  Row(
                                    children: [
                                      Expanded(
                                        child: OutlinedButton(
                                          onPressed: () {
                                            if (shopItem['phone'] != null) {
                                              showDialog(
                                                context: context,
                                                builder: (_) => AlertDialog(
                                                  title: Text(shopItem['shopName']),
                                                  content: Text('Phone number: ${shopItem['phone']}'),
                                                  actions: [
                                                    TextButton(
                                                      onPressed: () => Navigator.pop(context),
                                                      child: const Text('Close'),
                                                    ),
                                                  ],
                                                ),
                                              );
                                            }
                                          },
                                          style: OutlinedButton.styleFrom(
                                            padding: const EdgeInsets.symmetric(vertical: 8),
                                          ),
                                          child: const Row(
                                            mainAxisAlignment: MainAxisAlignment.center,
                                            children: [
                                              Icon(Icons.phone, size: 16),
                                              SizedBox(width: 6),
                                              Text('Call', style: TextStyle(fontSize: 13)),
                                            ],
                                          ),
                                        ),
                                      ),
                                      const SizedBox(width: 8),
                                      Expanded(
                                        child: ElevatedButton(
                                          onPressed: () {
                                            Navigator.push(
                                              context,
                                              MaterialPageRoute(
                                                builder: (_) => MapScreen(
                                                  searchResults: [shopItem],
                                                  userLat: _userLat,
                                                  userLng: _userLng,
                                                  radiusInKm: _radius,
                                                  focusShopId: shopItem['shopId'],
                                                ),
                                              ),
                                            );
                                          },
                                          style: ElevatedButton.styleFrom(
                                            padding: const EdgeInsets.symmetric(vertical: 8),
                                          ),
                                          child: const Row(
                                            mainAxisAlignment: MainAxisAlignment.center,
                                            children: [
                                              Icon(Icons.map, size: 16),
                                              SizedBox(width: 6),
                                              Text('Map Location', style: TextStyle(fontSize: 13)),
                                            ],
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                ],
                              ),
                            ),
                          ),
                        );
                        },
                      ),
          ),
        ],
      ),
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _currentIndex,
        selectedItemColor: theme.primaryColor,
        onTap: _toggleTab,
        items: const [
          BottomNavigationBarItem(
            icon: Icon(Icons.search),
            label: 'Search',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.map_outlined),
            label: 'Map View',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.person_outline),
            label: 'Profile',
          ),
        ],
      ),
    );
  }

  void _showShopInventoryCatalog(String shopId, String shopName) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) {
        return DraggableScrollableSheet(
          initialChildSize: 0.75,
          minChildSize: 0.5,
          maxChildSize: 0.95,
          builder: (context, scrollController) {
            final theme = Theme.of(context);
            final isDark = theme.brightness == Brightness.dark;
            return Container(
              decoration: BoxDecoration(
                color: theme.scaffoldBackgroundColor,
                borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
                boxShadow: [
                  BoxShadow(
                    color: isDark ? Colors.black54 : Colors.black12,
                    blurRadius: 10,
                    spreadRadius: 2,
                  ),
                ],
              ),
              padding: const EdgeInsets.all(24),
              child: FutureBuilder<Map<String, dynamic>>(
                future: ApiService.getShopInventoryForUser(shopId),
                builder: (context, snapshot) {
                  if (snapshot.connectionState == ConnectionState.waiting) {
                    return const Center(child: CircularProgressIndicator());
                  }

                  if (snapshot.hasError || snapshot.data == null || snapshot.data!['success'] != true) {
                    return Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Icon(Icons.error_outline, size: 48, color: Colors.red),
                          const SizedBox(height: 12),
                          Text(
                            snapshot.data?['error'] ?? 'Failed to load shop catalog',
                            style: const TextStyle(fontWeight: FontWeight.w600),
                          ),
                        ],
                      ),
                    );
                  }

                  final shopData = snapshot.data!['shop'] ?? {};
                  final List inventory = snapshot.data!['inventory'] ?? [];

                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Center(
                        child: Container(
                          width: 40,
                          height: 5,
                          margin: const EdgeInsets.only(bottom: 20),
                          decoration: BoxDecoration(
                            color: isDark ? Colors.grey[700] : Colors.grey[300],
                            borderRadius: BorderRadius.circular(10),
                          ),
                        ),
                      ),
                      Text(
                        shopName,
                        style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 22),
                      ),
                      if (shopData['address'] != null) ...[
                        const SizedBox(height: 4),
                        Text(
                          shopData['address'],
                          style: TextStyle(color: isDark ? Colors.white70 : Colors.black54, fontSize: 13),
                        ),
                      ],
                      if (shopData['phone'] != null) ...[
                        const SizedBox(height: 6),
                        Row(
                          children: [
                            Icon(Icons.phone, size: 14, color: theme.primaryColor),
                            const SizedBox(width: 6),
                            Text(
                              shopData['phone'],
                              style: TextStyle(
                                color: theme.primaryColor, 
                                fontSize: 13,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ],
                        ),
                      ],
                      const Divider(height: 32),
                      const Text(
                        'Medicine Inventory',
                        style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                      ),
                      const SizedBox(height: 12),
                      Expanded(
                        child: inventory.isEmpty
                            ? Center(
                                child: Text(
                                  'This shop has not uploaded any medicine inventory yet.',
                                  style: TextStyle(color: Colors.grey[500]),
                                ),
                              )
                            : ListView.builder(
                                controller: scrollController,
                                itemCount: inventory.length,
                                itemBuilder: (context, index) {
                                  final med = inventory[index];
                                  final bool isAvailable = med['isAvailable'] ?? true;
                                  
                                  return Card(
                                    margin: const EdgeInsets.only(bottom: 8.0),
                                    child: ListTile(
                                      leading: ClipRRect(
                                        borderRadius: BorderRadius.circular(8),
                                        child: med['medicineImage'] != null
                                            ? Image.network(
                                                '${ApiService.baseUrl.replaceAll('/api', '')}${med['medicineImage']}',
                                                width: 44,
                                                height: 44,
                                                fit: BoxFit.cover,
                                                errorBuilder: (_, __, ___) => const Icon(Icons.medication),
                                              )
                                            : Container(
                                                width: 44,
                                                height: 44,
                                                color: theme.primaryColor.withOpacity(0.08),
                                                child: Icon(Icons.medication, color: theme.primaryColor),
                                              ),
                                      ),
                                      title: Text(
                                        med['medicineName'] ?? '',
                                        style: const TextStyle(fontWeight: FontWeight.bold),
                                      ),
                                      subtitle: Text(
                                        '\$${parseFloat(med['price']).toStringAsFixed(2)}',
                                        style: TextStyle(
                                          fontWeight: FontWeight.w800,
                                          color: theme.primaryColor,
                                        ),
                                      ),
                                      trailing: Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                        decoration: BoxDecoration(
                                          color: isAvailable
                                              ? Colors.green.withOpacity(0.1)
                                              : Colors.red.withOpacity(0.1),
                                          borderRadius: BorderRadius.circular(20),
                                        ),
                                        child: Text(
                                          isAvailable ? 'Available' : 'Out of Stock',
                                          style: TextStyle(
                                            color: isAvailable ? Colors.green : Colors.red,
                                            fontWeight: FontWeight.bold,
                                            fontSize: 12,
                                          ),
                                        ),
                                      ),
                                    ),
                                  );
                                },
                              ),
                      ),
                    ],
                  );
                },
              ),
            );
          },
        );
      },
    );
  }
  
  Widget _buildShopPlaceholder(ThemeData theme) {
    return Container(
      width: 50,
      height: 50,
      color: theme.primaryColor.withOpacity(0.1),
      child: Icon(Icons.store, color: theme.primaryColor),
    );
  }

  // Safe parsing helper
  double parseFloat(dynamic val) {
    if (val == null) return 0.0;
    if (val is double) return val;
    if (val is int) return val.toDouble();
    return double.tryParse(val.toString()) ?? 0.0;
  }
}

