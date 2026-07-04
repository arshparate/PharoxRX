import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'api_service.dart';

class MapScreen extends StatefulWidget {
  final List<dynamic> searchResults;
  final double userLat;
  final double userLng;
  final double radiusInKm;
  final String? focusShopId;

  const MapScreen({
    super.key,
    required this.searchResults,
    required this.userLat,
    required this.userLng,
    required this.radiusInKm,
    this.focusShopId,
  });

  @override
  State<MapScreen> createState() => _MapScreenState();
}

class _MapScreenState extends State<MapScreen> {
  final MapController _mapController = MapController();
  Map<String, dynamic>? _selectedShop;

  @override
  void initState() {
    super.initState();
    // Set default selected shop if focused
    if (widget.focusShopId != null) {
      final matches = widget.searchResults.where((s) => s['shopId'] == widget.focusShopId);
      if (matches.isNotEmpty) {
        _selectedShop = matches.first;
      }
    }
  }

  LatLng _getShopLatLng(Map<String, dynamic> shop) {
    final location = shop['location'];
    if (location != null && location['coordinates'] != null) {
      final List coordinates = location['coordinates'];
      // coordinates = [longitude, latitude]
      return LatLng(
        double.tryParse(coordinates[1].toString()) ?? widget.userLat,
        double.tryParse(coordinates[0].toString()) ?? widget.userLng,
      );
    }
    return LatLng(widget.userLat, widget.userLng);
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    // Center map on focused shop or user coordinates
    LatLng center = LatLng(widget.userLat, widget.userLng);
    double initialZoom = 13.0;
    
    if (_selectedShop != null) {
      center = _getShopLatLng(_selectedShop!);
      initialZoom = 14.5;
    }

    return Scaffold(
      appBar: AppBar(
        title: const Text('Pharmacy Map Locator'),
      ),
      body: Stack(
        children: [
          // 1. FLUTTER MAP WIDGET
          FlutterMap(
            mapController: _mapController,
            options: MapOptions(
              initialCenter: center,
              initialZoom: initialZoom,
              maxZoom: 18.0,
            ),
            children: [
              // OpenStreetMap Tile Layer
              TileLayer(
                urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                userAgentPackageName: 'com.pharma.management',
              ),
              
              // Radius Circle Layer
              CircleLayer(
                circles: [
                  CircleMarker(
                    point: LatLng(widget.userLat, widget.userLng),
                    color: theme.primaryColor.withOpacity(0.15),
                    borderColor: theme.primaryColor.withOpacity(0.6),
                    borderStrokeWidth: 2.0,
                    useRadiusInMeter: true,
                    radius: widget.radiusInKm * 1000,
                  ),
                ],
              ),
              
              // Markers Layer
              MarkerLayer(
                markers: [
                  // User Location Dot Marker
                  Marker(
                    point: LatLng(widget.userLat, widget.userLng),
                    width: 32,
                    height: 32,
                    child: Container(
                      decoration: BoxDecoration(
                        color: Colors.blue.withOpacity(0.2),
                        shape: BoxShape.circle,
                        border: Border.all(color: Colors.blue, width: 2),
                      ),
                      child: Center(
                        child: Container(
                          width: 12,
                          height: 12,
                          decoration: const BoxDecoration(
                            color: Colors.blue,
                            shape: BoxShape.circle,
                          ),
                        ),
                      ),
                    ),
                  ),
                  
                  // Shop Markers
                  ...widget.searchResults.map((shop) {
                    final latLng = _getShopLatLng(shop);
                    final isSelected = _selectedShop != null && _selectedShop!['shopId'] == shop['shopId'];

                    return Marker(
                      point: latLng,
                      width: 45,
                      height: 45,
                      child: GestureDetector(
                        onTap: () {
                          setState(() => _selectedShop = shop);
                          _mapController.move(latLng, 14.5);
                        },
                        child: Column(
                          children: [
                            Container(
                              padding: const EdgeInsets.all(4),
                              decoration: BoxDecoration(
                                color: isSelected ? theme.primaryColor : Colors.white,
                                shape: BoxShape.circle,
                                border: Border.all(
                                  color: isSelected ? Colors.white : theme.primaryColor,
                                  width: 2.5,
                                ),
                                boxShadow: const [
                                  BoxShadow(
                                    color: Colors.black26,
                                    blurRadius: 6,
                                    offset: Offset(0, 3),
                                  ),
                                ],
                              ),
                              child: Icon(
                                Icons.local_pharmacy,
                                size: 18,
                                color: isSelected ? Colors.white : theme.primaryColor,
                              ),
                            ),
                          ],
                        ),
                      ),
                    );
                  }).toList(),
                ],
              ),
            ],
          ),

          // 2. BOTTOM DETAILS PANEL
          if (_selectedShop != null)
            Positioned(
              bottom: 24,
              left: 16,
              right: 16,
              child: Card(
                elevation: 8,
                shadowColor: Colors.black38,
                child: Padding(
                  padding: const EdgeInsets.all(16.0),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      // Header details
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          ClipRRect(
                            borderRadius: BorderRadius.circular(8),
                            child: _selectedShop!['shopImage'] != null
                                ? Image.network(
                                    '${ApiService.baseUrl.replaceAll('/api', '')}${_selectedShop!['shopImage']}',
                                    width: 48,
                                    height: 48,
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
                                  _selectedShop!['shopName'] ?? '',
                                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18),
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  _selectedShop!['address'] ?? '',
                                  style: TextStyle(color: Colors.grey[500], fontSize: 13),
                                  maxLines: 2,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ],
                            ),
                          ),
                          IconButton(
                            icon: const Icon(Icons.close),
                            onPressed: () => setState(() => _selectedShop = null),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      
                      // Price listing
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                        decoration: BoxDecoration(
                          color: theme.primaryColor.withOpacity(0.06),
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: theme.primaryColor.withOpacity(0.15)),
                        ),
                        child: Column(
                          children: (_selectedShop!['medicines'] as List).map((med) {
                            return Padding(
                              padding: const EdgeInsets.symmetric(vertical: 2.0),
                              child: Row(
                                 mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                 children: [
                                  Text(
                                    med['medicineName'] ?? '',
                                    style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
                                  ),
                                  Text(
                                    '\$${double.parse(med['price'].toString()).toStringAsFixed(2)}',
                                    style: TextStyle(
                                      fontWeight: FontWeight.w800,
                                      color: theme.primaryColor,
                                      fontSize: 13,
                                    ),
                                  ),
                                ],
                              ),
                            );
                          }).toList(),
                        ),
                      ),
                      const SizedBox(height: 12),
                      
                      // Quick CTA call
                      Row(
                        children: [
                          if (_selectedShop!['phone'] != null)
                            Expanded(
                              child: OutlinedButton(
                                onPressed: () {
                                  showDialog(
                                    context: context,
                                    builder: (_) => AlertDialog(
                                      title: Text(_selectedShop!['shopName']),
                                      content: Text('Contact details:\n${_selectedShop!['phone']}'),
                                      actions: [
                                        TextButton(
                                          onPressed: () => Navigator.pop(context),
                                          child: const Text('OK'),
                                        ),
                                      ],
                                    ),
                                  );
                                },
                                style: OutlinedButton.styleFrom(
                                  padding: const EdgeInsets.symmetric(vertical: 12),
                                ),
                                child: const Row(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    Icon(Icons.phone, size: 16),
                                    SizedBox(width: 8),
                                    Text('Contact Shop', style: TextStyle(fontSize: 13)),
                                  ],
                                ),
                              ),
                            ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: ElevatedButton(
                              onPressed: () {
                                final latLng = _getShopLatLng(_selectedShop!);
                                _mapController.move(latLng, 16.0);
                              },
                              style: ElevatedButton.styleFrom(
                                padding: const EdgeInsets.symmetric(vertical: 12),
                              ),
                              child: const Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Icon(Icons.gps_fixed, size: 16),
                                  SizedBox(width: 8),
                                  Text('Focus on Map', style: TextStyle(fontSize: 13)),
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
            ),
            // 3. ZOOM BUTTON CONTROLS
            Positioned(
              top: 20,
              right: 16,
              child: Column(
                children: [
                  FloatingActionButton(
                    heroTag: 'zoom_in',
                    mini: true,
                    backgroundColor: theme.cardTheme.color ?? theme.colorScheme.surface,
                    foregroundColor: theme.primaryColor,
                    onPressed: () {
                      final currentZoom = _mapController.camera.zoom;
                      _mapController.move(_mapController.camera.center, currentZoom + 1.0);
                    },
                    child: const Icon(Icons.add),
                  ),
                  const SizedBox(height: 8),
                  FloatingActionButton(
                    heroTag: 'zoom_out',
                    mini: true,
                    backgroundColor: theme.cardTheme.color ?? theme.colorScheme.surface,
                    foregroundColor: theme.primaryColor,
                    onPressed: () {
                      final currentZoom = _mapController.camera.zoom;
                      _mapController.move(_mapController.camera.center, currentZoom - 1.0);
                    },
                    child: const Icon(Icons.remove),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildShopPlaceholder(ThemeData theme) {
    return Container(
      width: 48,
      height: 48,
      color: theme.primaryColor.withOpacity(0.1),
      child: Icon(Icons.store, color: theme.primaryColor),
    );
  }
}

