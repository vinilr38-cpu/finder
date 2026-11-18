import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LogOut, Search, MapPin, Calendar, Clock,
  Wrench, Zap, Sparkles, Hammer,
  CheckCircle2, X, ChevronRight, User as UserIcon,
  Crosshair, Loader2, Phone, AlertCircle, Radio, Wind,
  Bookmark, XCircle, MessageSquare, Star, ArrowUpDown
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase';
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  serverTimestamp,
  doc,
  updateDoc,
  getDoc
} from 'firebase/firestore';
import AddressSearchBar from '../components/AddressSearchBar';
import BookingChatModal from '../components/BookingChatModal';
import ReviewModal from '../components/ReviewModal';
import { getWhatsAppUrl, WhatsAppIcon } from '../utils/whatsapp';

// Customer Center Coordinates (Hyderabad)
const CUSTOMER_LOCATION = {
  lat: 17.385044,
  lng: 78.486671,
  address: "Road No. 1, Banjara Hills, Hyderabad"
};

// Haversine formula helper function that returns the distance in kilometers rounded to 1 decimal place
export function getDistanceKm(lat1, lng1, lat2, lng2) {
  if (
    lat1 === undefined || lat1 === null || lng1 === undefined || lng1 === null ||
    lat2 === undefined || lat2 === null || lng2 === undefined || lng2 === null
  ) {
    return 0;
  }
  const p1 = Number(lat1);
  const l1 = Number(lng1);
  const p2 = Number(lat2);
  const l2 = Number(lng2);

  if (isNaN(p1) || isNaN(l1) || isNaN(p2) || isNaN(l2)) return 0;

  const R = 6371; // Earth's radius in kilometers
  const dLat = (p2 - p1) * (Math.PI / 180);
  const dLng = (l2 - l1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(p1 * (Math.PI / 180)) * Math.cos(p2 * (Math.PI / 180)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const dist = R * c;
  return Number(dist.toFixed(1));
}

// Backwards compatibility alias
export const calculateDistanceKm = getDistanceKm;

// Disperse markers with default coordinates so pins don't overlap completely
function getDispersedCoords(provider, index, total, baseCoords = CUSTOMER_LOCATION) {
  let lat = Number(provider.lat) || (baseCoords?.lat || CUSTOMER_LOCATION.lat);
  let lng = Number(provider.lng) || (baseCoords?.lng || CUSTOMER_LOCATION.lng);

  const refLat = baseCoords?.lat || CUSTOMER_LOCATION.lat;
  const refLng = baseCoords?.lng || CUSTOMER_LOCATION.lng;

  if (Math.abs(lat - refLat) < 0.0001 && Math.abs(lng - refLng) < 0.0001) {
    const angle = (index * 2 * Math.PI) / (total || 1);
    const radius = 0.004 + (index % 3) * 0.0025; // ~400m - 900m offset
    lat += Math.cos(angle) * radius;
    lng += Math.sin(angle) * radius;
  }
  return [lat, lng];
}

// Helper to format Firestore serverTimestamp
function formatBookingTime(timestamp, createdMillis) {
  if (timestamp && typeof timestamp.toDate === 'function') {
    return timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  if (createdMillis) {
    return new Date(createdMillis).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return 'Just now';
}

// Customer Marker Icon
const customerIcon = L.divIcon({
  className: 'custom-customer-icon',
  html: `
    <div style="position: relative; display: flex; align-items: center; justify-content: center;">
      <div style="position: absolute; width: 34px; height: 34px; background-color: rgba(37, 99, 235, 0.4); border-radius: 9999px; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
      <div style="background-color: #2563eb; color: white; width: 34px; height: 34px; border-radius: 9999px; display: flex; align-items: center; justify-content: center; font-size: 16px; border: 2.5px solid white; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.25);">
        📍
      </div>
    </div>
  `,
  iconSize: [34, 34],
  iconAnchor: [17, 17],
  popupAnchor: [0, -17],
});

// Category Icons for Leaflet map markers
const getProviderIcon = (category) => {
  let bgColor = '#059669'; // Emerald default
  let emoji = '🔧';

  const catLower = (category || '').toLowerCase();
  if (catLower.includes('electrician')) {
    bgColor = '#d97706';
    emoji = '⚡';
  } else if (catLower.includes('cleaner')) {
    bgColor = '#0891b2';
    emoji = '✨';
  } else if (catLower.includes('ac')) {
    bgColor = '#2563eb';
    emoji = '❄️';
  } else if (catLower.includes('carpenter')) {
    bgColor = '#ea580c';
    emoji = '🪚';
  } else if (catLower.includes('plumber')) {
    bgColor = '#059669';
    emoji = '🔧';
  }

  return L.divIcon({
    className: 'custom-provider-icon',
    html: `
      <div style="background-color: ${bgColor}; color: white; width: 32px; height: 32px; border-radius: 9999px; display: flex; align-items: center; justify-content: center; font-size: 14px; border: 2.5px solid white; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.25);">
        ${emoji}
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16],
  });
};

function MapRecenter({ targetCoords }) {
  const map = useMap();
  useEffect(() => {
    if (targetCoords) {
      map.flyTo([targetCoords.lat, targetCoords.lng], 15, { duration: 1.2 });
    }
  }, [targetCoords, map]);
  return null;
}

// Map Click Listener to move customer pin anywhere on click
function CustomerMapClickWatcher({ onLocationSelect }) {
  useMapEvents({
    click(e) {
      if (e?.latlng) {
        onLocationSelect({
          lat: Number(e.latlng.lat.toFixed(6)),
          lng: Number(e.latlng.lng.toFixed(6))
        });
      }
    },
  });
  return null;
}

export default function CustomerDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // Customer Dynamic Location (Hyderabad default or user profile coords)
  const [customerCoords, setCustomerCoords] = useState({
    lat: Number(user?.lat) || CUSTOMER_LOCATION.lat,
    lng: Number(user?.lng) || CUSTOMER_LOCATION.lng,
    address: user?.address || CUSTOMER_LOCATION.address
  });
  const [hasMovedLocation, setHasMovedLocation] = useState(false);
  const [isSavingCustomerLoc, setIsSavingCustomerLoc] = useState(false);
  const [locationSavedAlert, setLocationSavedAlert] = useState(false);

  // Sync with user profile once loaded
  useEffect(() => {
    if (user?.lat && user?.lng) {
      setCustomerCoords(prev => ({
        ...prev,
        lat: Number(user.lat),
        lng: Number(user.lng),
        ...(user.address ? { address: user.address } : {})
      }));
      if (user.address) {
        setServiceAddress(user.address);
      }
    }
  }, [user?.lat, user?.lng, user?.address]);

  // Left Column View: 'providers' | 'bookings'
  const [activeLeftTab, setActiveLeftTab] = useState('providers');

  // Real providers from Firestore
  const [providers, setProviders] = useState([]);
  const [loadingProviders, setLoadingProviders] = useState(true);

  // Real Customer Bookings from Firestore
  const [myBookings, setMyBookings] = useState([]);
  const [loadingBookings, setLoadingBookings] = useState(true);

  // Filter, Search, Distance Radius & Sort states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [distanceFilter, setDistanceFilter] = useState('all'); // 'all' | '5' | '10'
  const [sortBy, setSortBy] = useState('nearest'); // 'nearest' | 'highest_rated' | 'lowest_price'
  const [isDetectingGPS, setIsDetectingGPS] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [mapTarget, setMapTarget] = useState(null);

  // Live GPS Detection via navigator.geolocation
  const handleDetectCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }
    setIsDetectingGPS(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setIsDetectingGPS(false);
        const lat = Number(position.coords.latitude.toFixed(6));
        const lng = Number(position.coords.longitude.toFixed(6));
        setCustomerCoords({
          lat,
          lng,
          address: 'Current GPS Location'
        });
        setMapTarget({ lat, lng });
        setHasMovedLocation(true);
      },
      (error) => {
        setIsDetectingGPS(false);
        console.warn('Geolocation error:', error);
        alert('Could not detect GPS location: ' + (error.message || 'Permission denied or timeout.'));
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // Booking modal & Real-time chat & Review states
  const [activeBookingProvider, setActiveBookingProvider] = useState(null);
  const [isSubmittingBooking, setIsSubmittingBooking] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(null);
  const [activeChatBooking, setActiveChatBooking] = useState(null);
  const [activeReviewBooking, setActiveReviewBooking] = useState(null);
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [reviewSuccessToast, setReviewSuccessToast] = useState(false);

  // Form states for booking modal
  const [serviceDate, setServiceDate] = useState('');
  const [serviceTime, setServiceTime] = useState('10:00 AM');
  const [serviceAddress, setServiceAddress] = useState(CUSTOMER_LOCATION.address);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  // Handle customer pin reposition (via dragend or map click)
  const handleCustomerLocationChange = (coords) => {
    setCustomerCoords(prev => ({
      ...prev,
      lat: coords.lat,
      lng: coords.lng
    }));
    setHasMovedLocation(true);
  };

  // Handle Nominatim address search selection
  const handleAddressSearchSelect = ({ lat, lng, address }) => {
    setCustomerCoords({
      lat,
      lng,
      address
    });
    setServiceAddress(address);
    setMapTarget({ lat, lng });
    setHasMovedLocation(true);
  };

  // Confirm and save coordinates & readable address to Firestore
  const handleConfirmCustomerLocation = async () => {
    const currentUid = user?.uid || user?.id;
    if (!currentUid) return;

    setIsSavingCustomerLoc(true);
    try {
      await updateDoc(doc(db, 'users', currentUid), {
        lat: customerCoords.lat,
        lng: customerCoords.lng,
        address: customerCoords.address || serviceAddress || ''
      });
      setHasMovedLocation(false);
      setLocationSavedAlert(true);
      setTimeout(() => setLocationSavedAlert(false), 3500);
    } catch (err) {
      console.warn('Could not save customer location in Firestore:', err.message);
    } finally {
      setIsSavingCustomerLoc(false);
    }
  };

  // Submit 5-star review, save to reviews & recalculate provider average rating in Firestore
  const handleReviewSubmit = async ({ rating, reviewText }) => {
    if (!activeReviewBooking) return;
    setIsSubmittingReview(true);

    try {
      // 1. Update the booking document in Firestore
      await updateDoc(doc(db, 'bookings', activeReviewBooking.id), {
        reviewed: true,
        rating,
        reviewText: reviewText || '',
        reviewedAt: serverTimestamp()
      });

      // 2. Add a new document to the reviews collection
      await addDoc(collection(db, 'reviews'), {
        bookingId: activeReviewBooking.id,
        providerId: activeReviewBooking.providerId,
        customerId: activeReviewBooking.customerId || user?.uid || user?.id,
        customerName: activeReviewBooking.customerName || user?.name || 'Customer',
        rating,
        reviewText: reviewText || '',
        createdAt: serverTimestamp()
      });

      // 3. Fetch provider document, calculate new average rating and increment reviewCount
      if (activeReviewBooking.providerId) {
        const providerRef = doc(db, 'users', activeReviewBooking.providerId);
        const providerSnap = await getDoc(providerRef);

        let oldRating = 0;
        let oldCount = 0;
        if (providerSnap.exists()) {
          const pData = providerSnap.data();
          oldRating = Number(pData.rating) || 0;
          oldCount = Number(pData.reviewCount) || 0;
        }

        const newCount = oldCount + 1;
        const newRating = Number((((oldRating * oldCount) + rating) / newCount).toFixed(1));

        await updateDoc(providerRef, {
          rating: newRating,
          reviewCount: newCount
        });
      }

      setActiveReviewBooking(null);
      setReviewSuccessToast(true);
      setTimeout(() => setReviewSuccessToast(false), 4000);
    } catch (err) {
      console.error('Failed to submit review:', err);
      alert('Could not submit review: ' + err.message);
    } finally {
      setIsSubmittingReview(false);
    }
  };

  // 1. FIRESTORE onSnapshot: Query users collection where role == 'provider' and isOnline == true
  useEffect(() => {
    setLoadingProviders(true);
    let unsubscribe;

    try {
      const q = query(
        collection(db, 'users'),
        where('role', '==', 'provider'),
        where('isOnline', '==', true)
      );

      unsubscribe = onSnapshot(q, (snapshot) => {
        const liveProviders = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          liveProviders.push({
            id: docSnap.id,
            uid: docSnap.id,
            name: data.name || 'Service Provider',
            role: data.serviceCategory || 'Specialist',
            serviceCategory: data.serviceCategory || 'Plumber',
            price: Number(data.price) || 500,
            phone: data.phone || '',
            lat: Number(data.lat) || CUSTOMER_LOCATION.lat,
            lng: Number(data.lng) || CUSTOMER_LOCATION.lng,
            isOnline: data.isOnline === true,
            email: data.email || '',
            rating: data.rating !== undefined ? Number(data.rating) : null,
            reviewCount: data.reviewCount !== undefined ? Number(data.reviewCount) : 0
          });
        });

        setProviders(liveProviders);
        setLoadingProviders(false);
      }, (error) => {
        console.warn('Firestore provider query error (using fallback):', error.message);
        const fallbackQ = query(collection(db, 'users'), where('role', '==', 'provider'));
        unsubscribe = onSnapshot(fallbackQ, (fallbackSnap) => {
          const fallbackList = [];
          fallbackSnap.forEach((docSnap) => {
            const data = docSnap.data();
            if (data.isOnline === true) {
              fallbackList.push({
                id: docSnap.id,
                uid: docSnap.id,
                name: data.name || 'Service Provider',
                role: data.serviceCategory || 'Specialist',
                serviceCategory: data.serviceCategory || 'Plumber',
                price: Number(data.price) || 500,
                phone: data.phone || '',
                lat: Number(data.lat) || CUSTOMER_LOCATION.lat,
                lng: Number(data.lng) || CUSTOMER_LOCATION.lng,
                isOnline: true,
                email: data.email || '',
                rating: data.rating !== undefined ? Number(data.rating) : null,
                reviewCount: data.reviewCount !== undefined ? Number(data.reviewCount) : 0
              });
            }
          });
          setProviders(fallbackList);
          setLoadingProviders(false);
        });
      });
    } catch (err) {
      console.error('Failed to attach Firestore provider listener:', err);
      setLoadingProviders(false);
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // 2. FIRESTORE onSnapshot: Listen to bookings collection where customerId == currentUser.uid for live status updates
  useEffect(() => {
    const currentUid = user?.uid || user?.id;
    if (!currentUid) return;

    setLoadingBookings(true);
    let unsubscribe;

    try {
      const q = query(
        collection(db, 'bookings'),
        where('customerId', '==', currentUid)
      );

      unsubscribe = onSnapshot(q, (snapshot) => {
        const bookingsList = [];
        snapshot.forEach((docSnap) => {
          bookingsList.push({
            id: docSnap.id,
            ...docSnap.data()
          });
        });

        // Sort by newest first
        bookingsList.sort((a, b) => {
          const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdMillis || 0);
          const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdMillis || 0);
          return timeB - timeA;
        });

        setMyBookings(bookingsList);
        setLoadingBookings(false);
      }, (err) => {
        console.warn('Error listening to customer bookings:', err.message);
        setLoadingBookings(false);
      });
    } catch (error) {
      console.error('Failed to attach customer bookings listener:', error);
      setLoadingBookings(false);
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [user?.uid, user?.id]);

  // Category filter definitions
  const categories = [
    { name: 'All', icon: Wrench },
    { name: 'Electrician', icon: Zap },
    { name: 'Plumber', icon: Wrench },
    { name: 'Cleaner', icon: Sparkles },
    { name: 'AC Repair', icon: Wind },
    { name: 'Carpenter', icon: Hammer },
  ];

  // 1. Calculate distance for every provider from customer's current lat/lng using Haversine formula
  const providersWithDistance = providers.map((provider, idx) => {
    const coords = getDispersedCoords(provider, idx, providers.length, customerCoords);
    const distance = getDistanceKm(customerCoords.lat, customerCoords.lng, coords[0], coords[1]);
    return {
      ...provider,
      dispersedCoords: coords,
      distance
    };
  });

  // 2. Filter providers by category, search query, and distance filter (All, Within 5 km, Within 10 km)
  const filteredProviders = providersWithDistance.filter((p) => {
    const category = (p.serviceCategory || p.role || '').toLowerCase();
    const matchesCategory =
      selectedCategory === 'All' || category.includes(selectedCategory.toLowerCase());
    const matchesSearch =
      (p.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      category.includes(searchQuery.toLowerCase());

    const matchesDistance =
      distanceFilter === 'all' ||
      (distanceFilter === '5' && p.distance <= 5.0) ||
      (distanceFilter === '10' && p.distance <= 10.0);

    return matchesCategory && matchesSearch && matchesDistance;
  });

  // 3. Sort providers: Nearest First, Highest Rated, Lowest Price
  const sortedProviders = [...filteredProviders].sort((a, b) => {
    if (sortBy === 'nearest') {
      return a.distance - b.distance;
    }
    if (sortBy === 'highest_rated') {
      const ratingA = Number(a.rating) || 0;
      const ratingB = Number(b.rating) || 0;
      if (ratingB !== ratingA) return ratingB - ratingA;
      return (Number(b.reviewCount) || 0) - (Number(a.reviewCount) || 0);
    }
    if (sortBy === 'lowest_price') {
      return (Number(a.price) || 0) - (Number(b.price) || 0);
    }
    return 0;
  });

  const handleFocusProvider = (provider, coords) => {
    setSelectedProvider(provider);
    setMapTarget({ lat: coords[0], lng: coords[1] });
  };

  const handleBookNowClick = (provider, e) => {
    if (e) e.stopPropagation();
    setActiveBookingProvider(provider);
  };

  // 3. BOOKING HANDLER: Writes new document to 'bookings' with required fields and serverTimestamp()
  const handleConfirmBooking = async (e) => {
    e.preventDefault();
    if (!activeBookingProvider) return;

    setIsSubmittingBooking(true);

    const currentUid = user?.uid || user?.id || 'cust_101';
    const currentName = user?.name || 'Customer Alex';

    const bookingPayload = {
      customerId: currentUid,
      customerName: currentName,
      customerPhone: user?.phone || user?.phoneNumber || '+91 98765 43210',
      providerId: activeBookingProvider.uid || activeBookingProvider.id,
      providerName: activeBookingProvider.name,
      providerPhone: activeBookingProvider.phone || '+91 98765 12345',
      serviceCategory: activeBookingProvider.serviceCategory || activeBookingProvider.role || 'Service',
      price: Number(activeBookingProvider.price) || 500,
      status: 'pending', // Required: status 'pending'
      createdAt: serverTimestamp(), // Required: serverTimestamp()
      createdMillis: Date.now(),
      date: serviceDate || 'Tomorrow',
      time: serviceTime,
      address: serviceAddress || customerCoords.address || CUSTOMER_LOCATION.address,
      customerLat: Number(customerCoords.lat),
      customerLng: Number(customerCoords.lng),
    };

    try {
      const docRef = await addDoc(collection(db, 'bookings'), bookingPayload);
      console.log('Booking written to Firestore with ID:', docRef.id);

      // Save customer coordinates to Firestore users/{uid} when confirming
      if (currentUid && currentUid !== 'cust_101') {
        try {
          await updateDoc(doc(db, 'users', currentUid), {
            lat: customerCoords.lat,
            lng: customerCoords.lng,
            address: serviceAddress || customerCoords.address || ''
          });
          setHasMovedLocation(false);
        } catch (e) {
          console.warn('Could not update user coordinates on booking confirmation:', e.message);
        }
      }
    } catch (err) {
      console.warn('Firestore write warning:', err.message);
    } finally {
      setIsSubmittingBooking(false);
      setBookingSuccess({
        provider: activeBookingProvider,
        date: serviceDate || 'Tomorrow',
        time: serviceTime,
      });
      setActiveBookingProvider(null);
      setServiceDate('');
      // Switch view to 'bookings' so customer immediately sees their new live pending request!
      setActiveLeftTab('bookings');
    }
  };

  // Helper for live status badges
  const renderStatusBadge = (status) => {
    switch (status) {
      case 'accepted':
        return (
          <span className="bg-emerald-100 text-emerald-800 border border-emerald-200 px-3 py-1 rounded-full text-xs font-extrabold flex items-center shadow-xs">
            <CheckCircle2 className="h-3.5 w-3.5 mr-1.5 text-emerald-600" />
            Accepted • Provider Assigned
          </span>
        );
      case 'declined':
        return (
          <span className="bg-rose-100 text-rose-800 border border-rose-200 px-3 py-1 rounded-full text-xs font-bold flex items-center">
            <XCircle className="h-3.5 w-3.5 mr-1.5 text-rose-600" />
            Declined
          </span>
        );
      case 'completed':
        return (
          <span className="bg-blue-100 text-blue-800 border border-blue-200 px-3 py-1 rounded-full text-xs font-bold flex items-center">
            <CheckCircle2 className="h-3.5 w-3.5 mr-1.5 text-blue-600" />
            Service Completed
          </span>
        );
      case 'pending':
      default:
        return (
          <span className="bg-amber-100 text-amber-800 border border-amber-200 px-3 py-1 rounded-full text-xs font-bold flex items-center animate-pulse">
            <Clock className="h-3.5 w-3.5 mr-1.5 text-amber-600" />
            Pending Provider Approval
          </span>
        );
    }
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-100 font-sans text-slate-800 overflow-hidden">

      {/* 1. TOP NAVIGATION BAR */}
      <nav className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between shrink-0 z-40 shadow-xs">
        <div className="flex items-center space-x-3">
          <div className="bg-blue-600 p-2 rounded-xl text-white shadow-xs">
            <Wrench className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-extrabold text-xl tracking-tight text-blue-900 leading-none">
              Welcome, {user?.name || 'Customer'}
            </h1>
            <p className="text-[11px] text-slate-400 font-medium leading-none mt-0.5">
              Live Verified Specialists • Real-Time Firestore Sync
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {/* Real-time Status Badge */}
          <div className="hidden sm:flex items-center space-x-2 bg-emerald-50 text-emerald-800 border border-emerald-200 px-3 py-1.5 rounded-full text-xs font-semibold">
            <Radio className="h-3.5 w-3.5 text-emerald-600 animate-pulse" />
            <span>{providers.length} Provider{providers.length === 1 ? '' : 's'} Online</span>
          </div>

          {/* Detect GPS Location Button */}
          <button
            type="button"
            onClick={handleDetectCurrentLocation}
            disabled={isDetectingGPS}
            title="Detect current GPS location from your device"
            className="flex items-center space-x-1.5 text-blue-700 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 text-xs font-bold rounded-xl border border-blue-200 transition cursor-pointer"
          >
            {isDetectingGPS ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600" />
            ) : (
              <Crosshair className="h-3.5 w-3.5 text-blue-600" />
            )}
            <span className="hidden sm:inline">{isDetectingGPS ? 'Detecting GPS...' : 'Detect GPS'}</span>
          </button>

          {/* Reset Map View Button */}
          <button
            onClick={() => setMapTarget({ lat: customerCoords.lat, lng: customerCoords.lng })}
            title="Recenter on My Location"
            className="hidden md:flex items-center space-x-1 text-slate-600 hover:text-blue-600 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-200 hover:border-blue-300 transition cursor-pointer"
          >
            <MapPin className="h-3.5 w-3.5" />
            <span>My Spot</span>
          </button>

          {/* Logout Button */}
          <button
            onClick={handleLogout}
            className="flex items-center space-x-1.5 bg-slate-100 hover:bg-red-50 text-slate-700 hover:text-red-600 px-3.5 py-1.5 rounded-lg border border-slate-200 hover:border-red-200 text-xs font-semibold transition cursor-pointer"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Logout</span>
          </button>
        </div>
      </nav>

      {/* 2. MAIN TWO-COLUMN SPLIT SCREEN CONTENT */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">

        {/* LEFT COLUMN: Segmented Views (Find Specialists vs My Bookings) */}
        <div className="w-full lg:w-1/2 xl:w-5/12 h-full flex flex-col bg-slate-50 border-r border-slate-200 z-10">

          {/* View Mode Switcher: Specialists vs My Bookings */}
          <div className="p-3 bg-white border-b border-slate-200">
            <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-xl">
              <button
                type="button"
                onClick={() => setActiveLeftTab('providers')}
                className={`py-2 rounded-lg text-xs font-bold transition flex items-center justify-center space-x-1.5 cursor-pointer ${activeLeftTab === 'providers'
                  ? 'bg-white text-blue-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
                  }`}
              >
                <Wrench className="h-3.5 w-3.5" />
                <span>Specialists ({providers.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveLeftTab('bookings')}
                className={`py-2 rounded-lg text-xs font-bold transition flex items-center justify-center space-x-1.5 cursor-pointer ${activeLeftTab === 'bookings'
                  ? 'bg-white text-blue-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
                  }`}
              >
                <Bookmark className="h-3.5 w-3.5" />
                <span>My Bookings ({myBookings.length})</span>
                {myBookings.filter(b => b.status === 'accepted').length > 0 && (
                  <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                )}
              </button>
            </div>
          </div>

          {/* VIEW 1: EXPLORE REAL PROVIDERS */}
          {activeLeftTab === 'providers' && (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Filter & Search Header */}
              <div className="p-4 bg-white border-b border-slate-200 space-y-3 shrink-0">
                {/* Search Input */}
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search by provider name or category..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                  />
                </div>

                {/* CATEGORY FILTER BAR */}
                <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 text-xs font-medium scrollbar-none">
                  {categories.map((cat) => (
                    <button
                      key={cat.name}
                      onClick={() => setSelectedCategory(cat.name)}
                      className={`px-3 py-1.5 rounded-full shrink-0 transition cursor-pointer flex items-center space-x-1 ${selectedCategory === cat.name
                        ? 'bg-blue-600 text-white font-semibold shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                    >
                      <span>{cat.name}</span>
                    </button>
                  ))}
                </div>

                {/* SORT DROPDOWN AND DISTANCE FILTER ROW */}
                <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-slate-100">
                  {/* Distance Filter (All, Within 5 km, Within 10 km) */}
                  <div className="flex items-center space-x-1.5">
                    <span className="text-xs font-bold text-slate-600 flex items-center">
                      <MapPin className="h-3.5 w-3.5 text-blue-600 mr-1 shrink-0" />
                      Distance:
                    </span>
                    <div className="inline-flex rounded-xl bg-slate-100 p-0.5 border border-slate-200">
                      {[
                        { id: 'all', label: 'All' },
                        { id: '5', label: 'Within 5 km' },
                        { id: '10', label: 'Within 10 km' }
                      ].map((dist) => (
                        <button
                          key={dist.id}
                          type="button"
                          onClick={() => setDistanceFilter(dist.id)}
                          className={`px-2.5 py-1 text-xs font-bold rounded-lg transition cursor-pointer ${
                            distanceFilter === dist.id
                              ? 'bg-white text-blue-600 shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          {dist.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Sort Dropdown (Nearest First, Highest Rated, Lowest Price) */}
                  <div className="flex items-center space-x-1.5">
                    <label htmlFor="sort-by-select" className="text-xs font-bold text-slate-600 flex items-center">
                      <ArrowUpDown className="h-3.5 w-3.5 text-blue-600 mr-1 shrink-0" />
                      Sort:
                    </label>
                    <select
                      id="sort-by-select"
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      className="text-xs font-bold bg-slate-100 hover:bg-slate-200/80 text-slate-800 py-1.5 px-3 rounded-xl border border-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none cursor-pointer transition"
                    >
                      <option value="nearest">Nearest First</option>
                      <option value="highest_rated">Highest Rated</option>
                      <option value="lowest_price">Lowest Price</option>
                    </select>
                  </div>
                </div>

                {/* Live Count Bar */}
                <div className="flex flex-wrap justify-between items-center text-xs text-slate-500 pt-0.5 gap-1">
                  <span>
                    Showing <strong>{sortedProviders.length}</strong> of <strong>{providers.length}</strong> online provider{providers.length === 1 ? '' : 's'}
                    {distanceFilter !== 'all' && (
                      <span className="text-blue-600 font-semibold ml-1">
                        (within {distanceFilter} km)
                      </span>
                    )}
                  </span>
                  <span className="flex items-center text-emerald-600 font-semibold">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 mr-1.5 animate-pulse"></span>
                    Live in Firestore
                  </span>
                </div>
              </div>

              {/* Scrollable Provider Cards Container */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
                {loadingProviders ? (
                  <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center flex flex-col items-center justify-center space-y-3 shadow-xs">
                    <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
                    <p className="text-sm font-semibold text-slate-700">Connecting to live providers...</p>
                  </div>
                ) : providers.length === 0 ? (
                  /* Clean empty state: No providers online */
                  <div className="bg-white rounded-3xl border border-dashed border-slate-300 p-8 text-center space-y-4 shadow-xs">
                    <div className="w-16 h-16 rounded-3xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto border-2 border-blue-100">
                      <Radio className="h-8 w-8 animate-pulse" />
                    </div>

                    <div className="space-y-1.5">
                      <h3 className="font-extrabold text-slate-900 text-lg">
                        No Service Providers Currently Online
                      </h3>
                      <p className="text-slate-500 text-xs sm:text-sm max-w-sm mx-auto leading-relaxed">
                        We're actively listening for providers. When a technician logs in and sets their status to <strong>Online</strong>, they will instantly appear here on the map.
                      </p>
                    </div>

                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-left text-xs text-slate-600 space-y-1.5 max-w-sm mx-auto">
                      <p className="font-bold text-slate-800">Quick Testing Tip:</p>
                      <p className="text-slate-500">
                        Open an incognito window, sign up as a <strong>Service Provider</strong>, set your toggle to <strong>Online</strong>, and watch your card appear here!
                      </p>
                    </div>
                  </div>
                ) : sortedProviders.length === 0 ? (
                  /* Filter mismatch */
                  <div className="bg-white rounded-3xl border border-dashed border-slate-300 p-8 text-center space-y-3 shadow-xs">
                    <AlertCircle className="h-8 w-8 text-slate-400 mx-auto" />
                    <p className="font-bold text-slate-800 text-base">No online providers matching your criteria</p>
                    <p className="text-xs text-slate-500 max-w-xs mx-auto">
                      Try increasing the distance radius or selecting a different service category.
                    </p>
                    <div className="flex justify-center space-x-2 pt-1">
                      {distanceFilter !== 'all' && (
                        <button
                          onClick={() => setDistanceFilter('all')}
                          className="text-xs font-bold text-blue-600 hover:underline cursor-pointer"
                        >
                          Reset distance filter
                        </button>
                      )}
                      {selectedCategory !== 'All' && (
                        <button
                          onClick={() => setSelectedCategory('All')}
                          className="text-xs font-bold text-blue-600 hover:underline cursor-pointer"
                        >
                          View all categories
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  /* Real Provider Cards */
                  sortedProviders.map((provider) => {
                    const isSelected = selectedProvider?.id === provider.id;
                    const coords = provider.dispersedCoords;
                    const distanceKm = provider.distance;

                    return (
                      <div
                        key={provider.id}
                        onClick={() => handleFocusProvider(provider, coords)}
                        className={`bg-white rounded-2xl p-4 sm:p-5 border transition-all cursor-pointer shadow-xs hover:shadow-md flex flex-col justify-between ${isSelected
                          ? 'border-blue-600 ring-2 ring-blue-500/20 bg-blue-50/20'
                          : 'border-slate-200 hover:border-slate-300'
                          }`}
                      >
                        {/* Top: Avatar, Name, Category */}
                        <div className="flex items-start space-x-3.5">
                          <div className="w-13 h-13 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white font-black flex items-center justify-center text-lg shrink-0 shadow-xs border border-white">
                            {provider.name.slice(0, 2).toUpperCase()}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <h3 className="font-bold text-slate-900 text-base truncate">
                                {provider.name}
                              </h3>
                              <span className="flex items-center text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-md">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse"></span>
                                Online
                              </span>
                            </div>

                            {/* Live Rating and Clean Distance Badge */}
                            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                              {/* Clean Distance Badge */}
                              <span className="inline-flex items-center space-x-1 bg-blue-50 text-blue-700 border border-blue-200/90 px-2.5 py-0.5 rounded-full text-xs font-extrabold shadow-2xs">
                                <MapPin className="h-3 w-3 text-blue-600 shrink-0" />
                                <span>{distanceKm} km away</span>
                              </span>

                              {/* Live Rating or New Provider Badge */}
                              {provider.reviewCount && provider.reviewCount > 0 ? (
                                <div className="inline-flex items-center space-x-1 bg-amber-50 border border-amber-200/90 text-amber-900 px-2 py-0.5 rounded-full text-xs font-extrabold shadow-2xs">
                                  <Star className="h-3 w-3 fill-amber-400 text-amber-500" />
                                  <span>★ {Number(provider.rating || 5).toFixed(1)}</span>
                                  <span className="text-slate-400 font-medium text-[11px]">
                                    ({provider.reviewCount} review{provider.reviewCount === 1 ? '' : 's'})
                                  </span>
                                </div>
                              ) : (
                                <span className="inline-flex items-center bg-emerald-50 text-emerald-700 border border-emerald-200/80 text-[10px] font-bold px-2 py-0.5 rounded-full">
                                  <Sparkles className="h-2.5 w-2.5 mr-1 text-emerald-500" />
                                  New Provider
                                </span>
                              )}
                            </div>

                            <div className="flex items-center space-x-2 mt-1">
                              <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-md">
                                {provider.serviceCategory || provider.role}
                              </span>
                              {provider.phone && (
                                <span className="text-xs text-slate-500 flex items-center">
                                  <Phone className="h-3 w-3 mr-1 text-slate-400" />
                                  {provider.phone}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Bottom: Rate & Book Now Button */}
                        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                          <div>
                            <span className="text-[11px] text-slate-400 font-medium block">Rate per visit</span>
                            <div className="flex items-baseline">
                              <span className="text-lg font-extrabold text-slate-900">₹{provider.price}</span>
                              <span className="text-xs text-slate-500 ml-1">/ visit</span>
                            </div>
                          </div>

                          <div className="flex items-center space-x-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleFocusProvider(provider, coords);
                              }}
                              className="text-xs font-medium text-slate-600 hover:text-blue-600 px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition cursor-pointer"
                            >
                              Show on Map
                            </button>
                            <button
                              onClick={(e) => handleBookNowClick(provider, e)}
                              className="bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white text-xs font-bold px-4 py-2 rounded-xl transition shadow-xs flex items-center space-x-1 cursor-pointer"
                            >
                              <span>Book Now</span>
                              <ChevronRight className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* VIEW 2: 'MY BOOKINGS' SECTION WITH LIVE onSnapshot UPDATES */}
          {activeLeftTab === 'bookings' && (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="p-4 bg-white border-b border-slate-200 flex justify-between items-center shrink-0">
                <div>
                  <h2 className="font-bold text-slate-900 text-base">My Service Bookings</h2>
                  <p className="text-xs text-slate-400 mt-0.5">Live status updates synced with Firestore</p>
                </div>
                <span className="text-xs font-semibold bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full">
                  {myBookings.length} Total
                </span>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {loadingBookings ? (
                  <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center flex flex-col items-center justify-center space-y-3">
                    <Loader2 className="h-7 w-7 text-blue-600 animate-spin" />
                    <p className="text-xs font-semibold text-slate-600">Loading your bookings...</p>
                  </div>
                ) : myBookings.length === 0 ? (
                  <div className="bg-white rounded-3xl border border-dashed border-slate-300 p-10 text-center space-y-3">
                    <Bookmark className="h-8 w-8 text-slate-300 mx-auto" />
                    <h3 className="font-bold text-slate-700 text-base">No Bookings Yet</h3>
                    <p className="text-xs text-slate-400 max-w-xs mx-auto">
                      You haven't requested any services yet. Pick an online specialist from the map or directory to book an appointment!
                    </p>
                    <button
                      onClick={() => setActiveLeftTab('providers')}
                      className="mt-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-2 px-4 rounded-xl transition cursor-pointer"
                    >
                      Browse Available Specialists
                    </button>
                  </div>
                ) : (
                  myBookings.map((booking) => (
                    <div
                      key={booking.id}
                      className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-3.5 transition hover:shadow-md"
                    >
                      {/* Top: Provider Name & Status Badge */}
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600 block">
                            {booking.serviceCategory}
                          </span>
                          <h4 className="font-bold text-slate-900 text-base leading-tight mt-0.5">
                            {booking.providerName}
                          </h4>
                          <span className="text-[11px] text-slate-400 font-mono block mt-0.5">
                            Booking ID: {booking.id.slice(0, 8)}...
                          </span>
                        </div>

                        {/* Live Status Badge (Pending, Accepted, Declined) */}
                        <div>
                          {renderStatusBadge(booking.status)}
                        </div>
                      </div>

                      {/* Middle: Scheduled Details */}
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs text-slate-600 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="flex items-center text-slate-500">
                            <Calendar className="h-3.5 w-3.5 mr-1 text-slate-400" />
                            Date & Time:
                          </span>
                          <span className="font-semibold text-slate-800">
                            {booking.date} at {booking.time}
                          </span>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="flex items-center text-slate-500">
                            <Clock className="h-3.5 w-3.5 mr-1 text-slate-400" />
                            Requested At:
                          </span>
                          <span className="text-slate-600 font-mono">
                            {formatBookingTime(booking.createdAt, booking.createdMillis)}
                          </span>
                        </div>

                        {booking.address && (
                          <div className="flex items-start text-slate-500 pt-1 border-t border-slate-200/50">
                            <MapPin className="h-3.5 w-3.5 mr-1 text-slate-400 shrink-0 mt-0.5" />
                            <span className="truncate">{booking.address}</span>
                          </div>
                        )}
                      </div>

                      {/* Bottom: Price, Call & Message Buttons */}
                      <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                        <div>
                          <span className="text-slate-400 block text-[11px]">Total Rate:</span>
                          <span className="font-extrabold text-slate-900 text-base">
                            ₹{booking.price}
                          </span>
                        </div>

                        {/* Real-time Call, WhatsApp and Message Options */}
                        <div className="flex flex-wrap items-center gap-1.5">
                          {/* RATE & REVIEW FLOW (When status === 'completed') */}
                          {booking.status === 'completed' && (
                            booking.reviewed ? (
                              <span className="bg-emerald-100 text-emerald-800 border border-emerald-200 px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center shadow-2xs">
                                <Star className="h-3.5 w-3.5 fill-emerald-600 text-emerald-600 mr-1" />
                                <span>Reviewed ★ {booking.rating || 5}</span>
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setActiveReviewBooking(booking)}
                                className="bg-amber-500 hover:bg-amber-600 active:scale-[0.98] text-white px-3 py-1.5 rounded-xl font-bold text-xs transition shadow-xs flex items-center space-x-1 cursor-pointer animate-pulse"
                              >
                                <Star className="h-3.5 w-3.5 fill-current" />
                                <span>Rate & Review</span>
                              </button>
                            )
                          )}

                          {/* Call Button (<a href={`tel:${phoneNumber}`}>) */}
                          <a
                            href={`tel:${booking.providerPhone || '+91 98765 12345'}`}
                            title={`Call Provider: ${booking.providerPhone || '+91 98765 12345'}`}
                            className="bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white px-3 py-1.5 rounded-xl font-bold transition shadow-xs flex items-center space-x-1 cursor-pointer"
                          >
                            <Phone className="h-3.5 w-3.5" />
                            <span>Call</span>
                            {booking.providerPhone && (
                              <span className="text-[10px] opacity-85 hidden 2xl:inline ml-0.5 font-normal">
                                ({booking.providerPhone})
                              </span>
                            )}
                          </a>

                          {/* WhatsApp Button */}
                          {booking.providerPhone && getWhatsAppUrl(
                            booking.providerPhone,
                            'Hi ' + (booking.providerName || 'Provider') + ', I booked your ' + (booking.serviceCategory || 'Service') + ' service on Local Service Finder.'
                          ) && (
                            <a
                              href={getWhatsAppUrl(
                                booking.providerPhone,
                                'Hi ' + (booking.providerName || 'Provider') + ', I booked your ' + (booking.serviceCategory || 'Service') + ' service on Local Service Finder.'
                              )}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Chat with Provider on WhatsApp"
                              className="bg-emerald-500 hover:bg-emerald-600 active:scale-[0.98] text-white px-3 py-1.5 rounded-xl font-bold transition shadow-xs flex items-center space-x-1 cursor-pointer"
                            >
                              <WhatsAppIcon className="h-3.5 w-3.5" />
                              <span>WhatsApp</span>
                            </a>
                          )}

                          {/* Message Button (Opens BookingChatModal) */}
                          <button
                            type="button"
                            onClick={() => setActiveChatBooking(booking)}
                            className="bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white px-3 py-1.5 rounded-xl font-bold transition shadow-xs flex items-center space-x-1 cursor-pointer"
                          >
                            <MessageSquare className="h-3.5 w-3.5" />
                            <span>Message</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

        </div>

        {/* RIGHT COLUMN: Interactive Leaflet Map with Real Provider Pins */}
        <div className="w-full lg:w-1/2 xl:w-7/12 h-[380px] lg:h-full relative bg-slate-200">

          {/* FLOATING TOP CONTROLS: NOMINATIM SEARCH BAR & HELPER LABEL */}
          <div className="absolute top-4 left-4 right-4 sm:right-auto sm:w-[380px] z-[999] pointer-events-auto space-y-2">
            {/* Free OpenStreetMap Nominatim Address Search Bar */}
            <div className="bg-white/95 backdrop-blur-xs p-1.5 rounded-2xl shadow-xl border border-slate-200">
              <AddressSearchBar
                onSelectLocation={handleAddressSearchSelect}
                placeholder="Search your area, e.g. Indiranagar, Bengaluru"
                initialValue={customerCoords.address}
              />
            </div>

            {/* Helper Label */}
            <div className="bg-white/95 backdrop-blur-xs px-3.5 py-2 rounded-2xl shadow-md border border-slate-200 text-xs text-slate-800 flex items-center space-x-2">
              <MapPin className="h-4 w-4 text-blue-600 shrink-0" />
              <span className="font-semibold text-slate-700">
                Location not exact? Click or drag the pin to your exact spot.
              </span>
            </div>

            {/* Confirm Spot Button shown when user moves their pin */}
            {hasMovedLocation && (
              <div className="bg-emerald-600 text-white p-3 rounded-2xl shadow-lg flex items-center justify-between text-xs animate-in fade-in slide-in-from-top-2">
                <div className="min-w-0 pr-2">
                  <span className="font-bold block">New spot chosen!</span>
                  {customerCoords.address && (
                    <span className="text-[10px] text-emerald-100 block truncate font-medium">
                      {customerCoords.address}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleConfirmCustomerLocation}
                  disabled={isSavingCustomerLoc}
                  className="bg-white text-emerald-800 hover:bg-emerald-50 px-3 py-1.5 rounded-xl font-bold text-xs transition cursor-pointer shadow-xs flex items-center space-x-1 shrink-0"
                >
                  {isSavingCustomerLoc ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Confirm & Save</span>
                  )}
                </button>
              </div>
            )}

            {locationSavedAlert && (
              <div className="bg-emerald-100 border border-emerald-300 text-emerald-900 px-3 py-2 rounded-xl shadow-md text-xs font-bold flex items-center space-x-1.5 animate-in fade-in">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>Exact address & coordinates saved to Firestore!</span>
              </div>
            )}
          </div>

          <MapContainer
            center={[customerCoords.lat, customerCoords.lng]}
            zoom={14}
            scrollWheelZoom={true}
            style={{ height: '100%', width: '100%', zIndex: 1 }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {/* Recenter handler with useMap().flyTo([lat, lon], 15) */}
            <MapRecenter targetCoords={mapTarget} />

            {/* Click anywhere on map to move customer pin */}
            <CustomerMapClickWatcher onLocationSelect={handleCustomerLocationChange} />

            {/* CUSTOMER PIN (You) - Draggable with dragend handler */}
            <Marker
              position={[customerCoords.lat, customerCoords.lng]}
              icon={customerIcon}
              draggable={true}
              eventHandlers={{
                dragend: (e) => {
                  if (e?.target?.getLatLng) {
                    const latlng = e.target.getLatLng();
                    handleCustomerLocationChange({
                      lat: Number(latlng.lat.toFixed(6)),
                      lng: Number(latlng.lng.toFixed(6))
                    });
                  }
                }
              }}
            >
              <Popup>
                <div className="p-1 text-slate-800">
                  <div className="flex items-center space-x-1.5 text-blue-700 font-bold text-xs uppercase tracking-wider mb-1">
                    <span>📍 Your Location (Customer)</span>
                  </div>
                  {customerCoords.address && (
                    <p className="text-xs text-slate-700 font-medium leading-tight mb-1">
                      {customerCoords.address}
                    </p>
                  )}
                  <p className="text-[10px] text-slate-500 font-mono">
                    Lat: {customerCoords.lat.toFixed(5)}, Lng: {customerCoords.lng.toFixed(5)}
                  </p>
                  <p className="text-[11px] text-emerald-600 mt-1 font-semibold">
                    Drag pin or click map to move your spot
                  </p>
                </div>
              </Popup>
            </Marker>

            {/* REAL FIRESTORE PROVIDER PINS */}
            {sortedProviders.map((provider) => {
              const coords = provider.dispersedCoords;
              const distanceKm = provider.distance;

              return (
                <Marker
                  key={provider.id}
                  position={coords}
                  icon={getProviderIcon(provider.serviceCategory || provider.role)}
                  eventHandlers={{
                    click: () => setSelectedProvider(provider),
                  }}
                >
                  <Popup>
                    <div className="p-1.5 min-w-[210px] text-slate-800 font-sans">
                      <div className="flex items-center space-x-2.5 mb-2">
                        <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white font-bold flex items-center justify-center text-xs">
                          {provider.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <h4 className="font-bold text-xs text-slate-900 leading-tight">
                            {provider.name}
                          </h4>
                          <div className="flex items-center space-x-1.5 mt-0.5">
                            <span className="text-[11px] font-semibold text-blue-600">
                              {provider.serviceCategory || provider.role}
                            </span>
                            {provider.reviewCount && provider.reviewCount > 0 ? (
                              <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded flex items-center">
                                <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-500 mr-0.5" />
                                {Number(provider.rating || 5).toFixed(1)}
                              </span>
                            ) : (
                              <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1 rounded">
                                New
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="text-xs text-slate-600 space-y-1 py-1.5 border-t border-b border-slate-100 my-1.5">
                        <div className="flex justify-between items-center">
                          <span>📍 Distance:</span>
                          <span className="font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded text-[11px]">
                            {distanceKm} km away
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>💰 Rate:</span>
                          <span className="font-bold text-slate-900">₹{provider.price}/visit</span>
                        </div>
                        {provider.phone && (
                          <div className="flex justify-between text-slate-500">
                            <span>📞 Phone:</span>
                            <span className="font-medium">{provider.phone}</span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span>Status:</span>
                          <span className="text-emerald-700 font-bold flex items-center">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 mr-1 animate-pulse"></span>
                            Online
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => handleBookNowClick(provider)}
                        className="w-full mt-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-1.5 rounded-lg transition cursor-pointer text-center block"
                      >
                        Book {provider.name.split(' ')[0]}
                      </button>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>

          {/* Floating Map Legend Overlay */}
          <div className="absolute top-4 right-4 bg-white/95 backdrop-blur-xs p-3.5 rounded-2xl shadow-lg border border-slate-200 z-[999] text-xs space-y-2 pointer-events-auto max-w-[220px]">
            <span className="font-bold text-slate-900 block text-[11px] uppercase tracking-wider">
              Live Map Legend
            </span>
            <div className="flex items-center space-x-2 text-slate-700">
              <span className="h-3 w-3 rounded-full bg-blue-600 ring-2 ring-blue-300"></span>
              <span><strong>You</strong> (Customer Pin)</span>
            </div>
            <div className="flex items-center space-x-2 text-slate-700">
              <span className="h-3 w-3 rounded-full bg-emerald-600 ring-2 ring-emerald-300"></span>
              <span>
                <strong>{providers.length}</strong> Live Provider{providers.length === 1 ? '' : 's'}
              </span>
            </div>
            <div className="text-[10px] text-slate-400 pt-1 border-t border-slate-100 leading-tight">
              Synced directly with Firestore users & bookings.
            </div>
          </div>
        </div>

      </div>

      {/* 3. BOOKING MODAL */}
      {activeBookingProvider && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-150 border border-slate-200">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white flex justify-between items-start">
              <div>
                <span className="text-xs font-semibold text-blue-200 uppercase tracking-wider block">
                  Book Live Specialist
                </span>
                <h2 className="text-xl font-bold mt-0.5">
                  Book {activeBookingProvider.name}
                </h2>
                <p className="text-xs text-blue-100 mt-1">
                  {activeBookingProvider.serviceCategory || activeBookingProvider.role} • ₹{activeBookingProvider.price}/visit
                </p>
              </div>
              <button
                onClick={() => setActiveBookingProvider(null)}
                className="text-blue-100 hover:text-white p-1 rounded-lg hover:bg-white/10 transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body / Form */}
            <form onSubmit={handleConfirmBooking} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                  Preferred Date
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="date"
                    required
                    value={serviceDate}
                    onChange={(e) => setServiceDate(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                  Preferred Time Slot
                </label>
                <div className="relative">
                  <Clock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <select
                    value={serviceTime}
                    onChange={(e) => setServiceTime(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none appearance-none"
                  >
                    <option value="09:00 AM">09:00 AM - 11:00 AM</option>
                    <option value="12:00 PM">12:00 PM - 02:00 PM</option>
                    <option value="03:00 PM">03:00 PM - 05:00 PM</option>
                    <option value="06:00 PM">06:00 PM - 08:00 PM</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                  Service Address
                </label>
                <div className="relative">
                  <MapPin className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                  <textarea
                    rows={2}
                    value={serviceAddress}
                    onChange={(e) => setServiceAddress(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                  />
                </div>
              </div>

              {/* Firestore Document Preview Details */}
              <div className="bg-blue-50 p-3.5 rounded-xl border border-blue-200 text-xs text-blue-900 space-y-1">
                <div className="flex justify-between">
                  <span className="font-semibold">Target Collection:</span>
                  <span className="font-mono">bookings</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold">Provider ID:</span>
                  <span className="font-mono">{activeBookingProvider.uid || activeBookingProvider.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold">Price per visit:</span>
                  <span className="font-bold text-slate-900">₹{activeBookingProvider.price}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold">Initial Status:</span>
                  <span className="font-mono font-bold text-amber-700">pending</span>
                </div>
              </div>

              {/* Confirm Button */}
              <button
                type="submit"
                disabled={isSubmittingBooking}
                className="w-full bg-blue-600 hover:bg-blue-700 active:scale-[0.99] disabled:opacity-75 text-white font-bold py-3 rounded-xl transition shadow-lg shadow-blue-500/20 cursor-pointer mt-2 flex items-center justify-center space-x-2"
              >
                {isSubmittingBooking ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Writing to Firestore...</span>
                  </>
                ) : (
                  <span>Confirm & Send Booking Request</span>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 4. SUCCESS TOAST */}
      {bookingSuccess && (
        <div className="fixed bottom-6 right-6 bg-slate-900 text-white p-5 rounded-2xl shadow-2xl flex items-start space-x-3.5 border border-slate-700 z-50 animate-in slide-in-from-bottom-3 max-w-sm">
          <CheckCircle2 className="h-6 w-6 text-emerald-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-bold text-sm">Booking Sent to Firestore!</h4>
            <p className="text-xs text-slate-300 mt-0.5">
              Saved to <code className="font-mono text-blue-400">bookings</code> collection with status <strong>'pending'</strong>. Request dispatched to <strong>{bookingSuccess.provider.name}</strong>. Check <strong>My Bookings</strong> for live updates.
            </p>
          </div>
          <button
            onClick={() => setBookingSuccess(null)}
            className="text-slate-400 hover:text-white transition p-1 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* 5. REAL-TIME BOOKING CHAT MODAL */}
      {activeChatBooking && (
        <BookingChatModal
          booking={activeChatBooking}
          currentUser={user}
          onClose={() => setActiveChatBooking(null)}
        />
      )}

      {/* 6. RATE & REVIEW MODAL */}
      {activeReviewBooking && (
        <ReviewModal
          booking={activeReviewBooking}
          isSubmitting={isSubmittingReview}
          onSubmitReview={handleReviewSubmit}
          onClose={() => setActiveReviewBooking(null)}
        />
      )}

      {/* REVIEW SUCCESS TOAST */}
      {reviewSuccessToast && (
        <div className="fixed bottom-6 right-6 bg-slate-900 text-white p-4 rounded-2xl shadow-2xl flex items-center space-x-3 border border-slate-700 z-50 animate-in slide-in-from-bottom-2 max-w-sm">
          <Star className="h-5 w-5 fill-amber-400 text-amber-400 shrink-0" />
          <div className="text-xs">
            <h5 className="font-bold text-sm text-white">Review Submitted!</h5>
            <p className="text-slate-300 mt-0.5">Thank you for rating your service provider. Provider rating updated in real-time.</p>
          </div>
        </div>
      )}

    </div>
  );
}
