import React, { useState, useEffect } from 'react';
import { 
  Search, MapPin, Star, Calendar, Clock, DollarSign, 
  CheckCircle, XCircle, Wrench, Zap, BookOpen, 
  Sparkles, Bell, LayoutDashboard, Briefcase, ChevronRight 
} from 'lucide-react';
import { signInAnonymously, onAuthStateChanged, type User } from 'firebase/auth';
import { 
  collection, addDoc, onSnapshot, 
  updateDoc, doc 
} from 'firebase/firestore';
import { auth, db, appId } from '../firebase';
import type { Worker, Booking } from '../types';

export const CATEGORIES = [
  { name: 'All', icon: LayoutDashboard },
  { name: 'Plumber', icon: Wrench },
  { name: 'Electrician', icon: Zap },
  { name: 'Tutor', icon: BookOpen },
  { name: 'Cleaner', icon: Sparkles },
];

export const MOCK_WORKERS: Worker[] = [
  { id: 'w1', name: 'Rajesh Kumar', role: 'Plumber', rating: 4.8, distance: 2.1, price: 450, jobs: 124, img: 'https://i.pravatar.cc/150?img=11', lat: 17.385044, lng: 78.486671 },
  { id: 'w2', name: 'Amit Sharma', role: 'Electrician', rating: 4.9, distance: 1.5, price: 500, jobs: 89, img: 'https://i.pravatar.cc/150?img=12', lat: 17.391234, lng: 78.490123 },
  { id: 'w3', name: 'Priya Singh', role: 'Tutor', rating: 5.0, distance: 3.2, price: 800, jobs: 45, img: 'https://i.pravatar.cc/150?img=5', lat: 17.381200, lng: 78.479500 },
  { id: 'w4', name: 'Sunita Devi', role: 'Cleaner', rating: 4.6, distance: 0.8, price: 300, jobs: 210, img: 'https://i.pravatar.cc/150?img=9', lat: 17.395600, lng: 78.483400 },
  { id: 'w5', name: 'Mohammed Ali', role: 'Plumber', rating: 4.5, distance: 4.0, price: 400, jobs: 56, img: 'https://i.pravatar.cc/150?img=15', lat: 17.378900, lng: 78.493000 },
  { id: 'w6', name: 'Kavita Reddy', role: 'Electrician', rating: 4.7, distance: 2.8, price: 480, jobs: 112, img: 'https://i.pravatar.cc/150?img=20', lat: 17.388700, lng: 78.476500 },
];

