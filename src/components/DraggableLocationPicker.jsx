import React, { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { MapPin, Check, Crosshair, Loader2 } from 'lucide-react';

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

// Map Auto Fly-To Center
function MapFlyToCenter({ coords }) {
  const map = useMap();
  useEffect(() => {
    if (coords?.lat && coords?.lng) {
      map.flyTo([coords.lat, coords.lng], map.getZoom() || 14, { duration: 0.8 });
    }
  }, [coords?.lat, coords?.lng, map]);
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
  onChange,
  onConfirm,
  isSaving = false,
  showConfirmButton = false,
  confirmButtonText = 'Confirm & Save Location',
  helperText = 'Location not exact? Click or drag the pin to your exact spot.',
  role = 'provider',
  height = '220px',
  onDetectCurrentLocation,
  isDetecting = false
}) {
  const markerIcon = role === 'customer' ? customerPinIcon : providerPinIcon;

  // Handle DragEnd on Marker
  const handleMarkerDragEnd = (e) => {
    if (e?.target?.getLatLng) {
      const latlng = e.target.getLatLng();
      const updated = {
        lat: Number(latlng.lat.toFixed(6)),
        lng: Number(latlng.lng.toFixed(6))
      };
      if (onChange) {
        onChange(updated);
      }
    }
  };

  // Handle Map Click
  const handleMapClick = (latlng) => {
    if (onChange) {
      onChange(latlng);
    }
  };

  return (
    <div className="w-full space-y-2">
      {/* 1. REQUIRED HELPER LABEL */}
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
            <span>{isDetecting ? 'Locating...' : 'GPS Detect'}</span>
          </button>
        )}
      </div>

      {/* 2. INTERACTIVE REACT-LEAFLET MAP */}
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
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <MapInvalidateSize />
          <MapFlyToCenter coords={coords} />
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
                <span className="font-bold text-slate-800 block">Your Chosen Spot</span>
                <span className="text-[10px] text-slate-500 font-mono">
                  {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
                </span>
                <span className="text-[10px] text-emerald-600 block mt-0.5">
                  Drag or click map to move
                </span>
              </div>
            </Popup>
          </Marker>
        </MapContainer>

        {/* Small Coordinates Overlay Pill */}
        <div className="absolute bottom-2 left-2 z-[400] bg-white/90 backdrop-blur-xs px-2.5 py-1 rounded-lg border border-slate-200 text-[10px] font-mono font-medium text-slate-700 shadow-xs pointer-events-none">
          Lat: {coords.lat.toFixed(5)}, Lng: {coords.lng.toFixed(5)}
        </div>
      </div>

      {/* 3. OPTIONAL CONFIRMATION BUTTON */}
      {showConfirmButton && onConfirm && (
        <button
          type="button"
          onClick={() => onConfirm(coords)}
          disabled={isSaving}
          className="w-full bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] disabled:opacity-70 text-white text-xs font-bold py-2.5 px-4 rounded-xl transition shadow-xs flex items-center justify-center space-x-1.5 cursor-pointer"
        >
          {isSaving ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>Saving to Firestore...</span>
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
