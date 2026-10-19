export interface Service {
  id: string;
  name: string;
  description: string;
  duration: number;
  capacity: number;
  price: number;
  color: string;
}
export interface Booking {
  id: string;
  serviceId: string;
  serviceName: string;
  name: string;
  email: string;
  date: string;
  time: string;
  seats: number;
  status: "confirmed" | "cancelled";
  createdAt: string;
}
export interface Event {
  id: number;
  type: string;
  message: string;
  createdAt: string;
}
export interface Overview {
  services: Service[];
  bookings: Booking[];
  events: Event[];
  health: "healthy" | "degraded";
  demoFaultsEnabled: boolean;
  fault: string;
  metrics: {
    confirmed: number;
    cancelled: number;
    revenue: number;
    occupiedSeats: number;
  };
}
export interface Slot {
  time: string;
  remaining: number;
  available: boolean;
}
