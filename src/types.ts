/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type UserRole = 'master' | 'employee';

export interface UserProfile {
  uid: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt: string;
}

export interface Driver {
  id: string;
  externalId?: string;
  name: string;
  licenseNumber: string;
  phone: string;
  password?: string;
  uid?: string;
  status: 'active' | 'inactive';
}

export interface Truck {
  id: string;
  externalId?: string;
  plate: string;
  model: string;
  year: number;
  status: 'available' | 'on-trip' | 'maintenance';
}

export interface Trailer {
  id: string;
  externalId?: string;
  plate: string;
  type: string;
  status: 'available' | 'on-trip' | 'maintenance';
}

export interface Supplier {
  id: string;
  externalId?: string;
  name: string;
  cnpj: string;
  contact: string;
}

export interface Maintenance {
  id: string;
  externalId?: string;
  truckId: string;
  trailerId?: string;
  supplierId: string;
  date: string;
  description: string;
  totalValue: number;
  installments: number;
  status: 'pending' | 'paid';
  paymentMethod?: string;
}

export interface FuelEntry {
  id: string;
  tripId: string;
  date: string;
  km: number;
  liters: number;
  value: number;
  photoUrl?: string;
}

export interface LunchEntry {
  id: string;
  tripId: string;
  date: string;
  value?: number;
}

export interface AdHocMaintenance {
  id: string;
  tripId: string;
  date: string;
  description: string;
  value: number;
  photoUrl?: string;
}

export interface Trip {
  id: string;
  externalId?: string;
  driverId: string;
  truckId: string;
  trailerIds: string[];
  startKm: number;
  endKm?: number;
  startDate: string;
  startedAt?: string;
  endDate?: string;
  status: 'active' | 'completed';
  checklist: Checklist;
  route?: string;
}

export interface Checklist {
  items: string[];
  notes?: string;
  completedAt?: string;
}

export interface Expense {
  id: string;
  tripId: string;
  type: 'maintenance' | 'lunch' | 'fuel' | 'other';
  value: number;
  description: string;
  date: string;
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  unit: string;
}

export interface Invoice {
  id: string;
  number: string;
  type: 'in' | 'out';
  supplierId?: string;
  date: string;
  items: InvoiceItem[];
}

export interface InvoiceItem {
  productId: string;
  quantity: number;
  price: number;
}

export interface StockMovement {
  id: string;
  invoiceId: string;
  productId: string;
  quantity: number;
  type: 'in' | 'out';
  date: string;
}
