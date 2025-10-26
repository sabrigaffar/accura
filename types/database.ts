export type UserType = 'customer' | 'driver' | 'merchant' | 'admin';
export type MerchantCategory = 'restaurant' | 'grocery' | 'pharmacy' | 'gifts' | 'other';
export type OrderStatus = 'pending' | 'accepted' | 'preparing' | 'ready' | 'picked_up' | 'on_the_way' | 'delivered' | 'cancelled';
export type PaymentMethod = 'cash' | 'card' | 'wallet';
export type VehicleType = 'car' | 'motorcycle' | 'bicycle';

export interface Profile {
  id: string;
  user_type: UserType;
  full_name: string;
  phone_number: string;
  avatar_url?: string;
  language: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Address {
  id: string;
  user_id: string;
  title: string;
  street_address: string;
  city: string;
  district?: string;
  building_number?: string;
  floor_number?: string;
  latitude?: number;
  longitude?: number;
  is_default: boolean;
}

export interface Merchant {
  id: string;
  owner_id: string;
  name_ar: string;
  name_en?: string;
  description_ar?: string;
  description_en?: string;
  category: MerchantCategory;
  logo_url?: string;
  banner_url?: string;
  rating: number;
  total_reviews: number;
  avg_delivery_time: number;
  min_order_amount: number;
  delivery_fee: number;
  is_open: boolean;
  address: string;
  latitude?: number;
  longitude?: number;
  working_hours?: any;
  is_active: boolean;
}

export interface Product {
  id: string;
  merchant_id: string;
  name_ar: string;
  name_en?: string;
  description_ar?: string;
  description_en?: string;
  price: number;
  image_url?: string;
  category?: string;
  is_available: boolean;
  preparation_time: number;
}

export interface Order {
  id: string;
  order_number: string;
  customer_id: string;
  merchant_id: string;
  driver_id?: string;
  status: OrderStatus;
  delivery_address_id?: string;
  pickup_lat?: number;
  pickup_lng?: number;
  delivery_lat?: number;
  delivery_lng?: number;
  subtotal: number;
  delivery_fee: number;
  service_fee: number;
  tax: number;
  discount: number;
  total: number;
  payment_method: PaymentMethod;
  payment_status: string;
  delivery_notes?: string;
  estimated_delivery_time?: string;
  actual_delivery_time?: string;
  rating?: number;
  review_text?: string;
  created_at: string;
}

export interface DriverProfile {
  id: string;
  vehicle_type: VehicleType;
  vehicle_model?: string;
  vehicle_color?: string;
  license_plate?: string;
  is_verified: boolean;
  is_online: boolean;
  current_lat?: number;
  current_lng?: number;
  total_earnings: number;
  total_deliveries: number;
  average_rating: number;
}
