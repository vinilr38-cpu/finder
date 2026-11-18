import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { MapPin, Check, Crosshair, Loader2 } from 'lucide-react';
import AddressSearchBar from './AddressSearchBar';

// Custom Pin Icon for Customer (Blue)
const customerPinIcon = L.divIcon({
  className: 'custom-customer-drag-pin',
  html: `
    <div style="position: relative; display: flex; align-items: center; justify-content: center; cursor: grab;">
      <div style="position: absolute; width: 34px; height: 34px; background-color: rgba(37, 99, 235, 0.35); border-radius: 9999px; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
      <div style="background-color: #2563eb; color: white; width: 32px; height: 32px; border-radius: 9999px; display: flex; align-items: center; justify-content: center; font-size: 15px; border: 2.5px solid white; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.3);">
        📍
      </div>
    </div>
  `,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
  popupAnchor: [0, -16],
});

// Custom Pin Icon for Provider (Emerald Green)
const providerPinIcon = L.divIcon({
  className: 'custom-provider-drag-pin',
  html: `
    <div style="position: relative; display: flex; align-items: center; justify-content: center; cursor: grab;">
      <div style="position: absolute; width: 34px; height: 34px; background-color: rgba(16, 185, 129, 0.35); border-radius: 9999px; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
      <div style="background-color: #059669; color: white; width: 32px; height: 32px; border-radius: 9999px; display: flex; align-items: center; justify-content: center; font-size: 15px; border: 2.5px solid white; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.3);">
        📍
      </div>
    </div>
  `,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
  popupAnchor: [0, -16],
});

// Map Click Listener Component
function MapClickWatcher({ onLocationSelect }) {
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

// Smoothly pan/zoom to coordinates using useMap().flyTo([lat, lon], 15)
function MapFlyToSmooth({ target }) {
  const map = useMap();
  useEffect(() => {
    if (target?.lat && target?.lng) {
      map.flyTo([target.lat, target.lng], 15, {
        duration: 1.4,
        easeLinearity: 0.25
      });
    }
  }, [target?.lat, target?.lng, map]);
  return null;
}

// Invalidate Leaflet Size to prevent gray tile artifacts
function MapInvalidateSize() {
  const map = useMap();
  useEffect(() => {
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 250);
    return () => clearTimeout(timer);
  }, [map]);
  return null;
}

