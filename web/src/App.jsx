import React, { useState, useEffect, useRef } from 'react';
import { 
  Package, MapPin, Plus, FileSpreadsheet, Sun, Moon, LogOut, 
  Trash2, Edit, AlertCircle, CheckCircle, Upload, HelpCircle, 
  Save, Eye, EyeOff, Search, Loader2 
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import * as XLSX from 'xlsx';

const API_BASE = import.meta.env.VITE_API_BASE || 'https://pharoxrx-3ucy.onrender.com/api';

// Custom Map Marker using Leaflet DivIcon (to avoid missing default assets issues)
const getMarkerIcon = (color) => new L.divIcon({
  html: `<div style="background-color: ${color}; width: 20px; height: 20px; border-radius: 50%; border: 3px solid #ffffff; box-shadow: 0 4px 10px rgba(0,0,0,0.3);"></div>`,
  className: 'custom-map-pin',
  iconSize: [20, 20],
  iconAnchor: [10, 10]
});

// Interactive map click component to capture coordinates
function MapClickHandler({ onMapClick }) {
  useMapEvents({
    click: (e) => {
      onMapClick(e.latlng.lat, e.latlng.lng);
    }
  });
  return null;
}

function App() {
  // Theme state
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');
  
  // Auth state
  const [token, setToken] = useState(localStorage.getItem('shopToken') || '');
  const [shop, setShop] = useState(JSON.parse(localStorage.getItem('shopData')) || null);
  const [view, setView] = useState(token ? 'dashboard' : 'login');
  
  // Form states
  const [authForm, setAuthForm] = useState({
    shopName: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Dashboard states
  const [activeTab, setActiveTab] = useState('inventory');
  const [inventory, setInventory] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Profile settings state
  const [profileForm, setProfileForm] = useState({
    shopName: '',
    phone: '',
    address: '',
    latitude: 28.6139,
    longitude: 77.2090
  });
  const [shopImageFile, setShopImageFile] = useState(null);
  const [shopImagePreview, setShopImagePreview] = useState('');
  
  // Inventory Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [medForm, setMedForm] = useState({
    id: null,
    medicineName: '',
    price: '',
    isOutOfStock: false
  });
  const [medImageFile, setMedImageFile] = useState(null);
  const [medImagePreview, setMedImagePreview] = useState('');
  
  // Notifications
  const [alert, setAlert] = useState({ type: '', message: '' });
  
  // Excel File State
  const fileInputRef = useRef(null);

  // Sync theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Fetch Inventory and Profile data when logged in
  useEffect(() => {
    if (token) {
      fetchInventory();
      fetchProfile();
    }
  }, [token]);

  // Alert auto-dismissal
  const triggerAlert = (type, message) => {
    setAlert({ type, message });
    setTimeout(() => {
      setAlert({ type: '', message: '' });
    }, 4000);
  };

  // --- API CALLS ---

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    const endpoint = view === 'register' ? '/auth/shop/register' : '/auth/shop/login';
    
    try {
      const response = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(authForm)
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Authentication failed');
      }

      setToken(data.token);
      const shopData = data.shop || data.user;
      setShop(shopData);
      localStorage.setItem('shopToken', data.token);
      localStorage.setItem('shopData', JSON.stringify(shopData));
      
      triggerAlert('success', `Welcome back, ${shopData.shopName}!`);
      setView('dashboard');
    } catch (err) {
      triggerAlert('danger', err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchInventory = async () => {
    try {
      const response = await fetch(`${API_BASE}/shop/inventory`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setInventory(data);
      }
    } catch (err) {
      console.error('Failed to fetch inventory:', err);
    }
  };

  const fetchProfile = async () => {
    try {
      const response = await fetch(`${API_BASE}/shop/profile`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setProfileForm({
          shopName: data.shopName || '',
          phone: data.phone || '',
          address: data.address || '',
          latitude: data.location?.coordinates[1] || 28.6139,
          longitude: data.location?.coordinates[0] || 77.2090
        });
        setShopImagePreview(data.shopImage ? `${API_BASE.replace('/api', '')}${data.shopImage}` : '');
      }
    } catch (err) {
      console.error('Failed to fetch profile:', err);
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    const formData = new FormData();
    formData.append('shopName', profileForm.shopName);
    formData.append('phone', profileForm.phone);
    formData.append('address', profileForm.address);
    formData.append('latitude', profileForm.latitude);
    formData.append('longitude', profileForm.longitude);
    if (shopImageFile) {
      formData.append('shopImage', shopImageFile);
    }

    try {
      const response = await fetch(`${API_BASE}/shop/profile`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      setShop(data.shop);
      localStorage.setItem('shopData', JSON.stringify(data.shop));
      triggerAlert('success', 'Profile updated successfully!');
      fetchProfile();
    } catch (err) {
      triggerAlert('danger', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveMedicine = async (e) => {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData();
    formData.append('medicineName', medForm.medicineName);
    formData.append('price', medForm.price);
    formData.append('isOutOfStock', medForm.isOutOfStock);
    if (medImageFile) {
      formData.append('medicineImage', medImageFile);
    }

    const isEdit = medForm.id !== null;
    const url = isEdit ? `${API_BASE}/shop/inventory/${medForm.id}` : `${API_BASE}/shop/inventory`;
    const method = isEdit ? 'PUT' : 'POST';

    try {
      const response = await fetch(url, {
        method,
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      triggerAlert('success', isEdit ? 'Medicine updated successfully' : 'Medicine added successfully');
      setIsModalOpen(false);
      resetMedicineForm();
      fetchInventory();
    } catch (err) {
      triggerAlert('danger', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStock = async (item) => {
    try {
      const response = await fetch(`${API_BASE}/shop/inventory/${item._id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ isOutOfStock: !item.isOutOfStock })
      });
      
      if (response.ok) {
        setInventory(inventory.map(i => i._id === item._id ? { ...i, isOutOfStock: !i.isOutOfStock } : i));
        triggerAlert('success', `Marked ${item.medicineName} as ${!item.isOutOfStock ? 'Out of Stock' : 'In Stock'}`);
      }
    } catch (err) {
      triggerAlert('danger', 'Failed to toggle stock status');
    }
  };

  const handleDeleteItem = async (id) => {
    if (!window.confirm('Are you sure you want to delete this medicine?')) return;
    
    try {
      const response = await fetch(`${API_BASE}/shop/inventory/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        triggerAlert('success', 'Medicine deleted successfully');
        fetchInventory();
      }
    } catch (err) {
      triggerAlert('danger', 'Failed to delete medicine');
    }
  };

  // --- EXCEL UPLOAD ---
  const handleExcelImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setLoading(true);
    const formData = new FormData();
    formData.append('excel', file);

    try {
      const response = await fetch(`${API_BASE}/shop/inventory/bulk`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      triggerAlert('success', data.message);
      fetchInventory();
    } catch (err) {
      triggerAlert('danger', err.message);
    } finally {
      setLoading(false);
      e.target.value = ''; // clear input
    }
  };

  // --- LOCAL HELPERS ---
  const resetMedicineForm = () => {
    setMedForm({ id: null, medicineName: '', price: '', isOutOfStock: false });
    setMedImageFile(null);
    setMedImagePreview('');
  };

  const openAddModal = () => {
    resetMedicineForm();
    setIsModalOpen(true);
  };

  const openEditModal = (item) => {
    setMedForm({
      id: item._id,
      medicineName: item.medicineName,
      price: item.price,
      isOutOfStock: item.isOutOfStock
    });
    setMedImagePreview(item.medicineImage ? `${API_BASE.replace('/api', '')}${item.medicineImage}` : '');
    setMedImageFile(null);
    setIsModalOpen(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('shopToken');
    localStorage.removeItem('shopData');
    setToken('');
    setShop(null);
    setView('login');
  };

  const onMapCoordinatesSelected = (lat, lng) => {
    setProfileForm(prev => ({
      ...prev,
      latitude: parseFloat(lat.toFixed(6)),
      longitude: parseFloat(lng.toFixed(6))
    }));
  };

  const handleMedImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setMedImageFile(file);
      setMedImagePreview(URL.createObjectURL(file));
    }
  };

  const handleShopImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setShopImageFile(file);
      setShopImagePreview(URL.createObjectURL(file));
    }
  };

  // Filter local inventory list
  const filteredInventory = inventory.filter(item => 
    item.medicineName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="app-container">
      {/* Alert Notification */}
      {alert.message && (
        <div 
          className="animate-fade-in"
          style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 20px',
            borderRadius: 'var(--radius-md)',
            color: '#fff',
            backgroundColor: alert.type === 'success' ? 'var(--success-color)' : 'var(--danger-color)',
            boxShadow: 'var(--shadow-lg)'
          }}
        >
          {alert.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
          <span style={{ fontWeight: 500 }}>{alert.message}</span>
        </div>
      )}

      {/* 1. AUTH SCREEN VIEW */}
      {(view === 'login' || view === 'register') && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          background: 'linear-gradient(135deg, var(--bg-primary) 0%, var(--bg-secondary) 100%)',
          padding: '20px'
        }}>
          <div className="glass-card" style={{
            width: '100%',
            maxWidth: '440px',
            padding: '40px',
            position: 'relative'
          }}>
            {/* Theme toggle on Auth */}
            <button 
              onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
              style={{
                position: 'absolute',
                top: '20px',
                right: '20px',
                background: 'none',
                border: 'none',
                color: 'var(--text-secondary)',
                cursor: 'pointer'
              }}
            >
              {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
            </button>

            <div style={{ textAlign: 'center', marginBottom: '30px' }}>
              <img 
                src="/logo.jpeg" 
                alt="Pharma Logo" 
                style={{ 
                  width: '80px', 
                  height: '80px', 
                  borderRadius: '50%',
                  objectFit: 'cover',
                  marginBottom: '15px',
                  boxShadow: '0 4px 10px rgba(0,0,0,0.1)'
                }}
                onError={(e) => {
                  e.target.style.display = 'none'; // Fallback if image isn't loaded yet
                }}
              />
              <h2 style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--accent-color)', letterSpacing: '-0.5px' }}>
                Pharma Shop Portal
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '5px' }}>
                {view === 'register' ? 'Register your shop credentials to begin' : 'Log in to manage shop inventory & location'}
              </p>
            </div>

            <form onSubmit={handleAuth}>
              {view === 'register' && (
                <div className="form-group">
                  <label className="form-label">Shop Name</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="e.g. Apollo Pharmacy" 
                    required
                    value={authForm.shopName}
                    onChange={(e) => setAuthForm({ ...authForm, shopName: e.target.value })}
                  />
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Email Address</label>
                <input 
                  type="email" 
                  className="form-input" 
                  placeholder="name@pharma.com" 
                  required
                  value={authForm.email}
                  onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Password</label>
                <div style={{ position: 'relative' }}>
                  <input 
                    type={showPassword ? "text" : "password"} 
                    className="form-input" 
                    placeholder="••••••••" 
                    required
                    style={{ width: '100%', paddingRight: '40px' }}
                    value={authForm.password}
                    onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
                  />
                  <button 
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute',
                      right: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer'
                    }}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {view === 'register' && (
                <div className="form-group">
                  <label className="form-label">Confirm Password</label>
                  <input 
                    type="password" 
                    className="form-input" 
                    placeholder="••••••••" 
                    required
                    value={authForm.confirmPassword}
                    onChange={(e) => setAuthForm({ ...authForm, confirmPassword: e.target.value })}
                  />
                </div>
              )}

              <button 
                type="submit" 
                className="btn btn-primary" 
                style={{ width: '100%', marginTop: '10px' }}
                disabled={loading}
              >
                {loading ? <Loader2 className="animate-spin" size={18} /> : (view === 'register' ? 'Register Shop' : 'Log In')}
              </button>
            </form>

            <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '0.9rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>
                {view === 'register' ? 'Already have a shop account? ' : 'Register your pharma shop? '}
              </span>
              <button 
                onClick={() => {
                  setView(view === 'register' ? 'login' : 'register');
                  setAuthForm({ shopName: '', email: '', password: '', confirmPassword: '' });
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--accent-color)',
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: '2px'
                }}
              >
                {view === 'register' ? 'Log In' : 'Register Now'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. MAIN DASHBOARD VIEW */}
      {view === 'dashboard' && shop && (
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
          
          {/* Header */}
          <header style={{
            background: 'var(--bg-secondary)',
            borderBottom: '1px solid var(--border-color)',
            padding: '15px 30px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            position: 'sticky',
            top: 0,
            zIndex: 100
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <img 
                src="/logo.jpeg" 
                alt="Logo" 
                style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }}
                onError={(e) => {
                  e.target.style.display = 'none';
                }}
              />
              <div>
                <h1 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--accent-color)' }}>
                  PharmaCare Portal
                </h1>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                  Logged in: {shop.shopName}
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <button 
                onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
                className="btn btn-secondary"
                style={{ padding: '8px 12px', borderRadius: 'var(--radius-md)' }}
              >
                {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
              </button>
              
              <button 
                onClick={handleLogout}
                className="btn btn-danger"
                style={{ padding: '8px 14px', borderRadius: 'var(--radius-md)' }}
              >
                <LogOut size={18} />
                <span>Logout</span>
              </button>
            </div>
          </header>

          {/* Main Content Layout */}
          <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', flex: 1 }}>
            
            {/* Sidebar */}
            <aside style={{
              background: 'var(--bg-secondary)',
              borderRight: '1px solid var(--border-color)',
              padding: '30px 20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}>
              <button 
                onClick={() => setActiveTab('inventory')}
                className={`btn ${activeTab === 'inventory' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ justifyContent: 'flex-start', width: '100%' }}
              >
                <Package size={18} />
                <span>Inventory List</span>
              </button>

              <button 
                onClick={() => setActiveTab('profile')}
                className={`btn ${activeTab === 'profile' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ justifyContent: 'flex-start', width: '100%' }}
              >
                <MapPin size={18} />
                <span>Shop Location</span>
              </button>
            </aside>

            {/* Work Content Area */}
            <main style={{ padding: '40px', overflowY: 'auto' }}>
              
              {/* Tab 1: Inventory management */}
              {activeTab === 'inventory' && (
                <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
                  
                  {/* Dashboard Cards Summary */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
                    <div className="glass-card" style={{ padding: '24px' }}>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Total Medicines</p>
                      <h3 style={{ fontSize: '2rem', fontWeight: 800, marginTop: '8px' }}>{inventory.length}</h3>
                    </div>
                    <div className="glass-card" style={{ padding: '24px' }}>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>In Stock</p>
                      <h3 style={{ fontSize: '2rem', fontWeight: 800, marginTop: '8px', color: 'var(--success-color)' }}>
                        {inventory.filter(i => !i.isOutOfStock).length}
                      </h3>
                    </div>
                    <div className="glass-card" style={{ padding: '24px' }}>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Out of Stock</p>
                      <h3 style={{ fontSize: '2rem', fontWeight: 800, marginTop: '8px', color: 'var(--danger-color)' }}>
                        {inventory.filter(i => i.isOutOfStock).length}
                      </h3>
                    </div>
                  </div>

                  {/* Actions Header Bar */}
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between', 
                    flexWrap: 'wrap', 
                    gap: '15px' 
                  }}>
                    <div style={{ position: 'relative', width: '300px' }}>
                      <Search 
                        size={18} 
                        style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} 
                      />
                      <input 
                        type="text" 
                        className="form-input" 
                        placeholder="Search local inventory..." 
                        style={{ paddingLeft: '40px', width: '100%' }}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                    </div>

                    <div style={{ display: 'flex', gap: '12px' }}>
                      {/* Excel import input */}
                      <input 
                        type="file" 
                        accept=".xlsx, .xls, .csv" 
                        style={{ display: 'none' }} 
                        ref={fileInputRef} 
                        onChange={handleExcelImport}
                      />
                      
                      <button 
                        onClick={() => fileInputRef.current.click()} 
                        className="btn btn-secondary"
                      >
                        <FileSpreadsheet size={18} />
                        <span>Upload Excel</span>
                      </button>

                      <button onClick={openAddModal} className="btn btn-primary">
                        <Plus size={18} />
                        <span>Add Medicine</span>
                      </button>
                    </div>
                  </div>

                  {/* Table Card */}
                  <div className="glass-card" style={{ overflow: 'hidden' }}>
                    <div className="custom-table-container">
                      <table className="custom-table">
                        <thead>
                          <tr>
                            <th>Image</th>
                            <th>Medicine Name</th>
                            <th>Price</th>
                            <th>Status</th>
                            <th>Mark Status</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredInventory.length === 0 ? (
                            <tr>
                              <td colSpan="6" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
                                No medicines found in your inventory. Click "Add Medicine" or "Upload Excel" to populate.
                              </td>
                            </tr>
                          ) : (
                            filteredInventory.map(item => (
                              <tr key={item._id}>
                                <td>
                                  {item.medicineImage ? (
                                    <img 
                                      src={`${API_BASE.replace('/api', '')}${item.medicineImage}`} 
                                      alt={item.medicineName} 
                                      style={{ width: '44px', height: '44px', borderRadius: 'var(--radius-sm)', objectFit: 'cover' }}
                                    />
                                  ) : (
                                    <div style={{
                                      width: '44px',
                                      height: '44px',
                                      borderRadius: 'var(--radius-sm)',
                                      backgroundColor: 'var(--accent-light)',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      color: 'var(--accent-color)'
                                    }}>
                                      <Package size={20} />
                                    </div>
                                  )}
                                </td>
                                <td style={{ fontWeight: 600 }}>{item.medicineName}</td>
                                <td style={{ fontWeight: 600, color: 'var(--accent-color)' }}>
                                  ${parseFloat(item.price).toFixed(2)}
                                </td>
                                <td>
                                  <span className={`badge ${item.isOutOfStock ? 'badge-danger' : 'badge-success'}`}>
                                    {item.isOutOfStock ? 'Out of Stock' : 'In Stock'}
                                  </span>
                                </td>
                                <td>
                                  <label className="switch">
                                    <input 
                                      type="checkbox" 
                                      checked={item.isOutOfStock} 
                                      onChange={() => handleToggleStock(item)}
                                    />
                                    <span className="slider"></span>
                                  </label>
                                </td>
                                <td>
                                  <div style={{ display: 'flex', gap: '8px' }}>
                                    <button 
                                      onClick={() => openEditModal(item)}
                                      className="btn btn-secondary" 
                                      style={{ padding: '8px', borderRadius: 'var(--radius-sm)' }}
                                    >
                                      <Edit size={16} />
                                    </button>
                                    <button 
                                      onClick={() => handleDeleteItem(item._id)}
                                      className="btn btn-secondary" 
                                      style={{ padding: '8px', borderRadius: 'var(--radius-sm)', color: 'var(--danger-color)' }}
                                    >
                                      <Trash2 size={16} />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                </div>
              )}

              {/* Tab 2: Profile & location settings */}
              {activeTab === 'profile' && (
                <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
                  <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Shop Location & Details</h2>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                      Select your shop coordinates directly from the map or fill out the form coordinates manually.
                    </p>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '30px', alignItems: 'start' }}>
                    
                    {/* Left Form */}
                    <form onSubmit={handleUpdateProfile} className="glass-card" style={{ padding: '30px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                      
                      {/* Shop image selector */}
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                        <div style={{
                          width: '120px',
                          height: '120px',
                          borderRadius: '50%',
                          border: '2px dashed var(--border-color)',
                          overflow: 'hidden',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          position: 'relative',
                          backgroundColor: 'var(--bg-primary)'
                        }}>
                          {shopImagePreview ? (
                            <img src={shopImagePreview} alt="Shop Banner" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            <Upload size={32} style={{ color: 'var(--text-secondary)' }} />
                          )}
                          <input 
                            type="file" 
                            accept="image/*" 
                            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0, cursor: 'pointer' }}
                            onChange={handleShopImageChange}
                          />
                        </div>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Upload Shop Photo (Optional)</span>
                      </div>

                      <div className="form-group">
                        <label className="form-label">Shop Name</label>
                        <input 
                          type="text" 
                          className="form-input" 
                          required
                          value={profileForm.shopName}
                          onChange={(e) => setProfileForm({ ...profileForm, shopName: e.target.value })}
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label">Phone Number</label>
                        <input 
                          type="text" 
                          className="form-input" 
                          placeholder="e.g. +91 99999 88888"
                          value={profileForm.phone}
                          onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label">Street Address</label>
                        <textarea 
                          className="form-input" 
                          rows="3"
                          style={{ resize: 'none' }}
                          placeholder="e.g. 12, Main Ring Road, Block B, New Delhi"
                          value={profileForm.address}
                          onChange={(e) => setProfileForm({ ...profileForm, address: e.target.value })}
                        />
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                        <div className="form-group">
                          <label className="form-label">Latitude</label>
                          <input 
                            type="number" 
                            step="any"
                            className="form-input" 
                            required
                            value={profileForm.latitude}
                            onChange={(e) => setProfileForm({ ...profileForm, latitude: parseFloat(e.target.value) || 0 })}
                          />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Longitude</label>
                          <input 
                            type="number" 
                            step="any"
                            className="form-input" 
                            required
                            value={profileForm.longitude}
                            onChange={(e) => setProfileForm({ ...profileForm, longitude: parseFloat(e.target.value) || 0 })}
                          />
                        </div>
                      </div>

                      <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
                        <Save size={18} />
                        <span>Save Location Details</span>
                      </button>

                    </form>

                    {/* Right Map */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                      <div className="glass-card" style={{ padding: '15px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px', borderLeft: '4px solid var(--accent-color)' }}>
                        <HelpCircle size={18} style={{ color: 'var(--accent-color)' }} />
                        <span>Click anywhere on the map to automatically position your shop coordinates!</span>
                      </div>
                      
                      <div style={{ height: '420px', position: 'relative' }}>
                        <MapContainer 
                          center={[profileForm.latitude, profileForm.longitude]} 
                          zoom={13} 
                          scrollWheelZoom={true}
                        >
                          <TileLayer
                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                          />
                          <Marker 
                            position={[profileForm.latitude, profileForm.longitude]} 
                            icon={getMarkerIcon('#0d9488')}
                          />
                          <MapClickHandler onMapClick={onMapCoordinatesSelected} />
                        </MapContainer>
                      </div>
                    </div>

                  </div>
                </div>
              )}

            </main>

          </div>
        </div>
      )}

      {/* 3. ADD/EDIT MEDICINE MODAL POPUP */}
      {isModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div className="glass-card animate-fade-in" style={{
            width: '100%',
            maxWidth: '480px',
            padding: '35px',
            backgroundColor: 'var(--bg-secondary)'
          }}>
            <h3 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: '20px' }}>
              {medForm.id ? 'Edit Inventory Item' : 'Add New Medicine'}
            </h3>

            <form onSubmit={handleSaveMedicine} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  width: '90px',
                  height: '90px',
                  borderRadius: 'var(--radius-sm)',
                  border: '2px dashed var(--border-color)',
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                  backgroundColor: 'var(--bg-primary)'
                }}>
                  {medImagePreview ? (
                    <img src={medImagePreview} alt="Medicine" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <Upload size={24} style={{ color: 'var(--text-secondary)' }} />
                  )}
                  <input 
                    type="file" 
                    accept="image/*" 
                    style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0, cursor: 'pointer' }}
                    onChange={handleMedImageChange}
                  />
                </div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Medicine Image (Optional)</span>
              </div>

              <div className="form-group">
                <label className="form-label">Medicine Name</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="e.g. Paracetamol 650mg" 
                  required
                  value={medForm.medicineName}
                  onChange={(e) => setMedForm({ ...medForm, medicineName: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Price (USD)</label>
                <input 
                  type="number" 
                  step="0.01" 
                  className="form-input" 
                  placeholder="0.00" 
                  required
                  value={medForm.price}
                  onChange={(e) => setMedForm({ ...medForm, price: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <label className="form-label" style={{ margin: 0 }}>Mark Out of Stock</label>
                <label className="switch">
                  <input 
                    type="checkbox" 
                    checked={medForm.isOutOfStock} 
                    onChange={(e) => setMedForm({ ...medForm, isOutOfStock: e.target.checked })}
                  />
                  <span className="slider"></span>
                </label>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)} 
                  className="btn btn-secondary" 
                  style={{ flex: 1 }}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary" 
                  style={{ flex: 1 }} 
                  disabled={loading}
                >
                  {loading ? <Loader2 className="animate-spin" size={18} /> : 'Save Medicine'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}

export default App;
