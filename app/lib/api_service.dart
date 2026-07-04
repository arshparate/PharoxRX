import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

class ApiService {
  // Set this to your production Render URL (e.g. 'https://your-pharma-backend.onrender.com/api')
  // for hosting and APK building. Leave as null for local development.
  static const String? productionUrl = null;

  // Dynamically resolve base URL for emulator vs web/desktop
  static String get baseUrl {
    if (productionUrl != null) return productionUrl!;
    if (kIsWeb) return 'http://localhost:5000/api';
    try {
      if (Platform.isAndroid) {
        return 'http://10.0.2.2:5000/api'; // Android emulator redirects to host localhost
      }
    } catch (_) {}
    return 'http://localhost:5000/api';
  }

  // Session keys
  static const String _tokenKey = 'user_jwt_token';
  static const String _userKey = 'user_metadata';

  // --- LOCAL PERSISTENCE ---
  
  static Future<void> saveSession(String token, Map<String, dynamic> user) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_tokenKey, token);
    await prefs.setString(_userKey, json.encode(user));
  }

  static Future<String?> getToken() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_tokenKey);
  }

  static Future<Map<String, dynamic>?> getUser() async {
    final prefs = await SharedPreferences.getInstance();
    final userStr = prefs.getString(_userKey);
    if (userStr == null) return null;
    return json.decode(userStr) as Map<String, dynamic>;
  }

  static Future<void> clearSession() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_tokenKey);
    await prefs.remove(_userKey);
  }

  // --- AUTH SERVICES ---

  static Future<Map<String, dynamic>> register({
    required String username,
    required String email,
    required String password,
    required String confirmPassword,
  }) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/auth/user/register'),
        headers: {'Content-Type': 'application/json'},
        body: json.encode({
          'username': username,
          'email': email,
          'password': password,
          'confirmPassword': confirmPassword,
        }),
      );

      final data = json.decode(response.body);
      if (response.statusCode == 201) {
        return {'success': true, 'token': data['token'], 'user': data['user']};
      } else {
        return {'success': false, 'error': data['error'] ?? 'Registration failed'};
      }
    } catch (e) {
      return {'success': false, 'error': 'Connection error. Check backend.'};
    }
  }

  static Future<Map<String, dynamic>> login({
    required String email,
    required String password,
  }) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/auth/user/login'),
        headers: {'Content-Type': 'application/json'},
        body: json.encode({
          'email': email,
          'password': password,
        }),
      );

      final data = json.decode(response.body);
      if (response.statusCode == 200) {
        return {'success': true, 'token': data['token'], 'user': data['user']};
      } else {
        return {'success': false, 'error': data['error'] ?? 'Login failed'};
      }
    } catch (e) {
      return {'success': false, 'error': 'Connection error. Check backend.'};
    }
  }

  // --- MEDICINE SEARCH SERVICES ---

  static Future<Map<String, dynamic>> searchMedicines({
    required String query,
    double? latitude,
    double? longitude,
    double radiusInKm = 50.0,
  }) async {
    try {
      final token = await getToken();
      if (token == null) return {'success': false, 'error': 'Unauthorized'};

      String url = '$baseUrl/user/search?query=${Uri.encodeComponent(query)}&radius=$radiusInKm';
      if (latitude != null && longitude != null) {
        url += '&lat=$latitude&lng=$longitude';
      }

      final response = await http.get(
        Uri.parse(url),
        headers: {
          'Authorization': 'Bearer $token',
          'Content-Type': 'application/json',
        },
      );

      final data = json.decode(response.body);
      if (response.statusCode == 200) {
        return {'success': true, 'results': data['results'] ?? []};
      } else {
        return {'success': false, 'error': data['error'] ?? 'Search failed'};
      }
    } catch (e) {
      return {'success': false, 'error': 'Connection error'};
    }
  }

  // --- SEARCH HISTORY SERVICES ---

  static Future<List<dynamic>> getSearchHistory() async {
    try {
      final token = await getToken();
      if (token == null) return [];

      final response = await http.get(
        Uri.parse('$baseUrl/user/history'),
        headers: {
          'Authorization': 'Bearer $token',
          'Content-Type': 'application/json',
        },
      );

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        return data['searchHistory'] ?? [];
      }
    } catch (_) {}
    return [];
  }

  static Future<bool> clearSearchHistory() async {
    try {
      final token = await getToken();
      if (token == null) return false;

      final response = await http.delete(
        Uri.parse('$baseUrl/user/history'),
        headers: {
          'Authorization': 'Bearer $token',
        },
      );

      return response.statusCode == 200;
    } catch (_) {}
    return false;
  }

  static Future<Map<String, dynamic>> getShopInventoryForUser(String shopId) async {
    try {
      final token = await getToken();
      if (token == null) return {'success': false, 'error': 'Unauthorized'};

      final response = await http.get(
        Uri.parse('$baseUrl/user/shop/$shopId/inventory'),
        headers: {
          'Authorization': 'Bearer $token',
          'Content-Type': 'application/json',
        },
      );

      final data = json.decode(response.body);
      if (response.statusCode == 200) {
        return {'success': true, 'shop': data['shop'], 'inventory': data['inventory'] ?? []};
      } else {
        return {'success': false, 'error': data['error'] ?? 'Failed to load shop catalog'};
      }
    } catch (e) {
      return {'success': false, 'error': 'Connection error'};
    }
  }
}