export default function DraggableLocationPicker({
  coords = { lat: 17.385044, lng: 78.486671 },
  address = '',
  onChange,
  onConfirm,
  isSaving = false,
  showConfirmButton = false,
  confirmButtonText = 'Save Location',
  helperText = 'Click or drag the pin to adjust location.',
  role = 'provider',
  height = '220px',
  onDetectCurrentLocation,
  isDetecting = false,
  showSearchBar = true,
  searchPlaceholder = 'Search your area, e.g. Indiranagar, Bengaluru'
}) {
  const [flyTarget, setFlyTarget] = useState(null);
  const [currentAddress, setCurrentAddress] = useState(address);

  useEffect(() => {
    if (address) {
      setCurrentAddress(address);
    }
  }, [address]);

  const markerIcon = role === 'customer' ? customerPinIcon : providerPinIcon;

  // Handle DragEnd on Marker
  const handleMarkerDragEnd = (e) => {
    if (e?.target?.getLatLng) {
      const latlng = e.target.getLatLng();
      const updated = {
        lat: Number(latlng.lat.toFixed(6)),
        lng: Number(latlng.lng.toFixed(6)),
        address: currentAddress
      };
      if (onChange) {
        onChange(updated);
      }
    }
  };

  // Handle Map Click
  const handleMapClick = (latlng) => {
    const updated = {
      lat: latlng.lat,
      lng: latlng.lng,
      address: currentAddress
    };
    if (onChange) {
      onChange(updated);
    }
  };

  // Handle Nominatim Address Selection
  const handleAddressSelect = ({ lat, lng, address: selectedAddress }) => {
    const updated = {
      lat,
      lng,
      address: selectedAddress
    };
    setCurrentAddress(selectedAddress);
    setFlyTarget({ lat, lng });
    if (onChange) {
      onChange(updated);
    }
  };

  return (
    <div className="w-full space-y-2.5">
      {/* 1. NOMINATIM FREE ADDRESS SEARCH BAR */}
      {showSearchBar && (
        <div>
          <AddressSearchBar
            onSelectLocation={handleAddressSelect}
            placeholder={searchPlaceholder}
            initialValue={currentAddress}
          />
        </div>
      )}

      {/* 2. REQUIRED HELPER LABEL */}
      <div className="bg-amber-50 border border-amber-200/80 rounded-xl px-3 py-2 flex items-center justify-between text-amber-900 shadow-2xs">
        <div className="flex items-center space-x-2 text-xs font-semibold">
          <MapPin className="h-4 w-4 text-amber-600 shrink-0" />
          <span>{helperText}</span>
        </div>

        {onDetectCurrentLocation && (
          <button
            type="button"
            onClick={onDetectCurrentLocation}
            disabled={isDetecting}
            className="text-[11px] font-bold text-amber-800 hover:text-amber-950 underline flex items-center space-x-1 cursor-pointer shrink-0 ml-2"
          >
            <Crosshair className={`h-3 w-3 ${isDetecting ? 'animate-spin' : ''}`} />
            <span>{isDetecting ? 'Locating...' : 'Use current location'}</span>
          </button>
        )}
      </div>

      {/* 3. INTERACTIVE MAP */}
      <div 
        className="w-full rounded-2xl overflow-hidden border border-slate-300 relative shadow-inner z-0"
        style={{ height }}
      >
        <MapContainer
          center={[coords.lat || 17.385044, coords.lng || 78.486671]}
          zoom={14}
          scrollWheelZoom={true}
          style={{ height: '100%', width: '100%' }}
        >
          {/* OpenStreetMap Attribution */}
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <MapInvalidateSize />
          <MapFlyToSmooth target={flyTarget || coords} />
          <MapClickWatcher onLocationSelect={handleMapClick} />

          {/* DRAGGABLE USER MARKER */}
          <Marker
            draggable={true}
            eventHandlers={{
              dragend: handleMarkerDragEnd,
            }}
            position={[coords.lat || 17.385044, coords.lng || 78.486671]}
            icon={markerIcon}
          >
            <Popup>
              <div className="p-1 text-center font-sans text-xs">
                <span className="font-bold text-slate-800 block">Selected Location</span>
                {currentAddress && (
                  <p className="text-[11px] text-slate-600 leading-tight mb-1 line-clamp-2">
                    {currentAddress}
                  </p>
                )}
                <span className="text-[10px] text-emerald-600 block mt-0.5 font-semibold">
                  Drag pin or click map to move
                </span>
              </div>
            </Popup>
          </Marker>
        </MapContainer>
      </div>

      {/* Selected Address Display Card */}
      {currentAddress && (
        <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-xl flex items-start space-x-2 text-xs text-slate-700">
          <MapPin className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Location:</span>
            <span className="font-medium text-slate-800 line-clamp-2 leading-snug">{currentAddress}</span>
          </div>
        </div>
      )}

      {/* 4. OPTIONAL CONFIRMATION BUTTON */}
      {showConfirmButton && onConfirm && (
        <button
          type="button"
          onClick={() => onConfirm({ ...coords, address: currentAddress })}
          disabled={isSaving}
          className="w-full bg-blue-600 hover:bg-blue-700 active:scale-[0.99] disabled:opacity-70 text-white text-xs font-bold py-2.5 px-4 rounded-xl transition shadow-xs flex items-center justify-center space-x-1.5 cursor-pointer"
        >
          {isSaving ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>Saving...</span>
            </>
          ) : (
            <>
              <Check className="h-3.5 w-3.5" />
              <span>{confirmButtonText}</span>
            </>
          )}
        </button>
      )}
    </div>
  );
}
