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

export type MobileRigType = 'menetap' | 'gerobak' | 'sepeda' | 'motor' | 'mobil_pickup';

export type MotionState = 'ngetem' | 'pelan' | 'melaju';

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
  rigType?: MobileRigType;
  motionState?: MotionState;
  speedKmh?: number;
  headingDeg?: number;
  lastLocationAt?: number;
  routeSchedule?: string;
  liveBroadcastNote?: string;
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
  rigType?: MobileRigType;
  routeSchedule?: string;
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
  orderKind?: 'langsung' | 'preorder';
  scheduledSlot?: string;
  channel: 'areaqu' | 'whatsapp';
  createdAt: string;
  coords?: [number, number];
}

export type KelilingPingStatus = 'menunggu' | 'otw' | 'sampai' | 'selesai';

export interface KelilingPingItem {
  id: string;
  lapakId: string;
  lapakName: string;
  lapakIcon: string;
  lapakOwner: string;
  senderName: string;
  senderAddress: string;
  senderLandmark: string;
  senderPhone: string;
  note: string;
  status: KelilingPingStatus;
  createdAt: string;
  timestamp: number;
  coords?: [number, number];
}

export const CATEGORY_OPTIONS: Array<{ id: POICategory; label: string; icon: string }> = [
  { id: 'keliling', label: 'Pedagang Keliling', icon: '🛵' },
  { id: 'kuliner', label: 'Kuliner & Bakso/Somay', icon: '🍜' },
  { id: 'warung', label: 'Sayur, Ayam & Sembako', icon: '🥦' },
  { id: 'minuman', label: 'Minuman & Es/Kopi', icon: '☕' },
  { id: 'pkl', label: 'PKL & Kaki Lima', icon: '🍢' },
  { id: 'bengkel', label: 'Bengkel & Servis', icon: '🔧' },
  { id: 'jasa', label: 'Jasa Panggilan', icon: '❄️' },
  { id: 'transportasi', label: 'Transportasi Warga', icon: '🚕' },
];

export const RIG_TYPE_OPTIONS: Array<{
  id: MobileRigType;
  label: string;
  icon: string;
  speedHint: string;
}> = [
  { id: 'gerobak', label: 'Gerobak Dorong', icon: '🛒', speedHint: '±2–5 km/j' },
  { id: 'sepeda', label: 'Sepeda / Rombong', icon: '🚲', speedHint: '±5–12 km/j' },
  { id: 'motor', label: 'Motor Keliling', icon: '🛵', speedHint: '±12–35 km/j' },
  { id: 'mobil_pickup', label: 'Mobil / Pickup', icon: '🛻', speedHint: '±15–45 km/j' },
  { id: 'menetap', label: 'Kios / Mangkal Tetap', icon: '🏪', speedHint: '0 km/j' },
];

export const AVATAR_ICON_OPTIONS = [
  '🥟', '🍜', '🥦', '🍗', '🍢', '🛵', '🚲', '🛒', '🛻', '☕', '🧊', '🏪', '🔧', '📦'
];

export function getCategoryLabel(category: POICategory): string {
  return CATEGORY_OPTIONS.find(c => c.id === category)?.label || 'Lapak Warga';
}

export function getRigMeta(rig?: MobileRigType) {
  return RIG_TYPE_OPTIONS.find(r => r.id === rig) || RIG_TYPE_OPTIONS[4];
}

export function inferMotionState(speedKmh?: number, explicitState?: MotionState): MotionState {
  if (typeof speedKmh === 'number' && !isNaN(speedKmh) && speedKmh >= 0) {
    if (speedKmh >= 10) return 'melaju';
    if (speedKmh >= 1.5) return 'pelan';
    return 'ngetem';
  }
  return explicitState || 'ngetem';
}

