import 'package:flutter/material.dart';
import 'api_service.dart';
import 'main.dart'; // To access MyApp's theme changer

class ProfileScreen extends StatefulWidget {
  final VoidCallback onLogout;

  const ProfileScreen({super.key, required this.onLogout});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  Map<String, dynamic>? _user;
  List<dynamic> _history = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadProfileData();
  }

  Future<void> _loadProfileData() async {
    setState(() => _isLoading = true);
    final user = await ApiService.getUser();
    final history = await ApiService.getSearchHistory();

    setState(() {
      _user = user;
      _history = history;
      _isLoading = false;
    });
  }

  void _clearSearchHistory() async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Clear History'),
        content: const Text('Are you sure you want to clear your search history?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
          TextButton(onPressed: () => Navigator.pop(context, true), child: const Text('Clear')),
        ],
      ),
    );

    if (confirm == true) {
      final success = await ApiService.clearSearchHistory();
      if (success) {
        setState(() => _history = []);
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Search history cleared')),
          );
        }
      }
    }
  }

  void _logout() async {
    await ApiService.clearSession();
    widget.onLogout();
  }

  String _formatDate(String timestampStr) {
    try {
      final dt = DateTime.parse(timestampStr).toLocal();
      final now = DateTime.now();
      
      // Calculate days difference
      final diff = now.difference(dt).inDays;
      if (diff == 0) {
        return 'Today at ${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';
      } else if (diff == 1) {
        return 'Yesterday';
      }
      return '${dt.day}/${dt.month}/${dt.year}';
    } catch (_) {
      return '';
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    return Scaffold(
      appBar: AppBar(
        title: const Text('User Profile'),
      ),
      body: _isLoading
          ? Center(
              child: CircularProgressIndicator(
                valueColor: AlwaysStoppedAnimation<Color>(theme.primaryColor),
              ),
            )
          : SingleChildScrollView(
              padding: const EdgeInsets.all(24.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // User Profile Card
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(24.0),
                      child: Column(
                        children: [
                          CircleAvatar(
                            radius: 40,
                            backgroundColor: theme.primaryColor.withOpacity(0.1),
                            child: Icon(Icons.person, size: 48, color: theme.primaryColor),
                          ),
                          const SizedBox(height: 16),
                          Text(
                            _user?['username'] ?? 'User',
                            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 20),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            _user?['email'] ?? 'email@pharma.com',
                            style: TextStyle(color: Colors.grey[500], fontSize: 14),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 24),

                  // Theme Toggle Settings Block
                  Card(
                    child: Column(
                      children: [
                        ListTile(
                          leading: const Icon(Icons.palette_outlined),
                          title: const Text('Dark Theme'),
                          trailing: Switch(
                            value: isDark,
                            activeColor: theme.primaryColor,
                            onChanged: (val) {
                              MyApp.of(context).toggleTheme();
                            },
                          ),
                        ),
                        const Divider(height: 1),
                        ListTile(
                          leading: const Icon(Icons.logout, color: Colors.redAccent),
                          title: const Text('Sign Out', style: TextStyle(color: Colors.redAccent)),
                          onTap: _logout,
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 30),

                  // Search history title
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text(
                        'Last 7 Days History',
                        style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18),
                      ),
                      if (_history.isNotEmpty)
                        TextButton(
                          onPressed: _clearSearchHistory,
                          child: const Text('Clear All', style: TextStyle(color: Colors.red)),
                        ),
                    ],
                  ),
                  const SizedBox(height: 12),

                  // History list
                  if (_history.isEmpty)
                    Card(
                      child: Padding(
                        padding: const EdgeInsets.all(30.0),
                        child: Center(
                          child: Column(
                            children: [
                              Icon(Icons.history, size: 40, color: Colors.grey.withOpacity(0.5)),
                              const SizedBox(height: 8),
                              Text(
                                'No searches in the last 7 days',
                                style: TextStyle(color: Colors.grey[500], fontSize: 13),
                              ),
                            ],
                          ),
                        ),
                      ),
                    )
                  else
                    ListView.builder(
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      itemCount: _history.length,
                      itemBuilder: (context, index) {
                        final item = _history[index];
                        return Card(
                          margin: const EdgeInsets.only(bottom: 8.0),
                          child: ListTile(
                            leading: Icon(Icons.search_outlined, color: theme.primaryColor),
                            title: Text(
                              item['query'] ?? '',
                              style: const TextStyle(fontWeight: FontWeight.w600),
                            ),
                            subtitle: Text(_formatDate(item['timestamp'] ?? '')),
                            trailing: Icon(Icons.chevron_right, size: 18, color: Colors.grey[400]),
                          ),
                        );
                      },
                    ),
                ],
              ),
            ),
    );
  }
}