export default function LocalServiceFinder() {
  const [user, setUser] = useState<User | null>(null);
  const [viewRole, setViewRole] = useState<'customer' | 'provider'>('customer');
  const [bookings, setBookings] = useState<Booking[]>([]);

  useEffect(() => {
    const initAuth = async () => {
      try {
        await signInAnonymously(auth);
      } catch (error) {
        console.warn("Auth note (offline/demo mode active):", error);
        setUser({ uid: 'demo-local-user', isAnonymous: true } as User);
      }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    try {
      const bookingsRef = collection(db, 'artifacts', appId, 'public', 'data', 'bookings');
      const unsubscribe = onSnapshot(bookingsRef, (snapshot) => {
        const fetchedBookings = snapshot.docs.map(d => ({
          id: d.id,
          ...d.data()
        })) as Booking[];
        fetchedBookings.sort((a, b) => b.createdAt - a.createdAt);
        setBookings(fetchedBookings);
      }, (error) => {
        console.warn("Firestore snapshot error (using local mock bookings):", error);
      });
      return () => unsubscribe();
    } catch (e) {
      console.warn("Firestore init failed:", e);
    }
  }, [user]);

  const handleCreateBooking = async (bookingData: Omit<Booking, 'id' | 'customerId' | 'status' | 'createdAt'>) => {
    const currentUserId = user?.uid || 'guest-user';
    const newBooking: Omit<Booking, 'id'> = {
      ...bookingData,
      customerId: currentUserId,
      status: 'pending',
      createdAt: Date.now()
    };

    try {
      const bookingsRef = collection(db, 'artifacts', appId, 'public', 'data', 'bookings');
      const docRef = await addDoc(bookingsRef, newBooking);
      setBookings(prev => [{ id: docRef.id, ...newBooking }, ...prev]);
    } catch {
      // Fallback for demo when Firestore isn't connected to cloud
      setBookings(prev => [{ id: 'local-' + Date.now(), ...newBooking }, ...prev]);
    }
  };

  const handleUpdateBookingStatus = async (bookingId: string, newStatus: Booking['status']) => {
    try {
      const bookingRef = doc(db, 'artifacts', appId, 'public', 'data', 'bookings', bookingId);
      await updateDoc(bookingRef, { status: newStatus });
    } catch {
      setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, status: newStatus } : b));
    }
  };

  return (
    <div className="space-y-6">
      {/* Role Toggle Bar */}
      <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <div>
          <h2 className="text-xl font-bold text-gray-900">
            {viewRole === 'customer' ? 'Customer Portal' : 'Provider Dashboard'}
          </h2>
          <p className="text-sm text-gray-500">
            {viewRole === 'customer' ? 'Explore and book trusted local specialists' : 'Manage your upcoming jobs and earnings'}
          </p>
        </div>

        <div className="bg-gray-100 p-1 rounded-lg flex text-sm font-medium">
          <button 
            onClick={() => setViewRole('customer')}
            className={`px-4 py-1.5 rounded-md transition-all ${viewRole === 'customer' ? 'bg-white shadow-sm text-blue-600 font-semibold' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Customer View
          </button>
          <button 
            onClick={() => setViewRole('provider')}
            className={`px-4 py-1.5 rounded-md transition-all ${viewRole === 'provider' ? 'bg-white shadow-sm text-blue-600 font-semibold' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Provider View
          </button>
        </div>
      </div>

      {viewRole === 'customer' ? (
        <CustomerDashboard workers={MOCK_WORKERS} onCreateBooking={handleCreateBooking} />
      ) : (
        <ProviderDashboard bookings={bookings} onUpdateStatus={handleUpdateBookingStatus} />
      )}
    </div>
  );
}

function CustomerDashboard({ 
  workers, 
  onCreateBooking 
}: { 
  workers: Worker[]; 
  onCreateBooking: (data: any) => void;
}) {
  const [activeCategory, setActiveCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedWorker, setSelectedWorker] = useState<Worker | null>(null);

  const filteredWorkers = workers.filter(worker => {
    const matchesCategory = activeCategory === 'All' || worker.role === activeCategory;
    const matchesSearch = worker.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          worker.role.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl p-8 text-white shadow-lg relative overflow-hidden">
        <div className="relative z-10">
          <h1 className="text-3xl md:text-4xl font-extrabold mb-3">Find Trusted Local Professionals</h1>
          <p className="text-blue-100 mb-6 max-w-xl text-base md:text-lg">
            Book verified plumbers, electricians, tutors, and cleaners in just a few clicks. Fast, reliable, and secure.
          </p>
          
          <div className="flex bg-white rounded-lg p-2 max-w-2xl shadow-md">
            <div className="flex-grow flex items-center px-4">
              <Search className="h-5 w-5 text-gray-400 mr-3" />
              <input 
                type="text" 
                placeholder="Search for services or professionals..." 
                className="w-full focus:outline-none text-gray-800"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <button className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-md font-medium transition-colors">
              Search
            </button>
          </div>
        </div>
      </div>

      {/* Categories */}
      <div>
        <h2 className="text-xl font-bold mb-4 text-gray-800">Categories</h2>
        <div className="flex flex-wrap gap-3">
          {CATEGORIES.map(cat => (
            <button
              key={cat.name}
              onClick={() => setActiveCategory(cat.name)}
              className={`flex items-center px-4 py-2 rounded-full border transition-all ${
                activeCategory === cat.name 
                  ? 'bg-blue-50 border-blue-300 text-blue-700 font-semibold shadow-xs' 
                  : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              <cat.icon className={`h-4 w-4 mr-2 ${activeCategory === cat.name ? 'text-blue-600' : 'text-gray-400'}`} />
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Workers Grid */}
      <div>
        <div className="flex justify-between items-end mb-6">
          <h2 className="text-xl font-bold text-gray-800">Available Professionals near you</h2>
          <span className="text-sm text-gray-500 font-medium">{filteredWorkers.length} results</span>
        </div>
        
        {filteredWorkers.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center shadow-sm border border-gray-100">
            <Search className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900">No professionals found</h3>
            <p className="text-gray-500">Try adjusting your search query or selecting a different category.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredWorkers.map(worker => (
              <WorkerCard 
                key={worker.id} 
                worker={worker} 
                onBook={() => setSelectedWorker(worker)} 
              />
            ))}
          </div>
        )}
      </div>

      {/* Booking Modal */}
      {selectedWorker && (
        <BookingModal 
          worker={selectedWorker} 
          onClose={() => setSelectedWorker(null)}
          onSubmit={(data) => {
            onCreateBooking({
              workerId: selectedWorker.id,
              workerName: selectedWorker.name,
              workerRole: selectedWorker.role,
              price: selectedWorker.price,
              ...data
            });
            setSelectedWorker(null);
          }}
        />
      )}
    </div>
  );
}

function WorkerCard({ worker, onBook }: { worker: Worker; onBook: () => void }) {
  return (
    <div className="bg-white rounded-xl shadow-xs border border-gray-200 p-6 hover:shadow-md transition-shadow group flex flex-col h-full">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center space-x-4">
          <img src={worker.img} alt={worker.name} className="w-14 h-14 rounded-full object-cover border-2 border-gray-100 shadow-xs" />
          <div>
            <h3 className="font-bold text-lg text-gray-900 group-hover:text-blue-600 transition-colors">{worker.name}</h3>
            <p className="text-sm text-blue-600 font-medium">{worker.role}</p>
          </div>
        </div>
        <div className="flex items-center bg-green-50 px-2.5 py-1 rounded-md text-green-700 text-sm font-semibold">
          <Star className="h-3.5 w-3.5 mr-1 fill-current" />
          {worker.rating}
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-4 mb-6 flex-grow">
        <div className="flex items-center text-gray-600 text-sm">
          <MapPin className="h-4 w-4 mr-2 text-gray-400" />
          {worker.distance} km away
        </div>
        <div className="flex items-center text-gray-600 text-sm">
          <Briefcase className="h-4 w-4 mr-2 text-gray-400" />
          {worker.jobs} jobs completed
        </div>
        <div className="flex items-center text-gray-900 font-medium col-span-2 mt-2 bg-gray-50 p-3 rounded-lg">
          <DollarSign className="h-5 w-5 text-gray-500 mr-1" />
          <span className="text-lg font-bold">₹{worker.price}</span>
          <span className="text-gray-500 text-sm font-normal ml-1">/ hour</span>
        </div>
      </div>
      
      <button 
        onClick={onBook}
        className="w-full bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white font-medium py-2.5 rounded-lg transition-colors flex justify-center items-center cursor-pointer"
      >
        Book Now
        <ChevronRight className="h-4 w-4 ml-1" />
      </button>
    </div>
  );
}

function BookingModal({ 
  worker, 
  onClose, 
  onSubmit 
}: { 
  worker: Worker; 
  onClose: () => void; 
  onSubmit: (data: { date: string; time: string; address: string }) => void;
}) {
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [address, setAddress] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (date && time && address) {
      onSubmit({ date, time, address });
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-150">
        <div className="bg-blue-600 p-6 text-white flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold">Book Service</h2>
            <p className="text-blue-100 text-sm mt-1">Requesting {worker.name} ({worker.role})</p>
          </div>
          <button onClick={onClose} className="text-blue-100 hover:text-white transition-colors cursor-pointer">
            <XCircle className="h-6 w-6" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Service Date</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input 
                type="date" 
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Preferred Time</label>
            <div className="relative">
              <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <select 
                required
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none appearance-none"
              >
                <option value="">Select a time slot</option>
                <option value="09:00 AM">09:00 AM - 11:00 AM</option>
                <option value="12:00 PM">12:00 PM - 02:00 PM</option>
                <option value="03:00 PM">03:00 PM - 05:00 PM</option>
                <option value="06:00 PM">06:00 PM - 08:00 PM</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Service Address</label>
            <div className="relative">
              <MapPin className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
              <textarea 
                required
                rows={2}
                placeholder="Enter service address..."
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
              />
            </div>
          </div>

          <div className="bg-blue-50 p-4 rounded-lg flex justify-between items-center mt-6">
            <span className="text-gray-600 font-medium">Estimated Rate</span>
            <span className="text-xl font-bold text-blue-700">₹{worker.price} / hr</span>
          </div>
          
          <button 
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg mt-4 transition-colors shadow-md hover:shadow-lg cursor-pointer"
          >
            Confirm Booking
          </button>
        </form>
      </div>
    </div>
  );
}

function ProviderDashboard({ 
  bookings, 
  onUpdateStatus 
}: { 
  bookings: Booking[]; 
  onUpdateStatus: (id: string, status: Booking['status']) => void;
}) {
  const [isAvailable, setIsAvailable] = useState(true);
  
  const completedJobs = bookings.filter(b => b.status === 'completed').length + 124;
  const pendingRequests = bookings.filter(b => b.status === 'pending');
  const activeJobs = bookings.filter(b => b.status === 'accepted');
  const earnings = bookings.filter(b => b.status === 'completed').reduce((acc, b) => acc + Number(b.price), 0) + 15400;

  return (
    <div className="space-y-8 animate-in slide-in-from-right-4 duration-500">
      {/* Provider Header / Stats */}
      <div className="bg-white rounded-2xl shadow-xs border border-gray-200 p-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="flex items-center space-x-4">
            <img src="https://i.pravatar.cc/150?img=11" alt="Profile" className="w-16 h-16 rounded-full object-cover border-4 border-blue-50" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Rajesh Kumar</h1>
              <p className="text-blue-600 font-medium flex items-center">
                <Wrench className="h-4 w-4 mr-1" /> Expert Plumber
              </p>
            </div>
          </div>

          <div className="flex items-center bg-gray-50 px-4 py-2 rounded-lg border border-gray-100">
            <span className="text-sm text-gray-600 mr-3 font-medium">Accepting Jobs</span>
            <button 
              onClick={() => setIsAvailable(!isAvailable)}
              className={`w-12 h-6 rounded-full transition-colors relative flex items-center cursor-pointer ${isAvailable ? 'bg-green-500' : 'bg-gray-300'}`}
            >
              <div className={`w-5 h-5 bg-white rounded-full shadow-xs absolute transition-transform ${isAvailable ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8 pt-6 border-t border-gray-100">
          <StatCard title="Total Earnings" value={`₹${earnings.toLocaleString()}`} icon={DollarSign} color="text-green-600" bg="bg-green-50" />
          <StatCard title="Jobs Completed" value={String(completedJobs)} icon={CheckCircle} color="text-blue-600" bg="bg-blue-50" />
          <StatCard title="Active Jobs" value={String(activeJobs.length)} icon={Briefcase} color="text-purple-600" bg="bg-purple-50" />
          <StatCard title="Rating" value="4.8" suffix="/ 5.0" icon={Star} color="text-yellow-500" bg="bg-yellow-50" />
        </div>
      </div>

      {/* Main Grid: Requests vs Active */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div>
          <div className="flex items-center mb-4">
            <h2 className="text-xl font-bold text-gray-900">New Requests</h2>
            {pendingRequests.length > 0 && (
              <span className="ml-3 bg-red-100 text-red-600 py-0.5 px-2.5 rounded-full text-xs font-bold">
                {pendingRequests.length} New
              </span>
            )}
          </div>
          
          <div className="space-y-4">
            {pendingRequests.length === 0 ? (
              <EmptyState icon={Bell} message="No new job requests at the moment." />
            ) : (
              pendingRequests.map(job => (
                <JobCard 
                  key={job.id} 
                  job={job} 
                  type="pending"
                  onAccept={() => onUpdateStatus(job.id, 'accepted')}
                  onReject={() => onUpdateStatus(job.id, 'rejected')}
                />
              ))
            )}
          </div>
        </div>

        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-4">Active & Upcoming</h2>
          <div className="space-y-4">
            {activeJobs.length === 0 ? (
              <EmptyState icon={Calendar} message="You have no upcoming jobs scheduled." />
            ) : (
              activeJobs.map(job => (
                <JobCard 
                  key={job.id} 
                  job={job} 
                  type="active"
                  onComplete={() => onUpdateStatus(job.id, 'completed')}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ 
  title, 
  value, 
  suffix = '', 
  icon: Icon, 
  color, 
  bg 
}: { 
  title: string; 
  value: string; 
  suffix?: string; 
  icon: any; 
  color: string; 
  bg: string;
}) {
  return (
    <div className="flex items-center p-3">
      <div className={`${bg} ${color} p-3 rounded-lg mr-4`}>
        <Icon className="h-6 w-6" />
      </div>
      <div>
        <p className="text-sm text-gray-500 font-medium">{title}</p>
        <p className="text-xl font-bold text-gray-900 flex items-baseline">
          {value} <span className="text-sm text-gray-500 font-normal ml-1">{suffix}</span>
        </p>
      </div>
    </div>
  );
}

function JobCard({ 
  job, 
  type, 
  onAccept, 
  onReject, 
  onComplete 
}: { 
  job: Booking; 
  type: 'pending' | 'active'; 
  onAccept?: () => void; 
  onReject?: () => void; 
  onComplete?: () => void;
}) {
  return (
    <div className="bg-white rounded-xl shadow-xs border border-gray-200 p-5 hover:border-blue-300 transition-colors relative overflow-hidden">
      {type === 'pending' && <div className="absolute top-0 left-0 w-1 h-full bg-yellow-400" />}
      {type === 'active' && <div className="absolute top-0 left-0 w-1 h-full bg-blue-500" />}
      
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className="font-bold text-lg text-gray-900">Job Request: {job.workerRole}</h3>
          <p className="text-sm text-gray-500 mt-1 flex items-center">
            <Calendar className="h-4 w-4 mr-1" /> {job.date} at {job.time}
          </p>
        </div>
        <div className="text-right">
          <span className="block text-lg font-bold text-gray-900">₹{job.price}</span>
        </div>
      </div>
      
      <div className="bg-gray-50 rounded-lg p-3 mb-4 text-sm text-gray-700 flex items-start">
        <MapPin className="h-4 w-4 mr-2 text-gray-400 mt-0.5 shrink-0" />
        <p className="leading-snug">{job.address || "123 Main St, Local Area"}</p>
      </div>

      {type === 'pending' && (
        <div className="flex space-x-3">
          <button 
            onClick={onAccept}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 rounded-lg transition-colors flex items-center justify-center cursor-pointer"
          >
            <CheckCircle className="h-4 w-4 mr-2" /> Accept
          </button>
          <button 
            onClick={onReject}
            className="flex-1 bg-white border border-gray-300 hover:bg-red-50 hover:text-red-600 hover:border-red-200 text-gray-700 font-medium py-2 rounded-lg transition-colors flex items-center justify-center cursor-pointer"
          >
            <XCircle className="h-4 w-4 mr-2" /> Decline
          </button>
        </div>
      )}

      {type === 'active' && onComplete && (
        <button 
          onClick={onComplete}
          className="w-full bg-green-50 hover:bg-green-100 text-green-700 font-medium py-2 rounded-lg transition-colors flex items-center justify-center border border-green-200 cursor-pointer"
        >
          <CheckCircle className="h-4 w-4 mr-2" /> Mark as Completed
        </button>
      )}
    </div>
  );
}

function EmptyState({ icon: Icon, message }: { icon: any; message: string }) {
  return (
    <div className="bg-white border border-dashed border-gray-300 rounded-xl p-8 text-center flex flex-col items-center justify-center h-48">
      <div className="bg-gray-50 p-3 rounded-full mb-3">
        <Icon className="h-8 w-8 text-gray-400" />
      </div>
      <p className="text-gray-500 font-medium">{message}</p>
    </div>
  );
}
