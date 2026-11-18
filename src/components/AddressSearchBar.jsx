import React, { useState, useRef, useEffect } from 'react';
import { Search, Loader2, MapPin, X, AlertCircle } from 'lucide-react';

export default function AddressSearchBar({
  onSelectLocation,
  placeholder = 'Search your area, e.g. Indiranagar, Bengaluru',
  initialValue = '',
  className = ''
}) {
  const [query, setQuery] = useState(initialValue);
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState(null);
  const [isOpen, setIsOpen] = useState(false);

  const containerRef = useRef(null);

  // Sync initial value if changed
  useEffect(() => {
    if (initialValue && !query) {
      setQuery(initialValue);
    }
  }, [initialValue]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch from OpenStreetMap Nominatim Search API
  // Only called when the user clicks Search or presses Enter (not on every keystroke)
  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;

    setIsLoading(true);
    setError(null);
    setHasSearched(true);
    setIsOpen(true);

    try {
      const endpoint = `https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(trimmed)}`;
      const res = await fetch(endpoint, {
        headers: {
          Accept: 'application/json',
        },
      });

      if (!res.ok) {
        throw new Error(`Nominatim error (${res.status})`);
      }

      const data = await res.json();
      setResults(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Nominatim search failed:', err);
      setError('Unable to load locations. Please check your internet connection and retry.');
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelect = (item) => {
    const lat = parseFloat(item.lat);
    const lon = parseFloat(item.lon);

    if (!isNaN(lat) && !isNaN(lon)) {
      onSelectLocation({
        lat,
        lng: lon,
        address: item.display_name,
        raw: item,
      });

      setQuery(item.display_name);
      setIsOpen(false);
      setResults([]);
      setHasSearched(false);
    }
  };

  const handleClear = () => {
    setQuery('');
    setResults([]);
    setHasSearched(false);
    setIsOpen(false);
    setError(null);
  };

  return (
    <div ref={containerRef} className={`relative w-full z-30 ${className}`}>
      {/* Search Input Form */}
      <form onSubmit={handleSearch} className="flex items-center gap-1.5 w-full">
        <div className="relative flex-1">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
            <Search className="h-4 w-4" />
          </div>

          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (!e.target.value) {
                setIsOpen(false);
                setHasSearched(false);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleSearch(e);
              }
            }}
            placeholder={placeholder}
            className="w-full pl-9 pr-8 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none shadow-2xs transition text-slate-800 placeholder:text-slate-400"
          />

          {query && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <button
          type="submit"
          disabled={isLoading || !query.trim()}
          className="bg-blue-600 hover:bg-blue-700 active:scale-[0.98] disabled:opacity-60 text-white text-xs font-bold px-3.5 py-2.5 rounded-xl transition shadow-xs flex items-center space-x-1.5 cursor-pointer shrink-0"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>Searching...</span>
            </>
          ) : (
            <>
              <Search className="h-3.5 w-3.5" />
              <span>Search</span>
            </>
          )}
        </button>
      </form>

      {/* DROPDOWN RESULTS MENU */}
      {isOpen && (
        <div className="absolute left-0 right-0 mt-1.5 bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden z-[1000] animate-in fade-in slide-in-from-top-1 duration-150">
          {isLoading ? (
            <div className="p-4 text-center text-xs text-slate-500 flex items-center justify-center space-x-2">
              <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
              <span>Searching locations...</span>
            </div>
          ) : error ? (
            <div className="p-3 text-xs text-red-600 flex items-center space-x-2 bg-red-50">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
              <span>{error}</span>
            </div>
          ) : results.length > 0 ? (
            <div className="py-1 max-h-60 overflow-y-auto divide-y divide-slate-100">
              <div className="px-3 py-1.5 bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex justify-between">
                <span>Matching locations</span>
                <span>Select to update</span>
              </div>
              {results.slice(0, 5).map((item, idx) => (
                <button
                  key={item.place_id || idx}
                  type="button"
                  onClick={() => handleSelect(item)}
                  className="w-full text-left px-3.5 py-2.5 text-xs hover:bg-blue-50/80 transition flex items-start space-x-2.5 cursor-pointer group"
                >
                  <MapPin className="h-4 w-4 text-slate-400 group-hover:text-blue-600 shrink-0 mt-0.5 transition" />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-800 group-hover:text-blue-900 leading-snug line-clamp-2">
                      {item.display_name}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          ) : hasSearched ? (
            <div className="p-4 text-center text-xs text-slate-500">
              <p className="font-medium text-slate-600">No locations found. Try a different area or landmark.</p>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
