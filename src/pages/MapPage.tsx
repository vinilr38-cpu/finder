import { useState } from 'react';
import { GoogleMap, useJsApiLoader, MarkerF, InfoWindowF } from '@react-google-maps/api';
import { MapPin, Star, Key } from 'lucide-react';
import { MOCK_WORKERS } from './LocalServiceFinder';
import type { Worker } from '../types';

const mapContainerStyle = {
  width: '100%',
  height: '520px',
  borderRadius: '1rem',
};

const defaultCenter = {
  lat: 17.385044,
  lng: 78.486671,
};

export default function MapPage() {
  const envKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
  const [apiKey, setApiKey] = useState(envKey);
  const [tempKey, setTempKey] = useState('');
  const [selectedWorker, setSelectedWorker] = useState<Worker | null>(null);

  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: apiKey,
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl shadow-xs border border-gray-200">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center">
              <MapPin className="h-6 w-6 text-blue-600 mr-2" />
              Live Service Map
            </h1>
            <p className="text-gray-500 text-sm mt-1">
              Find and track active service technicians in your vicinity powered by @react-google-maps/api
            </p>
          </div>

          {!apiKey && (
            <div className="flex items-center space-x-2 w-full md:w-auto">
              <div className="relative flex-grow md:w-64">
                <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Enter Google Maps API Key"
                  value={tempKey}
                  onChange={(e) => setTempKey(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <button
                onClick={() => setApiKey(tempKey)}
                className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition cursor-pointer"
              >
                Load Map
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Map Container */}
      <div className="bg-white p-4 rounded-2xl shadow-xs border border-gray-200 overflow-hidden">
        {apiKey && isLoaded && !loadError ? (
          <GoogleMap
            mapContainerStyle={mapContainerStyle}
            center={defaultCenter}
            zoom={13}
            options={{
              disableDefaultUI: false,
              zoomControl: true,
              streetViewControl: false,
            }}
          >
            {MOCK_WORKERS.map((worker) => (
              <MarkerF
                key={worker.id}
                position={{ lat: worker.lat || defaultCenter.lat, lng: worker.lng || defaultCenter.lng }}
                onClick={() => setSelectedWorker(worker)}
                title={worker.name}
              />
            ))}

            {selectedWorker && (
              <InfoWindowF
                position={{
                  lat: selectedWorker.lat || defaultCenter.lat,
                  lng: selectedWorker.lng || defaultCenter.lng,
                }}
                onCloseClick={() => setSelectedWorker(null)}
              >
                <div className="p-2 max-w-xs text-gray-800">
                  <div className="flex items-center space-x-2 mb-2">
                    <img src={selectedWorker.img} alt="" className="w-8 h-8 rounded-full" />
                    <div>
                      <h4 className="font-bold text-sm text-gray-900">{selectedWorker.name}</h4>
                      <p className="text-xs text-blue-600 font-medium">{selectedWorker.role}</p>
                    </div>
                  </div>
                  <div className="text-xs text-gray-600 flex justify-between pt-1 border-t border-gray-200">
                    <span>⭐ {selectedWorker.rating}</span>
                    <span className="font-semibold text-gray-900">₹{selectedWorker.price}/hr</span>
                  </div>
                </div>
              </InfoWindowF>
            )}
          </GoogleMap>
        ) : (
          <div className="min-h-[460px] flex flex-col items-center justify-center bg-gray-50 rounded-xl border border-dashed border-gray-300 p-8 text-center">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 mb-4">
              <MapPin className="h-8 w-8" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">
              {loadError ? 'Map Load Error' : 'Google Maps Integration Ready'}
            </h3>
            <p className="text-gray-500 text-sm max-w-md mb-6">
              {loadError
                ? 'Could not connect with the provided Google Maps key. Check the key and console.'
                : 'Enter a valid Google Maps API Key above or set VITE_GOOGLE_MAPS_API_KEY in your .env file to enable the live interactive map layer.'}
            </p>

            <div className="w-full max-w-2xl bg-white p-4 rounded-xl border border-gray-200 text-left shadow-xs">
              <h4 className="text-sm font-semibold text-gray-700 mb-3">Nearby Professionals (Coordinates Ready):</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {MOCK_WORKERS.slice(0, 4).map((worker) => (
                  <div key={worker.id} className="p-3 bg-gray-50 rounded-lg flex items-center justify-between text-sm">
                    <div>
                      <p className="font-semibold text-gray-800">{worker.name}</p>
                      <p className="text-xs text-gray-500">{worker.role} • {worker.distance} km</p>
                    </div>
                    <span className="text-xs text-blue-600 font-mono">
                      {worker.lat?.toFixed(4)}, {worker.lng?.toFixed(4)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Technicians List */}
      <div className="bg-white p-6 rounded-2xl shadow-xs border border-gray-200">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Nearby Active Technicians</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {MOCK_WORKERS.map((worker) => (
            <div key={worker.id} className="p-4 border border-gray-100 rounded-xl hover:shadow-xs transition bg-gray-50/50">
              <div className="flex items-center space-x-3 mb-2">
                <img src={worker.img} alt="" className="w-10 h-10 rounded-full object-cover" />
                <div>
                  <h4 className="font-semibold text-gray-900 text-sm">{worker.name}</h4>
                  <p className="text-xs text-blue-600 font-medium">{worker.role}</p>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs text-gray-600 mt-3 pt-2 border-t border-gray-200">
                <span className="flex items-center">
                  <Star className="h-3 w-3 text-yellow-400 fill-current mr-1" />
                  {worker.rating} ({worker.jobs} jobs)
                </span>
                <span className="font-semibold text-gray-900">₹{worker.price}/hr</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
