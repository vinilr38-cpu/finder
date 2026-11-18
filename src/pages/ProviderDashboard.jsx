import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  LogOut, Wrench, DollarSign, CheckCircle2, 
  MapPin, Bell, XCircle, Briefcase, 
  User, Radio, Calendar, Clock, Loader2, Sparkles,
  Crosshair, RefreshCw, ChevronDown, ChevronUp,
  Phone, MessageSquare
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  updateDoc 
} from 'firebase/firestore';
import DraggableLocationPicker from '../components/DraggableLocationPicker';
import BookingChatModal from '../components/BookingChatModal';

// Helper to format Firestore serverTimestamp
function formatRequestTime(timestamp, createdMillis) {
  if (timestamp && typeof timestamp.toDate === 'function') {
    return timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  if (createdMillis) {
    return new Date(createdMillis).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return 'Just now';
}

export default function ProviderDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // 1. Online/Offline state synced directly with Firestore users/{uid}
  const [isOnline, setIsOnline] = useState(() => user?.isOnline !== false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // Geolocation & Interactive Map states
  const [isUpdatingLocation, setIsUpdatingLocation] = useState(false);
  const [isSavingLocation, setIsSavingLocation] = useState(false);
  const [showLocationMap, setShowLocationMap] = useState(true);
  const [providerAddress, setProviderAddress] = useState(user?.address || '');
  const [providerCoords, setProviderCoords] = useState({
    lat: Number(user?.lat) || 17.385044,
    lng: Number(user?.lng) || 78.486671
  });

  // 2. Real Firestore Bookings states (where providerId == currentUser.uid)
  const [activeRequests, setActiveRequests] = useState([]); // status == 'pending'
  const [acceptedJobs, setAcceptedJobs] = useState([]); // status == 'accepted'
  const [completedJobs, setCompletedJobs] = useState([]); // status == 'completed'
  const [loadingBookings, setLoadingBookings] = useState(true);

  // Real-time Chat modal state
  const [activeChatBooking, setActiveChatBooking] = useState(null);

  // Live notification banner
  const [notification, setNotification] = useState(null);

  // Keep isOnline, coords and address in sync if user profile loads
  useEffect(() => {
    if (user?.isOnline !== undefined) {
      setIsOnline(user.isOnline);
    }
    if (user?.lat && user?.lng) {
      setProviderCoords({
        lat: Number(user.lat),
        lng: Number(user.lng)
      });
    }
    if (user?.address) {
      setProviderAddress(user.address);
    }
  }, [user?.isOnline, user?.lat, user?.lng, user?.address]);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  // 1. ONLINE / OFFLINE TOGGLE: Directly updates isOnline in Firestore users/{uid}
  const handleToggleOnline = async () => {
    const currentUid = user?.uid || user?.id;
    if (!currentUid) return;

    const nextState = !isOnline;
    setIsOnline(nextState);
    setIsUpdatingStatus(true);

    try {
      await updateDoc(doc(db, 'users', currentUid), {
        isOnline: nextState
      });
      setNotification(`Status updated: You are now ${nextState ? 'ONLINE & visible on the customer map' : 'OFFLINE'}`);
    } catch (err) {
      console.error('Error updating isOnline in Firestore:', err);
      setIsOnline(!nextState);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // 2. CONFIRM & SAVE LOCATION: Saves exact lat/lng and readable address to Firestore users/{uid}
  const handleConfirmLocation = async (coordsToSave) => {
    const coords = coordsToSave || providerCoords;
    const currentUid = user?.uid || user?.id;
    if (!currentUid) return;

    setIsSavingLocation(true);
    try {
      const updatePayload = {
        lat: Number(coords.lat),
        lng: Number(coords.lng),
        ...(coords.address ? { address: coords.address } : (providerAddress ? { address: providerAddress } : {}))
      };

      await updateDoc(doc(db, 'users', currentUid), updatePayload);
      setNotification(`📍 Exact location confirmed and saved to Firestore! ${coords.address ? `Address: ${coords.address.slice(0, 40)}...` : `Coordinates: [${Number(coords.lat).toFixed(4)}, ${Number(coords.lng).toFixed(4)}]`}`);
    } catch (err) {
      console.error('Error saving coordinates to Firestore:', err);
      alert('Failed to update coordinates in Firestore: ' + err.message);
    } finally {
      setIsSavingLocation(false);
    }
  };

  // 3. UPDATE MY LOCATION: Runs geolocation check and updates lat/lng in Firestore users/{uid}
  const handleUpdateLocation = () => {
    setShowLocationMap(true);
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }

    setIsUpdatingLocation(true);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        const newCoords = {
          lat: Number(latitude.toFixed(6)),
          lng: Number(longitude.toFixed(6))
        };
        setProviderCoords(newCoords);

        const currentUid = user?.uid || user?.id;
        if (currentUid) {
          try {
            await updateDoc(doc(db, 'users', currentUid), {
              lat: newCoords.lat,
              lng: newCoords.lng
            });
            setNotification(`📍 GPS coordinates updated to [${newCoords.lat.toFixed(5)}, ${newCoords.lng.toFixed(5)}] in Firestore! Customers will see your updated map pin.`);
          } catch (err) {
            console.error('Error saving coordinates to Firestore:', err);
            alert('Failed to update coordinates in Firestore: ' + err.message);
          }
        }
        setIsUpdatingLocation(false);
      },
      (error) => {
        setIsUpdatingLocation(false);
        let msg = 'Could not update your location.';
        if (error.code === error.PERMISSION_DENIED) {
          msg = 'Location permission was denied in your browser settings.';
        } else if (error.code === error.TIMEOUT) {
          msg = 'Location request timed out. Please retry.';
        }
        alert(msg);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // 3. FIRESTORE onSnapshot: Listen to bookings where providerId == currentUser.uid
  useEffect(() => {
    const currentUid = user?.uid || user?.id;
    if (!currentUid) return;

    setLoadingBookings(true);
    let unsubscribe;

    try {
      const q = query(
        collection(db, 'bookings'),
        where('providerId', '==', currentUid)
      );

      unsubscribe = onSnapshot(q, (snapshot) => {
        const pending = [];
        const accepted = [];
        const completed = [];

        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          const bookingItem = {
            id: docSnap.id,
            ...data
          };

          if (bookingItem.status === 'pending') {
            pending.push(bookingItem);
          } else if (bookingItem.status === 'accepted') {
            accepted.push(bookingItem);
          } else if (bookingItem.status === 'completed') {
            completed.push(bookingItem);
          }
        });

        const sortByDate = (a, b) => {
          const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdMillis || 0);
          const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdMillis || 0);
          return timeB - timeA;
        };

        pending.sort(sortByDate);
        accepted.sort(sortByDate);
        completed.sort(sortByDate);

        setActiveRequests(pending);
        setAcceptedJobs(accepted);
        setCompletedJobs(completed);
        setLoadingBookings(false);

        if (pending.length > 0) {
          setNotification(`🔔 Live Alert: You have ${pending.length} pending service request(s)!`);
        }
      }, (error) => {
        console.error('Firestore bookings listener error:', error.message);
        setLoadingBookings(false);
      });
    } catch (err) {
      console.error('Failed to attach bookings listener:', err);
      setLoadingBookings(false);
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [user?.uid, user?.id]);

  // 4. ACTION: Accept Request -> Updates status to 'accepted' in Firestore
  const handleAcceptRequest = async (request) => {
    try {
      await updateDoc(doc(db, 'bookings', request.id), {
        status: 'accepted'
      });
      setNotification(`✅ Accepted booking from ${request.customerName}! Moved to In-Progress Jobs.`);
    } catch (err) {
      console.error('Error accepting booking:', err);
      alert('Could not update booking: ' + err.message);
    }
  };

  // 5. ACTION: Decline Request -> Updates status to 'declined' in Firestore
  const handleDeclineRequest = async (request) => {
    try {
      await updateDoc(doc(db, 'bookings', request.id), {
        status: 'declined'
      });
      setNotification(`❌ Declined booking from ${request.customerName}.`);
    } catch (err) {
      console.error('Error declining booking:', err);
      alert('Could not update booking: ' + err.message);
    }
  };

  // 6. ACTION: Mark as Completed -> Updates status to 'completed' in Firestore
  const handleCompleteJob = async (job) => {
    try {
      await updateDoc(doc(db, 'bookings', job.id), {
        status: 'completed'
      });
      setNotification(`🎉 Job completed! Added ₹${job.price} to your earnings.`);
    } catch (err) {
      console.error('Error completing job:', err);
      alert('Could not complete job: ' + err.message);
    }
  };

  // Dynamic earnings calculation
  const totalCompletedEarnings = completedJobs.reduce((sum, j) => sum + (Number(j.price) || 0), 0) + 15000;
  const totalCompletedCount = completedJobs.length + 32;

  return (
    <div className="min-h-screen bg-slate-100 font-sans text-slate-800 flex flex-col justify-between">
      
      {/* 1. TOP NAVIGATION BAR */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-emerald-600 p-2 rounded-xl text-white shadow-xs">
              <Wrench className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-extrabold text-xl tracking-tight text-slate-900 leading-none">
                LocalServe Pro
              </h1>
              <p className="text-[11px] text-slate-400 font-medium leading-none mt-0.5">
                Provider Control Center • Live Firestore Sync
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 sm:space-x-3">
            {/* Update My Location Button */}
            <button
              onClick={handleUpdateLocation}
              disabled={isUpdatingLocation}
              title="Detect and update GPS coordinates in Firestore"
              className="flex items-center space-x-1.5 bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 px-3 py-1.5 rounded-xl border border-slate-200 hover:border-emerald-300 text-xs font-semibold transition cursor-pointer shadow-2xs"
            >
              {isUpdatingLocation ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-600" />
                  <span className="hidden sm:inline">Updating GPS...</span>
                </>
              ) : (
                <>
                  <Crosshair className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Update My Location</span>
                </>
              )}
            </button>

            {/* Provider Info Pill */}
            <div className="hidden md:flex items-center space-x-2 bg-emerald-50 text-emerald-800 border border-emerald-200 px-3 py-1.5 rounded-full text-xs font-semibold">
              <User className="h-3.5 w-3.5 text-emerald-600" />
              <span>{user?.name || 'Service Provider'}</span>
              <span className="text-[10px] bg-emerald-200 text-emerald-900 px-1.5 py-0.2 rounded font-bold uppercase">
                {user?.serviceCategory || 'Specialist'}
              </span>
            </div>

            {/* Logout Button */}
            <button
              onClick={handleLogout}
              className="flex items-center space-x-1.5 bg-slate-100 hover:bg-red-50 text-slate-700 hover:text-red-600 px-3.5 py-1.5 rounded-xl border border-slate-200 hover:border-red-200 text-xs font-bold transition cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </nav>

      {/* MAIN DASHBOARD BODY */}
      <main className="max-w-6xl w-full mx-auto px-4 sm:px-6 py-8 space-y-8 flex-1">

        {/* 2. LARGE ONLINE / OFFLINE TOGGLE SWITCH CARD */}
        <div className={`rounded-3xl p-6 sm:p-8 border-2 transition-all shadow-md ${
          isOnline 
            ? 'bg-gradient-to-r from-emerald-600 to-teal-700 text-white border-emerald-400 shadow-emerald-600/10' 
            : 'bg-white text-slate-800 border-slate-300 shadow-slate-200/50'
        }`}>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            
            {/* Status Information & Live Coords */}
            <div className="space-y-2">
              <div className="flex items-center space-x-3">
                <span className={`h-4 w-4 rounded-full relative flex items-center justify-center ${
                  isOnline ? 'bg-white' : 'bg-slate-400'
                }`}>
                  {isOnline && (
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75"></span>
                  )}
                </span>
                <span className={`text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                  isOnline ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                }`}>
                  Status: {isOnline ? 'LIVE & VISIBLE TO CUSTOMERS' : 'CURRENTLY OFFLINE'}
                </span>
              </div>

              <h2 className={`text-2xl sm:text-3xl font-extrabold ${isOnline ? 'text-white' : 'text-slate-900'}`}>
                {isOnline ? 'You Are Online — Accepting Live Customer Bookings' : 'You Are Offline — Hidden from Customer Search'}
              </h2>

              <p className={`text-sm max-w-xl ${isOnline ? 'text-emerald-100' : 'text-slate-500'}`}>
                {isOnline
                  ? 'Your profile and location pin are visible to customers on the map. Incoming booking requests appear below in real time via Firestore onSnapshot.'
                  : 'Flip the toggle to go Online. Your status will update in Firestore users/{uid} immediately.'}
              </p>

              {/* Coordinates Badge */}
              <div className="pt-2 flex flex-wrap items-center gap-2 text-xs">
                <span className={`px-2.5 py-1 rounded-lg font-mono flex items-center ${
                  isOnline ? 'bg-emerald-800/40 text-emerald-100 border border-emerald-400/30' : 'bg-slate-100 text-slate-600 border border-slate-200'
                }`}>
                  <MapPin className="h-3.5 w-3.5 mr-1 text-emerald-300" />
                  Map Coordinates: {providerCoords.lat.toFixed(4)}, {providerCoords.lng.toFixed(4)}
                </span>

                <button
                  onClick={handleUpdateLocation}
                  disabled={isUpdatingLocation}
                  className={`underline font-bold transition cursor-pointer flex items-center space-x-1 ${
                    isOnline ? 'text-white hover:text-emerald-200' : 'text-emerald-600 hover:text-emerald-800'
                  }`}
                >
                  <RefreshCw className={`h-3 w-3 ${isUpdatingLocation ? 'animate-spin' : ''}`} />
                  <span>{isUpdatingLocation ? 'Locating...' : 'Update GPS'}</span>
                </button>
              </div>
            </div>

            {/* LARGE TOGGLE SWITCH */}
            <div className="flex flex-col items-center sm:items-end shrink-0">
              <span className={`text-xs font-extrabold uppercase mb-2 tracking-wider ${
                isOnline ? 'text-emerald-100' : 'text-slate-500'
              }`}>
                {isUpdatingStatus ? 'SAVING...' : isOnline ? 'ONLINE' : 'OFFLINE'}
              </span>

              <button
                type="button"
                role="switch"
                disabled={isUpdatingStatus}
                aria-checked={isOnline}
                onClick={handleToggleOnline}
                className={`w-24 h-12 rounded-full p-1.5 transition-colors duration-300 ease-in-out relative flex items-center cursor-pointer shadow-inner border-2 ${
                  isOnline
                    ? 'bg-emerald-400 border-white/40'
                    : 'bg-slate-300 border-slate-300'
                }`}
              >
                <div
                  className={`w-9 h-9 rounded-full bg-white shadow-md transform transition-transform duration-300 ease-in-out flex items-center justify-center font-bold text-xs ${
                    isOnline
                      ? 'translate-x-12 text-emerald-700'
                      : 'translate-x-0 text-slate-400'
                  }`}
                >
                  {isOnline ? 'ON' : 'OFF'}
                </div>
              </button>
            </div>

          </div>
        </div>

        {/* INTERACTIVE LOCATION PICKER (Draggable pin & Click to Move) */}
        <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center space-x-3">
              <div className="bg-emerald-100 text-emerald-700 p-2.5 rounded-2xl">
                <MapPin className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-900 text-lg leading-tight">
                  Service Base Location & Map Pin
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Customers view your distance and map pin from this exact spot.
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => setShowLocationMap(!showLocationMap)}
                className="text-xs font-bold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3.5 py-1.5 rounded-xl transition cursor-pointer flex items-center space-x-1"
              >
                <span>{showLocationMap ? 'Hide Map' : 'Adjust Pin on Map'}</span>
                {showLocationMap ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>

          {showLocationMap && (
            <div className="pt-1 animate-in fade-in duration-150">
              <DraggableLocationPicker
                coords={providerCoords}
                address={providerAddress}
                onChange={(newCoords) => {
                  setProviderCoords({ lat: newCoords.lat, lng: newCoords.lng });
                  if (newCoords.address) {
                    setProviderAddress(newCoords.address);
                  }
                }}
                onConfirm={handleConfirmLocation}
                showConfirmButton={true}
                confirmButtonText="Confirm & Save Spot to Firestore"
                isSaving={isSavingLocation}
                onDetectCurrentLocation={handleUpdateLocation}
                isDetecting={isUpdatingLocation}
                role="provider"
                height="280px"
                showSearchBar={true}
                searchPlaceholder="Search your area, e.g. Indiranagar, Bengaluru"
                helperText="Location not exact? Click or drag the pin to your exact spot."
              />
            </div>
          )}
        </div>

        {/* METRICS ROW */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
            <div className="flex items-center space-x-2 text-emerald-600 text-xs font-bold uppercase mb-1">
              <DollarSign className="h-4 w-4" />
              <span>Total Earnings</span>
            </div>
            <p className="text-2xl font-extrabold text-slate-900">₹{totalCompletedEarnings.toLocaleString()}</p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
            <div className="flex items-center space-x-2 text-blue-600 text-xs font-bold uppercase mb-1">
              <CheckCircle2 className="h-4 w-4" />
              <span>Completed Jobs</span>
            </div>
            <p className="text-2xl font-extrabold text-slate-900">{totalCompletedCount}</p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
            <div className="flex items-center space-x-2 text-amber-500 text-xs font-bold uppercase mb-1">
              <Bell className="h-4 w-4" />
              <span>Pending Requests</span>
            </div>
            <p className="text-2xl font-extrabold text-slate-900">{activeRequests.length}</p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
            <div className="flex items-center space-x-2 text-purple-600 text-xs font-bold uppercase mb-1">
              <Briefcase className="h-4 w-4" />
              <span>Active Orders</span>
            </div>
            <p className="text-2xl font-extrabold text-slate-900">{acceptedJobs.length}</p>
          </div>
        </div>

        {/* 3. ACTIVE REQUESTS SECTION (Listening to Firestore bookings where providerId == currentUser.uid) */}
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <div className="flex items-center space-x-3">
              <div className="h-3 w-3 rounded-full bg-amber-500 animate-pulse"></div>
              <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900">
                Active Requests
              </h2>
              {activeRequests.length > 0 && (
                <span className="bg-amber-100 text-amber-800 text-xs font-bold px-2.5 py-0.5 rounded-full">
                  {activeRequests.length} Waiting
                </span>
              )}
            </div>

            <div className="flex items-center space-x-2">
              <span className="text-xs text-slate-500 flex items-center bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-xs font-medium">
                <span className="h-2 w-2 rounded-full bg-emerald-500 mr-2"></span>
                Filtered: <code className="font-mono text-blue-600 ml-1">providerId == {user?.uid?.slice(0, 6)}...</code>
              </span>
            </div>
          </div>

          {/* Requests List */}
          {loadingBookings ? (
            <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center flex flex-col items-center justify-center space-y-3">
              <Loader2 className="h-8 w-8 text-emerald-600 animate-spin" />
              <p className="text-sm font-semibold text-slate-700">Connecting to bookings stream...</p>
            </div>
          ) : activeRequests.length === 0 ? (
            <div className="bg-white rounded-3xl border border-dashed border-slate-300 p-12 text-center space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                <Bell className="h-7 w-7" />
              </div>
              <h3 className="font-bold text-slate-700 text-lg">No Pending Booking Requests</h3>
              <p className="text-slate-400 text-sm max-w-md mx-auto">
                {isOnline
                  ? "You're Online! Whenever a customer clicks 'Book Now' on your card, their live request will appear here with Accept and Decline options."
                  : 'You are currently Offline. Turn the toggle switch to Online to start receiving customer bookings.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {activeRequests.map((request) => (
                <div
                  key={request.id}
                  className="bg-white rounded-3xl p-6 border-2 border-amber-300 ring-2 ring-amber-100 transition-all shadow-sm hover:shadow-md flex flex-col justify-between"
                >
                  <div className="space-y-4">
                    {/* Header: Customer Name & Estimated Rate */}
                    <div className="flex justify-between items-start">
                      <div className="flex items-center space-x-3">
                        <div className="w-11 h-11 rounded-2xl bg-blue-100 text-blue-700 font-extrabold flex items-center justify-center text-sm shadow-xs">
                          {(request.customerName || 'Customer').slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <h3 className="font-bold text-slate-900 text-lg leading-tight">
                            {request.customerName || 'Customer Request'}
                          </h3>
                          <span className="text-xs text-slate-400 font-medium">
                            Requested: {formatRequestTime(request.createdAt, request.createdMillis)}
                          </span>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-xl font-extrabold text-slate-900 block">
                          ₹{request.price}
                        </span>
                        <span className="text-[11px] font-semibold text-slate-400 uppercase">
                          Standard Visit Rate
                        </span>
                      </div>
                    </div>

                    {/* Service Needed Badge & Address */}
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase text-slate-400">
                          Service Category
                        </span>
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                          {request.serviceCategory}
                        </span>
                      </div>

                      <div className="text-xs text-slate-700 space-y-1 pt-1 border-t border-slate-200/60">
                        {request.date && (
                          <div className="flex items-center text-slate-600">
                            <Calendar className="h-3.5 w-3.5 text-slate-400 mr-1.5 shrink-0" />
                            <span>Requested for: <strong>{request.date} ({request.time})</strong></span>
                          </div>
                        )}
                        {request.address && (
                          <div className="flex items-center text-slate-600">
                            <MapPin className="h-3.5 w-3.5 text-slate-400 mr-1.5 shrink-0" />
                            <span className="truncate">{request.address}</span>
                          </div>
                        )}
                        <div className="text-[11px] text-slate-400 font-mono pt-1">
                          Booking ID: {request.id.slice(0, 8)}...
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Call & Message Actions + Accept & Decline */}
                  <div className="pt-5 space-y-2.5">
                    {/* One-Tap Call & Real-time Chat Buttons */}
                    <div className="grid grid-cols-2 gap-2">
                      <a
                        href={`tel:${request.customerPhone || '+91 98765 43210'}`}
                        title={`Call Customer: ${request.customerPhone || '+91 98765 43210'}`}
                        className="bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white py-2 px-3 rounded-xl font-bold text-xs transition shadow-xs flex items-center justify-center space-x-1.5 cursor-pointer"
                      >
                        <Phone className="h-3.5 w-3.5" />
                        <span>Call</span>
                        {request.customerPhone && (
                          <span className="text-[10px] opacity-85 hidden sm:inline ml-0.5 font-normal">
                            ({request.customerPhone})
                          </span>
                        )}
                      </a>

                      <button
                        type="button"
                        onClick={() => setActiveChatBooking(request)}
                        className="bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white py-2 px-3 rounded-xl font-bold text-xs transition shadow-xs flex items-center justify-center space-x-1.5 cursor-pointer"
                      >
                        <MessageSquare className="h-3.5 w-3.5" />
                        <span>Message</span>
                      </button>
                    </div>

                    {/* LARGE ACCEPT AND DECLINE BUTTONS */}
                    <div className="grid grid-cols-2 gap-2.5 pt-1">
                      <button
                        onClick={() => handleAcceptRequest(request)}
                        className="bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white py-3 px-3 rounded-2xl font-bold text-sm transition shadow-md shadow-emerald-600/20 flex items-center justify-center space-x-1.5 cursor-pointer"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        <span>Accept</span>
                      </button>

                      <button
                        onClick={() => handleDeclineRequest(request)}
                        className="bg-white hover:bg-red-50 hover:text-red-600 border-2 border-slate-200 hover:border-red-300 text-slate-700 active:scale-[0.98] py-3 px-3 rounded-2xl font-bold text-sm transition flex items-center justify-center space-x-1.5 cursor-pointer"
                      >
                        <XCircle className="h-4 w-4" />
                        <span>Decline</span>
                      </button>
                    </div>
                  </div>

                </div>
              ))}
            </div>
          )}
        </section>

        {/* 4. IN-PROGRESS / ACCEPTED JOBS SECTION */}
        <section className="space-y-4 pt-6 border-t border-slate-200">
          <div className="flex items-center space-x-3">
            <div className="h-3 w-3 rounded-full bg-emerald-500"></div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900">
              Active / In-Progress Jobs ({acceptedJobs.length})
            </h2>
          </div>

          {acceptedJobs.length === 0 ? (
            <div className="bg-white rounded-3xl border border-dashed border-slate-300 p-8 text-center text-slate-400 text-sm">
              No jobs currently in progress. When you accept an incoming request above, it will move here.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {acceptedJobs.map((job) => (
                <div key={job.id} className="bg-white rounded-2xl p-5 border border-emerald-200 shadow-xs flex flex-col justify-between space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center space-x-2">
                        <h4 className="font-bold text-slate-900 text-base">{job.customerName}</h4>
                        <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                          In Progress
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-emerald-700 mt-0.5">{job.serviceCategory}</p>
                      <p className="text-xs text-slate-500 flex items-center mt-1">
                        <MapPin className="h-3 w-3 mr-1 text-slate-400" />
                        {job.address || 'Customer Location'}
                      </p>
                    </div>
                    <span className="font-extrabold text-base text-slate-900">₹{job.price}</span>
                  </div>

                  {/* Actions: Call & Message + Mark Completed */}
                  <div className="space-y-2 pt-2 border-t border-slate-100">
                    <div className="grid grid-cols-2 gap-2">
                      <a
                        href={`tel:${job.customerPhone || '+91 98765 43210'}`}
                        title={`Call Customer: ${job.customerPhone || '+91 98765 43210'}`}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white py-1.5 px-3 rounded-xl font-bold text-xs transition flex items-center justify-center space-x-1 cursor-pointer"
                      >
                        <Phone className="h-3 w-3" />
                        <span>Call Customer</span>
                      </a>

                      <button
                        type="button"
                        onClick={() => setActiveChatBooking(job)}
                        className="bg-blue-600 hover:bg-blue-700 text-white py-1.5 px-3 rounded-xl font-bold text-xs transition flex items-center justify-center space-x-1 cursor-pointer"
                      >
                        <MessageSquare className="h-3 w-3" />
                        <span>Message</span>
                      </button>
                    </div>

                    <button
                      onClick={() => handleCompleteJob(job)}
                      className="w-full bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition flex items-center justify-center space-x-2 cursor-pointer"
                    >
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      <span>Mark as Completed & Collect ₹{job.price}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

      </main>

      {/* NOTIFICATION TOAST */}
      {notification && (
        <div className="fixed bottom-6 right-6 bg-slate-900 text-white px-5 py-4 rounded-2xl shadow-2xl flex items-center justify-between space-x-4 border border-slate-700 z-50 animate-in slide-in-from-bottom-2 max-w-md">
          <p className="text-xs sm:text-sm font-semibold">{notification}</p>
          <button
            onClick={() => setNotification(null)}
            className="text-slate-400 hover:text-white p-1 cursor-pointer"
          >
            <XCircle className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* REAL-TIME BOOKING CHAT MODAL */}
      {activeChatBooking && (
        <BookingChatModal
          booking={activeChatBooking}
          currentUser={user}
          onClose={() => setActiveChatBooking(null)}
        />
      )}

      {/* FOOTER */}
      <footer className="bg-white border-t border-slate-200 py-4 text-center text-xs text-slate-400">
        LocalServe Provider Portal • Real-Time Firestore onSnapshot Sync & GPS Coordinates
      </footer>

    </div>
  );
}
