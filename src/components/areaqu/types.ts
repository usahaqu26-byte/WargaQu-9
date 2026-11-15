export type POICategory =
  | 'kuliner'
  | 'warung'
  | 'minuman'
  | 'pkl'
  | 'keliling'
  | 'bengkel'
  | 'jasa'
  | 'transportasi';

export type LapakType = 'menetap' | 'keliling' | 'jasa_panggilan';

export interface CatalogProduct {
  id: string;
  name: string;
  price: number;
  category: string;
  description: string;
  imageUrl?: string;
  isAvailable: boolean;
}

export interface LapakItem {
  id: string;
  name: string;
  ownerName: string;
  ownerWargaId?: string;
  rtRw?: string;
  isVerifiedWarga?: boolean;
  lapakType?: LapakType;
  category: POICategory;
  categoryLabel: string;
  lat: number;
  lng: number;
  address: string;
  phone: string;
  status: 'buka' | 'keliling' | 'tutup';
  operationalHours: string;
  rating: number;
  description: string;
  avatarIcon: string;
  vehicleType?: string;
  catalog: CatalogProduct[];
  isMyLapak?: boolean;
  isPublished?: boolean;
  distanceMeter?: number;
  etaMinutes?: number;
}

export interface ConsumerIdentity {
  fullName: string;
  wargaId: string;
  rtRw: string;
  addressDetail: string;
  landmark: string;
  phone: string;
  residentStatus: 'warga' | 'tamu';
  shareExactLocationOnOrder: boolean;
  isVerified: boolean;
  updatedAt: string;
}

export interface MerchantIdentity {
  ownerName: string;
  wargaId: string;
  rtRw: string;
  lapakName: string;
  category: POICategory;
  lapakType: LapakType;
  baseAddress: string;
  phone: string;
  operationalHours: string;
  description: string;
  avatarIcon: string;
  vehicleType: string;
  isVerified: boolean;
  updatedAt: string;
}

export type OrderStatus = 'menunggu' | 'diproses' | 'diantar' | 'selesai';

export interface AreaOrderItem {
  id: string;
  lapakId: string;
  lapakName: string;
  lapakIcon: string;
  lapakOwner: string;
  consumerName: string;
  consumerWargaId: string;
  consumerRtRw: string;
  consumerAddress: string;
  consumerLandmark: string;
  consumerPhone: string;
  items: Array<{
    id: string;
    name: string;
    qty: number;
    price: number;
  }>;
  total: number;
  note: string;
  status: OrderStatus;
  channel: 'areaqu' | 'whatsapp';
  createdAt: string;
  coords?: [number, number];
}

export const CATEGORY_OPTIONS: Array<{ id: POICategory; label: string; icon: string }> = [
  { id: 'kuliner', label: 'Kuliner & Makanan', icon: '🍲' },
  { id: 'warung', label: 'Warung & Sembako', icon: '🏪' },
  { id: 'minuman', label: 'Minuman & Kopi', icon: '☕' },
  { id: 'pkl', label: 'PKL & Kaki Lima', icon: '🍗' },
  { id: 'keliling', label: 'Pedagang Keliling', icon: '🥦' },
  { id: 'bengkel', label: 'Bengkel & Servis', icon: '🔧' },
  { id: 'jasa', label: 'Jasa Panggilan', icon: '❄️' },
  { id: 'transportasi', label: 'Transportasi Warga', icon: '🛵' },
];

export const AVATAR_ICON_OPTIONS = ['🍲', '🏪', '☕', '🍗', '🥦', '🔧', '❄️', '🛵', '🍜', '🧁', '🧺', '📦'];

export function getCategoryLabel(category: POICategory): string {
  return CATEGORY_OPTIONS.find(c => c.id === category)?.label || 'Lapak Warga';
}
