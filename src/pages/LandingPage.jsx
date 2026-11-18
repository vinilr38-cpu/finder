import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard, User, Wrench, Shield, ArrowRight,
  CheckCircle2, AlertCircle, Loader2, Sparkles, Phone,
  MapPin, Crosshair, RefreshCw, Edit3, ShieldCheck, Lock, X
} from 'lucide-react';
import DraggableLocationPicker from '../components/DraggableLocationPicker';

export default function LandingPage() {
  const { user, role, loading: authLoading, signup, login } = useAuth();
  const navigate = useNavigate();

  // Active Tab: 'login' | 'signup'
  const [activeTab, setActiveTab] = useState('login');

  // Shared Form Fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  // Sign Up Specific: Role selection ('customer' | 'provider')
  const [selectedRole, setSelectedRole] = useState('customer');

  // Provider Specific Extra Fields
  const [serviceCategory, setServiceCategory] = useState('Plumber');
  const [price, setPrice] = useState('500');
  const [phone, setPhone] = useState('');

  // Geolocation states for Provider
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [locationCaptured, setLocationCaptured] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [isManualLocation, setIsManualLocation] = useState(false);
  const [address, setAddress] = useState('');
  const [coordinates, setCoordinates] = useState({
    lat: 17.385044,
    lng: 78.486671
  });

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Admin Demo Passcode Modal states
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminPasscode, setAdminPasscode] = useState('');
  const [adminPasscodeError, setAdminPasscodeError] = useState('');

  const handleAdminAccess = (e) => {
    e.preventDefault();
    if (adminPasscode.trim() === 'admin123') {
      sessionStorage.setItem('isAdminAuthenticated', 'true');
      setShowAdminModal(false);
      navigate('/admin');
    } else {
      setAdminPasscodeError("Invalid passcode. Enter 'admin123' to unlock demo access.");
    }
  };

  // Automatically redirect authenticated users to their corresponding dashboard
  useEffect(() => {
    if (!authLoading && user && role) {
      navigate(role === 'provider' ? '/provider' : '/customer', { replace: true });
    }
  }, [user, role, authLoading, navigate]);

  // Geolocation detector function
  const handleDetectLocation = () => {
    setLocationError('');
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser.');
      setIsManualLocation(true);
      return;
    }

    setIsDetectingLocation(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setCoordinates({
          lat: latitude,
          lng: longitude
        });
        setIsDetectingLocation(false);
        setLocationCaptured(true);
        setLocationError('');
      },
      (error) => {
        setIsDetectingLocation(false);
        let msg = 'Could not retrieve your location.';
        if (error.code === error.PERMISSION_DENIED) {
          msg = 'Location permission denied. Please allow access or enter coordinates manually.';
        } else if (error.code === error.TIMEOUT) {
          msg = 'Location request timed out. Please retry or enter coordinates manually.';
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          msg = 'Location information is currently unavailable.';
        }
        setLocationError(msg);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // Handle Firebase errors with user-friendly messages
  const parseFirebaseError = (error) => {
    const code = error.code || '';
    if (code.includes('email-already-in-use')) {
      return 'An account with this email already exists. Please log in.';
    }
    if (code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('user-not-found')) {
      return 'Invalid email or password. Please verify your details.';
    }
    if (code.includes('weak-password')) {
      return 'Password should be at least 6 characters.';
    }
    if (code.includes('invalid-email')) {
      return 'Please enter a valid email address.';
    }
    if (code.includes('network-request-failed')) {
      return 'Network connection error. Please check your internet connection.';
    }
    return error.message || 'An error occurred. Please try again.';
  };

  // Submit Handler for Login
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setIsSubmitting(true);

    try {
      const loggedInUser = await login(email.trim(), password);
      if (loggedInUser.role === 'provider') {
        navigate('/provider');
      } else {
        navigate('/customer');
      }
    } catch (err) {
      setErrorMessage(parseFirebaseError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Handler for Sign Up
  const handleSignupSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!name.trim()) {
      setErrorMessage('Please enter your full name.');
      return;
    }

    if (selectedRole === 'provider' && (!price || Number(price) <= 0)) {
      setErrorMessage('Please enter a valid visit price for your service.');
      return;
    }

    setIsSubmitting(true);

    try {
      const profileData = {
        name: name.trim(),
        role: selectedRole,
        phone: phone.trim() || '9876543210',
        ...(selectedRole === 'provider' ? {
          serviceCategory,
          price: Number(price),
          lat: Number(coordinates.lat) || 17.385044,
          lng: Number(coordinates.lng) || 78.486671,
          address: address.trim() || 'Service Base Location'
        } : {
          address: address.trim() || ''
        })
      };

      const newUser = await signup(email.trim(), password, profileData);

      if (newUser.role === 'provider') {
        navigate('/provider');
      } else {
        navigate('/customer');
      }
    } catch (err) {
      setErrorMessage(parseFirebaseError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const categories = ['Electrician', 'Plumber', 'Cleaner', 'AC Repair', 'Carpenter'];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between font-sans text-slate-800">

      {/* 1. TOP NAVBAR */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-blue-600 p-2 rounded-xl text-white shadow-md shadow-blue-500/20">
              <LayoutDashboard className="h-5 w-5" />
            </div>
            <div>
              <span className="font-extrabold text-xl tracking-tight text-blue-900 leading-none">
                LocalServe
              </span>
              <span className="block text-[11px] text-slate-400 font-medium leading-none mt-0.5">
                On-Demand Service Network
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-2 text-xs font-semibold">
            <span className="text-slate-400 hidden sm:inline">Firebase Authentication Active</span>
            <div className="h-2 w-2 rounded-full bg-emerald-500"></div>
          </div>
        </div>
      </header>

      {/* 2. MAIN CONTENT AREA */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-10 md:py-14 flex-1 flex flex-col lg:flex-row items-center gap-12 justify-center">

        {/* Left Column: Platform Presentation & Trust Pillars */}
        <div className="flex-1 space-y-6 max-w-xl">
          <div className="inline-flex items-center space-x-2 bg-blue-50 border border-blue-200 text-blue-700 px-3.5 py-1.5 rounded-full text-xs font-semibold">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Secure Role-Based Portal</span>
          </div>

          <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 leading-tight">
            Connect with Trusted Local Specialists
          </h1>

          <p className="text-slate-600 text-base sm:text-lg leading-relaxed">
            LocalServe bridges homeowners with verified plumbers, electricians, cleaners, and technicians. Sign up as a Customer to book services, or as a Service Provider to receive live jobs.
          </p>

          <div className="space-y-3.5 pt-2">
            <div className="flex items-center space-x-3 text-slate-700 text-sm">
              <div className="h-7 w-7 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                <CheckCircle2 className="h-4 w-4" />
              </div>
              <span><strong>GPS Accuracy:</strong> Detect and save exact provider coordinates to show on the live map.</span>
            </div>

            <div className="flex items-center space-x-3 text-slate-700 text-sm">
              <div className="h-7 w-7 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                <Shield className="h-4 w-4" />
              </div>
              <span><strong>Secure Authentication:</strong> Password encryption and protected route guarantees.</span>
            </div>

            <div className="flex items-center space-x-3 text-slate-700 text-sm">
              <div className="h-7 w-7 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                <Wrench className="h-4 w-4" />
              </div>
              <span><strong>Live Booking Dispatch:</strong> Real-time requests with instant Accept and Decline controls.</span>
            </div>
          </div>
        </div>

        {/* Right Column: Modern Authentication Card (Login & Sign Up) */}
        <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-slate-200 p-6 sm:p-8">

          {/* Tab Switcher: Login vs Sign Up */}
          <div className="grid grid-cols-2 gap-1.5 p-1.5 bg-slate-100 rounded-2xl mb-6">
            <button
              type="button"
              onClick={() => {
                setActiveTab('login');
                setErrorMessage('');
              }}
              className={`py-2.5 rounded-xl text-sm font-bold transition-all cursor-pointer ${activeTab === 'login'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-slate-500 hover:text-slate-900'
                }`}
            >
              Log In
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('signup');
                setErrorMessage('');
              }}
              className={`py-2.5 rounded-xl text-sm font-bold transition-all cursor-pointer ${activeTab === 'signup'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-slate-500 hover:text-slate-900'
                }`}
            >
              Sign Up
            </button>
          </div>

          {/* Error Message Alert */}
          {errorMessage && (
            <div className="mb-5 p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-start space-x-2.5 text-red-700 text-xs">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span className="leading-snug">{errorMessage}</span>
            </div>
          )}

          {/* TAB 1: LOGIN FORM */}
          {activeTab === 'login' && (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full mt-2 bg-blue-600 hover:bg-blue-700 active:scale-[0.99] disabled:opacity-75 text-white font-bold py-3 px-4 rounded-xl transition shadow-lg shadow-blue-500/20 flex items-center justify-center space-x-2 cursor-pointer text-sm"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>

              <div className="pt-4 text-center">
                <p className="text-xs text-slate-500">
                  Don't have an account?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('signup');
                      setErrorMessage('');
                    }}
                    className="text-blue-600 font-bold hover:underline cursor-pointer"
                  >
                    Create an account
                  </button>
                </p>
              </div>
            </form>
          )}

          {/* TAB 2: SIGN UP FORM */}
          {activeTab === 'signup' && (
            <form onSubmit={handleSignupSubmit} className="space-y-4">

              {/* Segmented Toggle for Role (Customer or Service Provider) */}
              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1.5">
                  I Want To Register As:
                </label>
                <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setSelectedRole('customer')}
                    className={`flex items-center justify-center py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${selectedRole === 'customer'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                      }`}
                  >
                    <User className="h-3.5 w-3.5 mr-1.5" />
                    <span>Customer</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedRole('provider')}
                    className={`flex items-center justify-center py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${selectedRole === 'provider'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                      }`}
                  >
                    <Wrench className="h-3.5 w-3.5 mr-1.5" />
                    <span>Service Provider</span>
                  </button>
                </div>
              </div>

              {/* Common Field: Name */}
              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  placeholder={selectedRole === 'customer' ? 'Alex Morgan' : 'Rajesh Kumar'}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                />
              </div>

              {/* Common Field: Email */}
              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                />
              </div>

              {/* Common Field: Password */}
              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  placeholder="At least 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                />
              </div>

              {/* Common Field: Phone Number (for both Customer and Provider) */}
              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                  Phone Number
                </label>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
                  <input
                    type="tel"
                    required
                    placeholder="9876543210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                  />
                </div>
              </div>

              {/* SERVICE PROVIDER EXTRA FIELDS */}
              {selectedRole === 'provider' && (
                <div className="p-4 bg-emerald-50/60 border border-emerald-200 rounded-2xl space-y-3.5 animate-in fade-in zoom-in-98 duration-150">
                  <div className="flex items-center space-x-1.5 text-xs font-bold text-emerald-800 uppercase tracking-wider">
                    <Wrench className="h-3.5 w-3.5 text-emerald-600" />
                    <span>Provider Details</span>
                  </div>

                  {/* Service Category */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Service Category
                    </label>
                    <select
                      value={serviceCategory}
                      onChange={(e) => setServiceCategory(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                    >
                      {categories.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Price per visit */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Price per visit (₹)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">
                        ₹
                      </span>
                      <input
                        type="number"
                        required
                        min={100}
                        step={50}
                        placeholder="500"
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        className="w-full pl-7 pr-3 py-2 text-sm bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                      />
                    </div>
                  </div>

                  {/* GEOLOCATION & INTERACTIVE MAP LOCATION PICKER */}
                  <div className="pt-2 space-y-2.5 border-t border-emerald-200/60">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-semibold text-slate-700">
                        Service Base Location (Map Pin)
                      </label>
                      {locationCaptured && (
                        <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100/90 border border-emerald-300 px-2 py-0.5 rounded-full flex items-center">
                          <CheckCircle2 className="h-3 w-3 mr-1 text-emerald-600" />
                          Pin Placed
                        </span>
                      )}
                    </div>

                    {/* Geolocation Error Message Banner */}
                    {locationError && (
                      <div className="p-2.5 bg-red-50 border border-red-200 rounded-xl space-y-1.5">
                        <div className="flex items-start space-x-2 text-xs text-red-700">
                          <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                          <span>{locationError}</span>
                        </div>
                        <div className="flex items-center space-x-2 text-xs">
                          <button
                            type="button"
                            onClick={handleDetectLocation}
                            className="bg-red-100 hover:bg-red-200 text-red-800 px-2.5 py-1 rounded-lg font-bold transition cursor-pointer flex items-center space-x-1"
                          >
                            <RefreshCw className="h-3 w-3" />
                            <span>Retry GPS</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* INTERACTIVE DRAGGABLE LEAFLET MAP & NOMINATIM SEARCH BAR */}
                    <DraggableLocationPicker
                      coords={coordinates}
                      address={address}
                      onChange={(newCoords) => {
                        setCoordinates({ lat: newCoords.lat, lng: newCoords.lng });
                        if (newCoords.address) {
                          setAddress(newCoords.address);
                        }
                        setLocationCaptured(true);
                      }}
                      onDetectCurrentLocation={handleDetectLocation}
                      isDetecting={isDetectingLocation}
                      role="provider"
                      height="220px"
                      showSearchBar={true}
                      searchPlaceholder="Search your area, e.g. Indiranagar, Bengaluru"
                      helperText="Location not exact? Click or drag the pin to your exact spot."
                    />

                    {/* Manual Coordinates Toggle (Collapsible) */}
                    <div className="pt-0.5">
                      <button
                        type="button"
                        onClick={() => setIsManualLocation(!isManualLocation)}
                        className="text-[11px] text-slate-500 hover:text-emerald-700 font-medium underline cursor-pointer"
                      >
                        {isManualLocation ? 'Hide manual coordinate inputs' : 'Fine-tune coordinates manually'}
                      </button>

                      {isManualLocation && (
                        <div className="mt-2 grid grid-cols-2 gap-2 bg-white p-2.5 rounded-xl border border-slate-200">
                          <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">
                              Latitude
                            </label>
                            <input
                              type="number"
                              step="0.000001"
                              value={coordinates.lat}
                              onChange={(e) => {
                                setCoordinates(prev => ({ ...prev, lat: Number(e.target.value) }));
                                setLocationCaptured(true);
                              }}
                              className="w-full px-2 py-1 text-xs border border-slate-300 rounded-lg outline-none font-mono"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">
                              Longitude
                            </label>
                            <input
                              type="number"
                              step="0.000001"
                              value={coordinates.lng}
                              onChange={(e) => {
                                setCoordinates(prev => ({ ...prev, lng: Number(e.target.value) }));
                                setLocationCaptured(true);
                              }}
                              className="w-full px-2 py-1 text-xs border border-slate-300 rounded-lg outline-none font-mono"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting || isDetectingLocation}
                className={`w-full mt-2 active:scale-[0.99] disabled:opacity-75 text-white font-bold py-3 px-4 rounded-xl transition shadow-lg flex items-center justify-center space-x-2 cursor-pointer text-sm ${selectedRole === 'provider'
                  ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20'
                  : 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20'
                  }`}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Creating account...</span>
                  </>
                ) : (
                  <>
                    <span>
                      {selectedRole === 'provider' ? 'Register as Service Provider' : 'Sign Up as Customer'}
                    </span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>

              <div className="pt-3 text-center">
                <p className="text-xs text-slate-500">
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('login');
                      setErrorMessage('');
                    }}
                    className="text-blue-600 font-bold hover:underline cursor-pointer"
                  >
                    Log in here
                  </button>
                </p>
              </div>

            </form>
          )}

        </div>

      </main>

      {/* 3. FOOTER WITH ADMIN PORTAL LINK */}
      <footer className="bg-white border-t border-slate-200 py-5 px-4 text-center text-xs text-slate-500 space-y-2">
        <p>LocalServe • Secure Firebase Authentication & GPS Location Dispatch</p>
        <div className="flex items-center justify-center space-x-4">
          <button
            type="button"
            onClick={() => {
              setAdminPasscode('');
              setAdminPasscodeError('');
              setShowAdminModal(true);
            }}
            className="text-slate-400 hover:text-blue-600 font-semibold transition cursor-pointer flex items-center space-x-1 hover:underline text-[11px]"
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Admin Portal</span>
          </button>
        </div>
      </footer>

      {/* DEMO ADMIN PASSCODE MODAL */}
      {showAdminModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150">
            <div className="bg-slate-900 p-5 text-white flex justify-between items-start">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-blue-600 rounded-xl text-white">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base">Admin Portal Access</h3>
                  <p className="text-xs text-slate-400">Platform Verification & Bookings</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAdminModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAdminAccess} className="p-5 space-y-4">
              <div className="bg-blue-50 border border-blue-200 p-3 rounded-2xl text-xs text-blue-900 space-y-0.5">
                <span className="font-bold block text-blue-800">Demo Passcode:</span>
                <code className="font-mono font-black text-sm text-blue-700 bg-white px-2 py-0.5 rounded border border-blue-200 inline-block">
                  admin123
                </code>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Enter Passcode
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="password"
                    autoFocus
                    placeholder="e.g. admin123"
                    value={adminPasscode}
                    onChange={(e) => {
                      setAdminPasscode(e.target.value);
                      setAdminPasscodeError('');
                    }}
                    className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition font-mono"
                  />
                </div>
                {adminPasscodeError && (
                  <p className="text-xs text-rose-600 font-bold mt-1.5 animate-in fade-in">
                    {adminPasscodeError}
                  </p>
                )}
              </div>

              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white font-bold py-2.5 px-4 rounded-xl transition shadow-md shadow-blue-500/20 text-sm cursor-pointer"
              >
                Open Admin Portal
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
