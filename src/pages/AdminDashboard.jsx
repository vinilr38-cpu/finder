import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShieldCheck, Users, Wrench, CalendarCheck, CheckCircle2,
  XCircle, Clock, Search, LogOut, Loader2, Sparkles,
  Phone, Mail, Check, X, Filter, Lock, ArrowLeft, RefreshCw
} from 'lucide-react';
import { db } from '../firebase';
import {
  collection,
  onSnapshot,
  doc,
  updateDoc
} from 'firebase/firestore';

export default function AdminDashboard() {
  const navigate = useNavigate();

  // Demo Passcode Auth State
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return sessionStorage.getItem('isAdminAuthenticated') === 'true';
  });
  const [passcodeInput, setPasscodeInput] = useState('');
  const [passcodeError, setPasscodeError] = useState('');

  // Firestore Live Telemetry States
  const [users, setUsers] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  // Active Tab: 'providers' | 'bookings'
  const [activeTab, setActiveTab] = useState('providers');

  // Filters & Search
  const [providerSearch, setProviderSearch] = useState('');
  const [providerStatusFilter, setProviderStatusFilter] = useState('all'); // 'all' | 'verified' | 'unverified' | 'online'
  const [bookingSearch, setBookingSearch] = useState('');
  const [bookingStatusFilter, setBookingStatusFilter] = useState('all'); // 'all' | 'pending' | 'accepted' | 'in_progress' | 'completed' | 'cancelled'

  // Updating action state
  const [updatingUid, setUpdatingUid] = useState(null);
  const [adminNotification, setAdminNotification] = useState(null);

  // Handle Passcode Unlock
  const handleUnlock = (e) => {
    e.preventDefault();
    if (passcodeInput.trim() === 'admin123') {
      sessionStorage.setItem('isAdminAuthenticated', 'true');
      setIsAuthenticated(true);
      setPasscodeError('');
    } else {
      setPasscodeError("Invalid passcode. Enter 'admin123' to unlock demo access.");
    }
  };

  const handleAdminLogout = () => {
    sessionStorage.removeItem('isAdminAuthenticated');
    setIsAuthenticated(false);
    navigate('/');
  };

  // 1. FIRESTORE REAL-TIME LISTENERS FOR USERS AND BOOKINGS
  useEffect(() => {
    if (!isAuthenticated) return;

    setLoading(true);

    // Listen to users collection
    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      const allUsers = [];
      snapshot.forEach((docSnap) => {
        allUsers.push({
          id: docSnap.id,
          uid: docSnap.id,
          ...docSnap.data()
        });
      });
      setUsers(allUsers);
      setLoading(false);
    }, (error) => {
      console.error('Error fetching users in admin:', error);
      setLoading(false);
    });

    // Listen to bookings collection
    const unsubBookings = onSnapshot(collection(db, 'bookings'), (snapshot) => {
      const allBookings = [];
      snapshot.forEach((docSnap) => {
        allBookings.push({
          id: docSnap.id,
          ...docSnap.data()
        });
      });

      // Sort newest first
      allBookings.sort((a, b) => {
        const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdMillis || 0);
        const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdMillis || 0);
        return timeB - timeA;
      });

      setBookings(allBookings);
    }, (error) => {
      console.error('Error fetching bookings in admin:', error);
    });

    return () => {
      unsubUsers();
      unsubBookings();
    };
  }, [isAuthenticated]);

  // Derived Telemetry
  const customers = users.filter((u) => u.role === 'customer' || (!u.role && u.name));
  const providers = users.filter((u) => u.role === 'provider');
  const totalBookingsCount = bookings.length;
  const completedJobsCount = bookings.filter((b) => b.status === 'completed').length;

  // Toggle Provider Verification in Firestore
  const handleToggleVerification = async (provider) => {
    const currentUid = provider.id || provider.uid;
    if (!currentUid) return;

    const nextVerificationState = !provider.isVerified;
    setUpdatingUid(currentUid);

    try {
      await updateDoc(doc(db, 'users', currentUid), {
        isVerified: nextVerificationState
      });
      setAdminNotification(
        nextVerificationState
          ? `✅ Successfully verified ${provider.name}! Badge is now visible on Customer Dashboard.`
          : `⚠️ Verification revoked for ${provider.name}.`
      );
      setTimeout(() => setAdminNotification(null), 4000);
    } catch (err) {
      console.error('Failed to toggle verification:', err);
      alert('Could not update provider verification: ' + err.message);
    } finally {
      setUpdatingUid(null);
    }
  };

  // Filtered Providers
  const filteredProviders = providers.filter((p) => {
    const nameMatch = (p.name || '').toLowerCase().includes(providerSearch.toLowerCase());
    const categoryMatch = (p.serviceCategory || '').toLowerCase().includes(providerSearch.toLowerCase());
    const emailMatch = (p.email || '').toLowerCase().includes(providerSearch.toLowerCase());
    const matchesSearch = nameMatch || categoryMatch || emailMatch;

    if (!matchesSearch) return false;

    if (providerStatusFilter === 'verified') return p.isVerified === true;
    if (providerStatusFilter === 'unverified') return !p.isVerified;
    if (providerStatusFilter === 'online') return p.isOnline === true;
    return true;
  });

  // Filtered Bookings
  const filteredBookings = bookings.filter((b) => {
    const custMatch = (b.customerName || '').toLowerCase().includes(bookingSearch.toLowerCase());
    const provMatch = (b.providerName || '').toLowerCase().includes(bookingSearch.toLowerCase());
    const catMatch = (b.serviceCategory || '').toLowerCase().includes(bookingSearch.toLowerCase());
    const idMatch = (b.id || '').toLowerCase().includes(bookingSearch.toLowerCase());
    const matchesSearch = custMatch || provMatch || catMatch || idMatch;

    if (!matchesSearch) return false;

    if (bookingStatusFilter !== 'all') {
      return b.status === bookingStatusFilter;
    }
    return true;
  });

  // Render Status Badge for Bookings Table
  const renderStatusBadge = (status) => {
    switch (status) {
      case 'accepted':
        return (
          <span className="bg-emerald-100 text-emerald-800 border border-emerald-200 px-2.5 py-0.5 rounded-full text-xs font-bold inline-flex items-center">
            <CheckCircle2 className="h-3 w-3 mr-1 text-emerald-600" />
            Accepted
          </span>
        );
      case 'in_progress':
        return (
          <span className="bg-blue-100 text-blue-800 border border-blue-200 px-2.5 py-0.5 rounded-full text-xs font-bold inline-flex items-center">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-600 mr-1.5 animate-pulse"></span>
            In Progress
          </span>
        );
      case 'completed':
        return (
          <span className="bg-purple-100 text-purple-800 border border-purple-200 px-2.5 py-0.5 rounded-full text-xs font-bold inline-flex items-center">
            <Sparkles className="h-3 w-3 mr-1 text-purple-600" />
            Completed
          </span>
        );
      case 'cancelled':
        return (
          <span className="bg-slate-100 text-slate-700 border border-slate-300 px-2.5 py-0.5 rounded-full text-xs font-bold inline-flex items-center">
            <XCircle className="h-3 w-3 mr-1 text-slate-500" />
            Cancelled
          </span>
        );
      case 'declined':
        return (
          <span className="bg-rose-100 text-rose-800 border border-rose-200 px-2.5 py-0.5 rounded-full text-xs font-bold inline-flex items-center">
            <XCircle className="h-3 w-3 mr-1 text-rose-600" />
            Declined
          </span>
        );
      case 'pending':
      default:
        return (
          <span className="bg-amber-100 text-amber-800 border border-amber-200 px-2.5 py-0.5 rounded-full text-xs font-bold inline-flex items-center animate-pulse">
            <Clock className="h-3 w-3 mr-1 text-amber-600" />
            Pending
          </span>
        );
    }
  };

  // PASSCODE GATE SCREEN IF NOT AUTHENTICATED
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 font-sans text-slate-100 overflow-x-hidden">
        <div className="bg-slate-800 border border-slate-700 rounded-3xl p-6 sm:p-8 w-[95%] max-w-md max-h-[85vh] overflow-y-auto mx-auto z-50 shadow-2xl space-y-6">
          <div className="text-center space-y-2">
            <div className="w-14 h-14 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-blue-500/30 text-white">
              <ShieldCheck className="h-7 w-7" />
            </div>
            <h2 className="text-2xl font-black text-white tracking-tight">
              Admin Portal Demo Gate
            </h2>
            <p className="text-xs text-slate-400 max-w-xs mx-auto">
              Protected administrator access for platform verification and live dispatch supervision.
            </p>
          </div>

          <form onSubmit={handleUnlock} className="space-y-4">
            <div className="bg-slate-900/60 p-3.5 rounded-2xl border border-slate-700/80 text-xs space-y-1">
              <span className="text-slate-400 font-semibold block">Demo Passcode:</span>
              <code className="text-blue-400 font-mono font-bold text-sm bg-blue-950/60 px-2 py-0.5 rounded border border-blue-800/60 inline-block">
                admin123
              </code>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                Enter Passcode
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="password"
                  autoFocus
                  placeholder="e.g. admin123"
                  value={passcodeInput}
                  onChange={(e) => {
                    setPasscodeInput(e.target.value);
                    setPasscodeError('');
                  }}
                  className="w-full pl-10 pr-4 py-3 bg-slate-900 border border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 text-white outline-none text-sm transition font-mono"
                />
              </div>
              {passcodeError && (
                <p className="text-xs text-rose-400 font-semibold mt-1.5 animate-in fade-in">
                  {passcodeError}
                </p>
              )}
            </div>

            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white font-bold py-3 px-4 rounded-xl transition shadow-lg shadow-blue-600/30 text-sm cursor-pointer"
            >
              Unlock Admin Portal
            </button>

            <button
              type="button"
              onClick={() => navigate('/')}
              className="w-full text-xs text-slate-400 hover:text-white transition flex items-center justify-center space-x-1 cursor-pointer py-1"
            >
              <ArrowLeft className="h-3 w-3" />
              <span>Back to Landing Page</span>
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 font-sans text-slate-800 flex flex-col justify-between overflow-x-hidden">
      
      {/* 1. TOP ADMIN NAVIGATION */}
      <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-40 shadow-md">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-2 min-h-[56px]">
          <div className="flex items-center space-x-3">
            <div className="bg-blue-600 p-2 rounded-xl text-white shadow-xs">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="font-extrabold text-lg sm:text-xl tracking-tight text-white leading-none">
                  LocalServe Admin Control Center
                </h1>
                <span className="hidden sm:inline-flex bg-blue-500/20 text-blue-300 border border-blue-500/40 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Role: Platform Administrator
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5 leading-none">
                Live Platform Telemetry • Real-Time Firestore Sync
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <div className="hidden md:flex items-center space-x-2 bg-slate-800 text-emerald-400 border border-slate-700 px-3 py-1.5 rounded-full text-xs font-semibold">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>Live Firestore Connected</span>
            </div>

            <button
              onClick={() => navigate('/customer')}
              className="hidden lg:flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-xl border border-slate-700 text-xs font-bold transition cursor-pointer"
            >
              <span>Customer View</span>
            </button>

            <button
              onClick={handleAdminLogout}
              className="flex items-center space-x-1.5 bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 hover:text-white px-3.5 py-1.5 rounded-xl border border-rose-800/60 text-xs font-bold transition cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Exit Admin</span>
            </button>
          </div>
        </div>
      </header>

      {/* 2. MAIN ADMIN CONTENT */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 flex-1 space-y-6 w-full">
        
        {/* 4 TOP SUMMARY CARDS FETCHED LIVE FROM FIRESTORE */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Card 1: Total Customers */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
            <div className="flex items-center justify-between text-indigo-600">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Total Customers
              </span>
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                <Users className="h-4 w-4" />
              </div>
            </div>
            <div className="text-3xl font-black text-slate-900">
              {loading ? <Loader2 className="h-6 w-6 animate-spin text-indigo-600" /> : customers.length}
            </div>
            <p className="text-[11px] text-slate-400 font-medium">
              Registered customers seeking services
            </p>
          </div>

          {/* Card 2: Total Providers */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
            <div className="flex items-center justify-between text-emerald-600">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Total Providers
              </span>
              <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                <Wrench className="h-4 w-4" />
              </div>
            </div>
            <div className="text-3xl font-black text-slate-900">
              {loading ? <Loader2 className="h-6 w-6 animate-spin text-emerald-600" /> : providers.length}
            </div>
            <p className="text-[11px] text-slate-400 font-medium">
              {providers.filter((p) => p.isVerified).length} verified specialists
            </p>
          </div>

          {/* Card 3: Total Bookings */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
            <div className="flex items-center justify-between text-blue-600">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Total Bookings
              </span>
              <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                <CalendarCheck className="h-4 w-4" />
              </div>
            </div>
            <div className="text-3xl font-black text-slate-900">
              {loading ? <Loader2 className="h-6 w-6 animate-spin text-blue-600" /> : totalBookingsCount}
            </div>
            <p className="text-[11px] text-slate-400 font-medium">
              {bookings.filter((b) => b.status === 'pending').length} pending approval
            </p>
          </div>

          {/* Card 4: Completed Jobs */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
            <div className="flex items-center justify-between text-purple-600">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Completed Jobs
              </span>
              <div className="p-2 bg-purple-50 text-purple-600 rounded-xl">
                <CheckCircle2 className="h-4 w-4" />
              </div>
            </div>
            <div className="text-3xl font-black text-slate-900">
              {loading ? <Loader2 className="h-6 w-6 animate-spin text-purple-600" /> : completedJobsCount}
            </div>
            <p className="text-[11px] text-slate-400 font-medium">
              Successfully fulfilled appointments
            </p>
          </div>

        </section>

        {/* NOTIFICATION TOAST */}
        {adminNotification && (
          <div className="bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-xl border border-slate-700 flex items-center justify-between animate-in slide-in-from-top-2 text-xs sm:text-sm font-semibold">
            <span>{adminNotification}</span>
            <button
              onClick={() => setAdminNotification(null)}
              className="text-slate-400 hover:text-white p-1 cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* 3. TWO TABS: PROVIDERS & ALL BOOKINGS */}
        <section className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          
          {/* Tab Header Navigation */}
          <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => setActiveTab('providers')}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold transition cursor-pointer flex items-center space-x-2 ${
                  activeTab === 'providers'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <Wrench className="h-4 w-4" />
                <span>Providers Management</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                  activeTab === 'providers' ? 'bg-blue-700 text-blue-100' : 'bg-slate-200 text-slate-700'
                }`}>
                  {providers.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('bookings')}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold transition cursor-pointer flex items-center space-x-2 ${
                  activeTab === 'bookings'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <CalendarCheck className="h-4 w-4" />
                <span>All Bookings</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                  activeTab === 'bookings' ? 'bg-blue-700 text-blue-100' : 'bg-slate-200 text-slate-700'
                }`}>
                  {bookings.length}
                </span>
              </button>
            </div>
          </div>

          {/* TAB 1: PROVIDERS MANAGEMENT */}
          {activeTab === 'providers' && (
            <div className="p-4 sm:p-6 space-y-4">
              
              {/* Search & Filter Controls */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="relative w-full sm:w-80">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search providers by name, email or category..."
                    value={providerSearch}
                    onChange={(e) => setProviderSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition"
                  />
                </div>

                <div className="flex items-center space-x-2 w-full sm:w-auto">
                  <Filter className="h-3.5 w-3.5 text-slate-400" />
                  <select
                    value={providerStatusFilter}
                    onChange={(e) => setProviderStatusFilter(e.target.value)}
                    className="text-xs font-bold bg-slate-100 hover:bg-slate-200/80 text-slate-800 py-2 px-3 rounded-xl border border-slate-200 focus:outline-none cursor-pointer"
                  >
                    <option value="all">All Providers ({providers.length})</option>
                    <option value="verified">Verified Only ({providers.filter((p) => p.isVerified).length})</option>
                    <option value="unverified">Unverified Only ({providers.filter((p) => !p.isVerified).length})</option>
                    <option value="online">Online Only ({providers.filter((p) => p.isOnline).length})</option>
                  </select>
                </div>
              </div>

              {/* Providers Table */}
              <div className="overflow-x-auto rounded-2xl border border-slate-200">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[11px] font-bold">
                      <th className="py-3.5 px-4">Provider Details</th>
                      <th className="py-3.5 px-4">Category</th>
                      <th className="py-3.5 px-4">Contact Info</th>
                      <th className="py-3.5 px-4">Rating / Status</th>
                      <th className="py-3.5 px-4">Verification Status</th>
                      <th className="py-3.5 px-4 text-right">Verification Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {loading ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-slate-500">
                          <Loader2 className="h-6 w-6 animate-spin text-blue-600 mx-auto mb-2" />
                          <span>Loading providers from Firestore...</span>
                        </td>
                      </tr>
                    ) : filteredProviders.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-10 text-center text-slate-400">
                          No providers found matching your criteria.
                        </td>
                      </tr>
                    ) : (
                      filteredProviders.map((provider) => {
                        const isVerified = provider.isVerified === true;
                        const isUpdating = updatingUid === (provider.id || provider.uid);

                        return (
                          <tr key={provider.id || provider.uid} className="hover:bg-slate-50/70 transition">
                            
                            {/* Provider Details */}
                            <td className="py-3.5 px-4">
                              <div className="flex items-center space-x-3">
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white font-black flex items-center justify-center text-sm shadow-xs shrink-0">
                                  {(provider.name || 'P').slice(0, 2).toUpperCase()}
                                </div>
                                <div>
                                  <div className="flex items-center space-x-1.5">
                                    <span className="font-extrabold text-slate-900 text-sm">
                                      {provider.name || 'Service Provider'}
                                    </span>
                                    {isVerified && (
                                      <span className="bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.2 rounded-full text-[10px] font-extrabold flex items-center shadow-2xs">
                                        <Check className="h-3 w-3 mr-0.5 text-blue-600 stroke-[3]" />
                                        Verified ✓
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-[11px] text-slate-400 font-mono block">
                                    UID: {(provider.id || provider.uid).slice(0, 8)}...
                                  </span>
                                </div>
                              </div>
                            </td>

                            {/* Category */}
                            <td className="py-3.5 px-4">
                              <span className="bg-blue-50 text-blue-700 font-bold px-2.5 py-1 rounded-lg">
                                {provider.serviceCategory || provider.role || 'General Specialist'}
                              </span>
                              <span className="block text-[11px] text-slate-500 font-semibold mt-1">
                                ₹{provider.price || 500} / visit
                              </span>
                            </td>

                            {/* Contact Info */}
                            <td className="py-3.5 px-4 space-y-0.5 text-slate-600">
                              {provider.email && (
                                <div className="flex items-center space-x-1">
                                  <Mail className="h-3 w-3 text-slate-400 shrink-0" />
                                  <span className="truncate max-w-[160px]">{provider.email}</span>
                                </div>
                              )}
                              {provider.phone && (
                                <div className="flex items-center space-x-1">
                                  <Phone className="h-3 w-3 text-slate-400 shrink-0" />
                                  <span>{provider.phone}</span>
                                </div>
                              )}
                            </td>

                            {/* Rating / Live Status */}
                            <td className="py-3.5 px-4 space-y-1">
                              <div className="flex items-center space-x-1">
                                <span className="font-bold text-slate-800">
                                  ★ {Number(provider.rating || 5).toFixed(1)}
                                </span>
                                <span className="text-slate-400">
                                  ({provider.reviewCount || 0})
                                </span>
                              </div>
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                provider.isOnline
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-slate-100 text-slate-500'
                              }`}>
                                <span className={`h-1.5 w-1.5 rounded-full mr-1 ${
                                  provider.isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
                                }`}></span>
                                {provider.isOnline ? 'Online' : 'Offline'}
                              </span>
                            </td>

                            {/* Verification Status Badge */}
                            <td className="py-3.5 px-4">
                              {isVerified ? (
                                <span className="inline-flex items-center space-x-1 bg-blue-100 text-blue-800 border border-blue-300 px-3 py-1 rounded-full font-extrabold text-xs shadow-xs">
                                  <Check className="h-3.5 w-3.5 text-blue-600 stroke-[3]" />
                                  <span>Verified ✓</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center space-x-1 bg-slate-100 text-slate-600 border border-slate-300 px-3 py-1 rounded-full font-bold text-xs">
                                  <X className="h-3.5 w-3.5 text-slate-400" />
                                  <span>Unverified</span>
                                </span>
                              )}
                            </td>

                            {/* Action: Toggle Verify / Unverify */}
                            <td className="py-3.5 px-4 text-right">
                              <button
                                type="button"
                                disabled={isUpdating}
                                onClick={() => handleToggleVerification(provider)}
                                className={`px-3.5 py-1.5 rounded-xl font-bold text-xs transition cursor-pointer shadow-xs inline-flex items-center space-x-1.5 disabled:opacity-50 ${
                                  isVerified
                                    ? 'bg-white hover:bg-rose-50 text-rose-600 border border-rose-300 hover:border-rose-400'
                                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                                }`}
                              >
                                {isUpdating ? (
                                  <>
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                    <span>Updating...</span>
                                  </>
                                ) : isVerified ? (
                                  <>
                                    <X className="h-3.5 w-3.5" />
                                    <span>Unverify</span>
                                  </>
                                ) : (
                                  <>
                                    <Check className="h-3.5 w-3.5 stroke-[3]" />
                                    <span>Verify Provider ✓</span>
                                  </>
                                )}
                              </button>
                            </td>

                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

            </div>
          )}

          {/* TAB 2: ALL BOOKINGS TABLE */}
          {activeTab === 'bookings' && (
            <div className="p-4 sm:p-6 space-y-4">
              
              {/* Search & Status Filters */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="relative w-full sm:w-80">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search by customer, provider or booking ID..."
                    value={bookingSearch}
                    onChange={(e) => setBookingSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition"
                  />
                </div>

                <div className="flex items-center space-x-2 w-full sm:w-auto">
                  <Filter className="h-3.5 w-3.5 text-slate-400" />
                  <select
                    value={bookingStatusFilter}
                    onChange={(e) => setBookingStatusFilter(e.target.value)}
                    className="text-xs font-bold bg-slate-100 hover:bg-slate-200/80 text-slate-800 py-2 px-3 rounded-xl border border-slate-200 focus:outline-none cursor-pointer"
                  >
                    <option value="all">All Statuses ({bookings.length})</option>
                    <option value="pending">Pending ({bookings.filter((b) => b.status === 'pending').length})</option>
                    <option value="accepted">Accepted ({bookings.filter((b) => b.status === 'accepted').length})</option>
                    <option value="in_progress">In Progress ({bookings.filter((b) => b.status === 'in_progress').length})</option>
                    <option value="completed">Completed ({bookings.filter((b) => b.status === 'completed').length})</option>
                    <option value="cancelled">Cancelled ({bookings.filter((b) => b.status === 'cancelled').length})</option>
                  </select>
                </div>
              </div>

              {/* All Bookings Table */}
              <div className="overflow-x-auto rounded-2xl border border-slate-200">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[11px] font-bold">
                      <th className="py-3.5 px-4">Booking ID</th>
                      <th className="py-3.5 px-4">Customer</th>
                      <th className="py-3.5 px-4">Provider</th>
                      <th className="py-3.5 px-4">Category</th>
                      <th className="py-3.5 px-4">Schedule & Issue</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-4 text-right">Price</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {loading ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-slate-500">
                          <Loader2 className="h-6 w-6 animate-spin text-blue-600 mx-auto mb-2" />
                          <span>Loading platform bookings...</span>
                        </td>
                      </tr>
                    ) : filteredBookings.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-10 text-center text-slate-400">
                          No bookings found matching criteria.
                        </td>
                      </tr>
                    ) : (
                      filteredBookings.map((b) => (
                        <tr key={b.id} className="hover:bg-slate-50/70 transition">
                          
                          {/* Booking ID */}
                          <td className="py-3.5 px-4 font-mono text-[11px] text-slate-600">
                            #{b.id.slice(0, 8)}
                          </td>

                          {/* Customer */}
                          <td className="py-3.5 px-4">
                            <span className="font-bold text-slate-900 block text-xs">
                              {b.customerName || 'Customer'}
                            </span>
                            {b.customerPhone && (
                              <span className="text-[11px] text-slate-500 block">
                                {b.customerPhone}
                              </span>
                            )}
                          </td>

                          {/* Provider */}
                          <td className="py-3.5 px-4">
                            <span className="font-bold text-slate-900 block text-xs">
                              {b.providerName || 'Provider'}
                            </span>
                            {b.providerPhone && (
                              <span className="text-[11px] text-slate-500 block">
                                {b.providerPhone}
                              </span>
                            )}
                          </td>

                          {/* Category */}
                          <td className="py-3.5 px-4">
                            <span className="bg-blue-50 text-blue-700 font-bold px-2 py-0.5 rounded-md text-[11px]">
                              {b.serviceCategory || 'Service'}
                            </span>
                          </td>

                          {/* Schedule & Issue Notes */}
                          <td className="py-3.5 px-4 text-slate-600 max-w-[220px]">
                            <div className="font-semibold text-slate-800">
                              {b.date} • {b.timeSlot || b.time || 'General slot'}
                            </div>
                            {b.problemDescription && (
                              <p className="text-[11px] text-slate-500 truncate" title={b.problemDescription}>
                                {b.problemDescription}
                              </p>
                            )}
                          </td>

                          {/* Status Badge */}
                          <td className="py-3.5 px-4">
                            {renderStatusBadge(b.status)}
                          </td>

                          {/* Price */}
                          <td className="py-3.5 px-4 text-right font-extrabold text-slate-900 text-sm">
                            ₹{b.price || 500}
                          </td>

                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

            </div>
          )}

        </section>

      </main>

      {/* 4. FOOTER */}
      <footer className="bg-white border-t border-slate-200 py-4 text-center text-xs text-slate-400">
        LocalServe Admin Telemetry • Real-Time Firestore onSnapshot Sync & Verification Manager
      </footer>

    </div>
  );
}
