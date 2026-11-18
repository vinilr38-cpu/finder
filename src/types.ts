export interface Worker {
  id: string;
  name: string;
  role: string;
  rating: number;
  distance: number;
  price: number;
  jobs: number;
  img: string;
  lat?: number;
  lng?: number;
}

export interface Booking {
  id: string;
  workerId: string;
  workerName: string;
  workerRole: string;
  price: number;
  date: string;
  time: string;
  address: string;
  customerId: string;
  status: 'pending' | 'accepted' | 'completed' | 'rejected';
  createdAt: number;
}
