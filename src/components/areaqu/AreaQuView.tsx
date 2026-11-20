import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  ArrowLeft,
  Search,
  Siren,
  MessageCircle,
  ShoppingBag,
  Phone,
  Compass,
  MapPin,
  Star,
  Clock,
  Store,
  ChevronDown,
  X,
  Plus,
  Minus,
  CheckCircle,
  Radio,
  Trash2,
  Share2,
  Send,
  LocateFixed,
  Crosshair,
  RefreshCw,
  Eye,
  ShieldCheck,
  Heart,
  List,
  Map as MapIcon,
  UserCheck,
  ClipboardList,
  AlertTriangle,
  BadgeCheck,
  Navigation,
  Edit3,
  HelpCircle,
  BellRing,
  Megaphone,
  CalendarClock,
  Gauge
} from 'lucide-react';
import { ModuleOnboardingService } from '../../services/moduleOnboardingService';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MenuItem } from '../../types';
import { AUTH_SYNC_EVENT, AuthService } from '../../services/authService';
import { MonetizationService } from '../../services/monetizationService';
import { ModularFeeSheet } from '../monetization/ModularFeeSheet';
import {
  REALTIME_RELAY_EVENT,
  RelayIncomingEvent,
  RealtimeRelayService,
} from '../../services/realtimeRelayService';
import {
  POICategory,
  CatalogProduct,
  LapakItem,
  ConsumerIdentity,
  MerchantIdentity,
  AreaOrderItem,
  OrderStatus,
  KelilingPingItem,
  KelilingPingStatus,
  MotionState,
  CATEGORY_OPTIONS,
  getCategoryLabel,
  getRigMeta,
  inferMotionState
} from './types';
import { IdentityPanel } from './IdentityPanel';
import { ActivityPanel } from './ActivityPanel';

export type { POICategory, CatalogProduct, LapakItem };

interface AreaQuViewProps {
  onBackToMain: () => void;
  onOpenSiagaQu: () => void;
  onOpenChatQu: () => void;
  onOpenUsahaQu: () => void;
  menuList: MenuItem[];
  showNotification: (msg: string) => void;
  initialTab?: AreaMainTab;
}

export interface LocationPreset {
  name: string;
  desc: string;
  coords: [number, number];
}

const LOCATION_PRESETS: LocationPreset[] = [
  { name: 'Kuningan, Jawa Barat (Pusat Kota)', desc: 'Kabupaten Kuningan', coords: [-6.9765, 108.4835] },
  { name: 'Jakarta Pusat (Monas & Sekitar)', desc: 'DKI Jakarta', coords: [-6.1754, 106.8272] },
  { name: 'Bandung (Alun-Alun / Dago)', desc: 'Kota Bandung', coords: [-6.9215, 107.607] },
  { name: 'Yogyakarta (Malioboro / Tugu)', desc: 'DI Yogyakarta', coords: [-7.7928, 110.3658] },
  { name: 'Surabaya (Gubeng / Pusat)', desc: 'Jawa Timur', coords: [-7.2655, 112.7519] },
];

const DEFAULT_COORDS: [number, number] = [-6.9742, 108.4862];

function calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3;
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const dPhi = ((lat2 - lat1) * Math.PI) / 180;
  const dLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dPhi / 2) * Math.sin(dPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda / 2) * Math.sin(dLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

const INITIAL_LAPAKS: LapakItem[] = [
  {
    id: 'lapak-saya',
    name: 'Lapak Usaha Saya',
    ownerName: 'Pemilik Lapak',
    ownerWargaId: '',
    rtRw: '',
    isVerifiedWarga: false,
    lapakType: 'menetap',
    rigType: 'menetap',
    motionState: 'ngetem',
    routeSchedule: '',
    category: 'kuliner',
    categoryLabel: 'Kuliner & Usaha',
    lat: DEFAULT_COORDS[0],
    lng: DEFAULT_COORDS[1],
    address: 'Atur lokasi lapak di tab Lapak Saya',
    phone: '',
    status: 'tutup',
    operationalHours: '09:00 - 21:00 WIB',
    rating: 5.0,
    description: 'Lengkapi profil dan katalog lapak Anda agar warga sekitar dapat memesan langsung.',
    avatarIcon: '🏪',
    isMyLapak: true,
    isPublished: false,
    catalog: []
  }
];

const DEFAULT_CONSUMER_IDENTITY: ConsumerIdentity = {
  fullName: 'Warga',
  wargaId: '',
  rtRw: '',
  addressDetail: '',
  landmark: '',
  phone: '',
  residentStatus: 'warga',
  shareExactLocationOnOrder: true,
  isVerified: false,
  updatedAt: ''
};

const DEFAULT_MERCHANT_IDENTITY: MerchantIdentity = {
  ownerName: 'Pemilik Lapak',
  wargaId: '',
  rtRw: '',
  lapakName: 'Lapak Usaha Saya',
  category: 'kuliner',
  lapakType: 'menetap',
  rigType: 'menetap',
  routeSchedule: '',
  baseAddress: '',
  phone: '',
  operationalHours: '09:00 - 21:00 WIB',
  description: '',
  avatarIcon: '🏪',
  vehicleType: '',
  isVerified: false,
  updatedAt: new Date().toISOString()
};

type AreaMainTab = 'jelajah' | 'lapak' | 'aktivitas' | 'identitas';

export const AreaQuView: React.FC<AreaQuViewProps> = ({
  onBackToMain,
  onOpenSiagaQu,
  onOpenChatQu,
  menuList,
  showNotification,
  initialTab = 'jelajah'
}) => {
  // ---------------------------------------------------------------------------
  // 1. 4-TAB NAVIGATION & SUB-MENU STATES
  // ---------------------------------------------------------------------------
  const [activeTab, setActiveTab] = useState<AreaMainTab>(initialTab);
  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);
  const [jelajahSubMode, setJelajahSubMode] = useState<'peta' | 'daftar'>('peta');
  const [lapakSubTab, setLapakSubTab] = useState<'lokasi' | 'katalog'>('lokasi');
  const [identitySubTab, setIdentitySubTab] = useState<'konsumen' | 'pedagang' | 'keamanan'>('konsumen');
  const [isSettingLapakPinOnMap, setIsSettingLapakPinOnMap] = useState<boolean>(false);
  const [isSettingUserPinOnMap, setIsSettingUserPinOnMap] = useState<boolean>(false);
  const [lapakFeeModal, setLapakFeeModal] = useState<{
    open: boolean;
    actionLabel: string;
    onPaidCallback: (() => void) | null;
  }>({ open: false, actionLabel: 'Sewa & Tayang Lapak AreaQu', onPaidCallback: null });

  const runWithLapakFeeGate = (actionLabel: string, callback: () => void) => {
    const rule = MonetizationService.getRule('areaqu_lapak');
    if (rule.enabled && !MonetizationService.hasActiveUnlock('areaqu_lapak')) {
      setLapakFeeModal({
        open: true,
        actionLabel,
        onPaidCallback: callback,
      });
      return;
    }
    callback();
  };

  // ---------------------------------------------------------------------------
  // 2. VERIFIED IDENTITIES (CALON KONSUMEN & PEDAGANG)
  // ---------------------------------------------------------------------------
  const [consumerIdentity, setConsumerIdentity] = useState<ConsumerIdentity>(() => {
    const saved = localStorage.getItem('wargaqu_areaqu_consumer_identity_v1');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return DEFAULT_CONSUMER_IDENTITY;
      }
    }
    return DEFAULT_CONSUMER_IDENTITY;
  });

  const [merchantIdentity, setMerchantIdentity] = useState<MerchantIdentity>(() => {
    const saved = localStorage.getItem('wargaqu_areaqu_merchant_identity_v1');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return DEFAULT_MERCHANT_IDENTITY;
      }
    }
    return DEFAULT_MERCHANT_IDENTITY;
  });

  useEffect(() => {
    localStorage.setItem('wargaqu_areaqu_consumer_identity_v1', JSON.stringify(consumerIdentity));
  }, [consumerIdentity]);

  useEffect(() => {
    localStorage.setItem('wargaqu_areaqu_merchant_identity_v1', JSON.stringify(merchantIdentity));
  }, [merchantIdentity]);

  useEffect(() => {
    const syncFromAuth = () => {
      const acc = AuthService.getAccount();
      if (!acc) return;
      const displayName = AuthService.getDisplayName(acc);
      setConsumerIdentity(prev => ({
        ...prev,
        fullName:
          prev.fullName && prev.fullName !== DEFAULT_CONSUMER_IDENTITY.fullName
            ? prev.fullName
            : displayName,
        phone: acc.phone,
        updatedAt: new Date().toISOString(),
      }));
      setMerchantIdentity(prev => ({
        ...prev,
        ownerName:
          prev.ownerName && prev.ownerName !== DEFAULT_MERCHANT_IDENTITY.ownerName
            ? prev.ownerName
            : displayName,
        phone: acc.phone,
        updatedAt: new Date().toISOString(),
      }));
    };

    syncFromAuth();
    window.addEventListener(AUTH_SYNC_EVENT, syncFromAuth);
    return () => window.removeEventListener(AUTH_SYNC_EVENT, syncFromAuth);
  }, []);

  // ---------------------------------------------------------------------------
  // 3. GPS & LOCATION STATES
  // ---------------------------------------------------------------------------
  const [userCoords, setUserCoords] = useState<[number, number]>(() => {
    const saved = localStorage.getItem('wargaqu_areaqu_user_coords');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (
          Array.isArray(parsed) &&
          parsed.length === 2 &&
          typeof parsed[0] === 'number' &&
          typeof parsed[1] === 'number' &&
          !isNaN(parsed[0]) &&
          !isNaN(parsed[1])
        ) {
          return [parsed[0], parsed[1]];
        }
      } catch {
        // ignore parse error
      }
    }
    return DEFAULT_COORDS;
  });

  const savedGpsMeta = useMemo(() => {
    try {
      const raw = localStorage.getItem('wargaqu_areaqu_gps_meta_v1');
      if (raw) {
        return JSON.parse(raw) as {
          mode?: 'gps' | 'preset' | 'manual';
          label?: string;
          accuracy?: number | null;
        };
      }
    } catch {
      // ignore
    }
    return null;
  }, []);

  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(
    typeof savedGpsMeta?.accuracy === 'number' ? savedGpsMeta.accuracy : null
  );
  const [isGpsAcquiring, setIsGpsAcquiring] = useState<boolean>(false);
  const [gpsSourceLabel, setGpsSourceLabel] = useState<string>(
    savedGpsMeta?.label || 'Mendeteksi GPS...'
  );
  const [gpsErrorDetail, setGpsErrorDetail] = useState<string>('');
  const [showGpsModal, setShowGpsModal] = useState<boolean>(false);
  const [manualLatInput, setManualLatInput] = useState<string>('');
  const [manualLngInput, setManualLngInput] = useState<string>('');

  const persistUserLocation = (
    coords: [number, number],
    mode: 'gps' | 'preset' | 'manual',
    label: string,
    accuracy: number | null
  ) => {
    try {
      localStorage.setItem('wargaqu_areaqu_user_coords', JSON.stringify(coords));
      localStorage.setItem(
        'wargaqu_areaqu_gps_meta_v1',
        JSON.stringify({ mode, label, accuracy, updatedAt: Date.now() })
      );
    } catch {
      // ignore quota error
    }
  };

  // ---------------------------------------------------------------------------
  // 4. MERCHANTS / LAPAK DATASET, ORDERS, FAVORITES
  // ---------------------------------------------------------------------------
  const [lapaks, setLapaks] = useState<LapakItem[]>(() => {
    const legacyFakeIds = new Set([
      'lapak-baksoqu',
      'lapak-warung-madura',
      'lapak-pecellele',
      'lapak-bengkel',
      'lapak-sayur',
      'lapak-kopi',
      'lapak-ac',
      'lapak-ojol',
    ]);
    const saved = localStorage.getItem('wargaqu_areaqu_lapaks_v2');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const cleaned = (parsed as LapakItem[]).filter(
            (l) => !legacyFakeIds.has(l.id)
          );
          if (cleaned.length > 0) return cleaned;
        }
      } catch {
        // ignore parse error
      }
    }
    return INITIAL_LAPAKS;
  });

  useEffect(() => {
    localStorage.setItem('wargaqu_areaqu_lapaks_v2', JSON.stringify(lapaks));
  }, [lapaks]);

  const [orders, setOrders] = useState<AreaOrderItem[]>(() => {
    const saved = localStorage.getItem('wargaqu_areaqu_orders_v1');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch {
        // ignore parse error
      }
    }
    return [];
  });

  useEffect(() => {
    localStorage.setItem('wargaqu_areaqu_orders_v1', JSON.stringify(orders));
  }, [orders]);

  const [pings, setPings] = useState<KelilingPingItem[]>(() => {
    const saved = localStorage.getItem('wargaqu_areaqu_keliling_pings_v1');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch {
        // ignore parse error
      }
    }
    return [];
  });

  useEffect(() => {
    localStorage.setItem('wargaqu_areaqu_keliling_pings_v1', JSON.stringify(pings));
  }, [pings]);

  const [favoriteIds, setFavoriteIds] = useState<string[]>(() => {
    const saved = localStorage.getItem('wargaqu_areaqu_favorites_v1');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return (parsed as string[]).filter((id) => id !== 'lapak-warung-madura');
        }
      } catch {
        // ignore parse error
      }
    }
    return [];
  });

  useEffect(() => {
    localStorage.setItem('wargaqu_areaqu_favorites_v1', JSON.stringify(favoriteIds));
  }, [favoriteIds]);

  const myLapak = useMemo(() => {
    return lapaks.find(l => l.isMyLapak) || lapaks[0];
  }, [lapaks]);

  const [selectedRadius, setSelectedRadius] = useState<number>(1000);
  const [selectedLapak, setSelectedLapak] = useState<LapakItem | null>(null);
  const [kelilingBanner, setKelilingBanner] = useState<{
    lapakId: string;
    lapakName: string;
    lapakIcon: string;
    ownerName: string;
    rigLabel: string;
    note: string;
    distanceMeter: number;
    sentAt: string;
  } | null>(null);
  const proximityAlertedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const handleRemoteAreaRelay = (evt: Event) => {
      const detail = (evt as CustomEvent<RelayIncomingEvent>).detail;
      if (!detail || !detail.payload || typeof detail.payload !== 'object') return;

      if (detail.eventName === 'order:areaqu') {
        const p = detail.payload as { order?: AreaOrderItem };
        const incomingOrder = p.order;
        if (!incomingOrder?.id) return;
        if (myLapak && incomingOrder.lapakId !== myLapak.id) return;
        setOrders(prev => (prev.some(o => o.id === incomingOrder.id) ? prev : [incomingOrder, ...prev]));
        showNotification(
          `${incomingOrder.orderKind === 'preorder' ? 'Pre-Order' : 'Pesanan'} baru dari ${incomingOrder.consumerName}`
        );
        return;
      }

      if (detail.eventName === 'order:areaqu_status') {
        const p = detail.payload as { orderId?: string; status?: OrderStatus };
        if (!p.orderId || !p.status) return;
        setOrders(prev => prev.map(o => (o.id === p.orderId ? { ...o, status: p.status! } : o)));
        return;
      }

      if (detail.eventName === 'areaqu:lapak_sync') {
        const p = detail.payload as { lapak?: LapakItem };
        const incomingLapak = p.lapak;
        if (!incomingLapak?.id || incomingLapak.id === myLapak?.id) return;
        setLapaks(prev => {
          const exists = prev.some(l => l.id === incomingLapak.id);
          if (exists) {
            return prev.map(l => (l.id === incomingLapak.id ? { ...incomingLapak, isMyLapak: false } : l));
          }
          return [{ ...incomingLapak, isMyLapak: false }, ...prev];
        });
        if (
          favoriteIds.includes(incomingLapak.id) &&
          incomingLapak.status === 'keliling' &&
          !proximityAlertedRef.current.has(incomingLapak.id)
        ) {
          const dist = calculateDistanceMeters(
            userCoords[0],
            userCoords[1],
            incomingLapak.lat,
            incomingLapak.lng
          );
          if (dist <= 300) {
            proximityAlertedRef.current.add(incomingLapak.id);
            showNotification(`${incomingLapak.avatarIcon} ${incomingLapak.name} (Favorit) sudah dekat (${dist}m)!`);
          }
        }
        return;
      }

      if (detail.eventName === 'areaqu:keliling_ping') {
        const p = detail.payload as { ping?: KelilingPingItem };
        const incomingPing = p.ping;
        if (!incomingPing?.id) return;
        if (myLapak && incomingPing.lapakId !== myLapak.id) return;
        setPings(prev => (prev.some(item => item.id === incomingPing.id) ? prev : [incomingPing, ...prev]));
        showNotification(`Panggilan mampir dari ${incomingPing.senderName}!`);
        return;
      }

      if (detail.eventName === 'areaqu:keliling_ping_status') {
        const p = detail.payload as { pingId?: string; status?: KelilingPingStatus };
        if (!p.pingId || !p.status) return;
        setPings(prev =>
          prev.map(item => (item.id === p.pingId ? { ...item, status: p.status! } : item))
        );
        if (p.status === 'otw') {
          showNotification('Pedagang keliling sudah OTW mampir ke lokasi Anda!');
        } else if (p.status === 'sampai') {
          showNotification('Pedagang keliling sudah sampai di titik lokasi Anda!');
        }
        return;
      }

      if (detail.eventName === 'areaqu:keliling_announce') {
        const p = detail.payload as {
          lapakId?: string;
          lapakName?: string;
          lapakIcon?: string;
          ownerName?: string;
          rigLabel?: string;
          note?: string;
          lat?: number;
          lng?: number;
          sentAt?: string;
        };
        if (!p.lapakId || p.lapakId === myLapak?.id) return;
        const dist =
          typeof p.lat === 'number' && typeof p.lng === 'number'
            ? calculateDistanceMeters(userCoords[0], userCoords[1], p.lat, p.lng)
            : 0;
        if (dist <= selectedRadius || selectedRadius >= 5000) {
          setKelilingBanner({
            lapakId: p.lapakId,
            lapakName: p.lapakName || 'Pedagang Keliling',
            lapakIcon: p.lapakIcon || '🛵',
            ownerName: p.ownerName || 'Pedagang',
            rigLabel: p.rigLabel || 'Keliling',
            note: p.note || 'Sedang melintas di sekitar lingkungan.',
            distanceMeter: dist,
            sentAt: p.sentAt || new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
          });
        }
        return;
      }

      if (detail.eventName === 'areaqu:chat') {
        const p = detail.payload as {
          lapakId?: string;
          senderRole?: 'user' | 'merchant';
          text?: string;
          time?: string;
        };
        if (!p.text || !p.lapakId) return;
        if (selectedLapak && p.lapakId !== selectedLapak.id) return;
        setChatMessages(prev => [
          ...prev,
          {
            sender: p.senderRole === 'merchant' ? 'merchant' : 'user',
            text: p.text!,
            time: p.time || new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
      }
    };
    window.addEventListener(REALTIME_RELAY_EVENT, handleRemoteAreaRelay);
    return () => window.removeEventListener(REALTIME_RELAY_EVENT, handleRemoteAreaRelay);
  }, [myLapak?.id, selectedLapak?.id, favoriteIds, userCoords, selectedRadius]);

  // ---------------------------------------------------------------------------
  // 5. MAP INSTANCE & LEAFLET REFS
  // ---------------------------------------------------------------------------
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const radarCircleRef = useRef<L.Circle | null>(null);
  const gpsAccuracyCircleRef = useRef<L.Circle | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const routePolylineRef = useRef<L.Polyline | null>(null);
  const isSettingLapakPinRef = useRef<boolean>(false);
  const isSettingUserPinRef = useRef<boolean>(false);
  const pendingRecenterRef = useRef<boolean>(false);
  const gpsWatchIdRef = useRef<number | null>(null);
  const gpsStopTimerRef = useRef<number | null>(null);
  const isMapVisibleRef = useRef<boolean>(true);

  useEffect(() => {
    isSettingLapakPinRef.current = isSettingLapakPinOnMap;
  }, [isSettingLapakPinOnMap]);

  useEffect(() => {
    isSettingUserPinRef.current = isSettingUserPinOnMap;
  }, [isSettingUserPinOnMap]);

  useEffect(() => {
    isMapVisibleRef.current = activeTab === 'jelajah' && jelajahSubMode === 'peta';
  }, [activeTab, jelajahSubMode]);

  // Filter & Search states (Jelajah)
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [motionFilter, setMotionFilter] = useState<'semua' | 'keliling_live' | 'ngetem'>('semua');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals
  const [showKatalogModal, setShowKatalogModal] = useState<boolean>(false);
  const [showChatModal, setShowChatModal] = useState<boolean>(false);
  const [showRadiusModal, setShowRadiusModal] = useState<boolean>(false);
  const [showAddProductModal, setShowAddProductModal] = useState<boolean>(false);
  const [showPreviewModal, setShowPreviewModal] = useState<boolean>(false);
  const [showPingModal, setShowPingModal] = useState<boolean>(false);
  const [pingNoteInput, setPingNoteInput] = useState<string>('');
  const [pingShareCoords, setPingShareCoords] = useState<boolean>(true);

  // Consumer Identity Gate Modal
  const [showConsumerGateModal, setShowConsumerGateModal] = useState<boolean>(false);
  const [pendingCheckoutChannel, setPendingCheckoutChannel] = useState<'areaqu' | 'whatsapp' | null>(null);
  const [gateName, setGateName] = useState('');
  const [gatePhone, setGatePhone] = useState('');
  const [gateRtRw, setGateRtRw] = useState('');
  const [gateAddress, setGateAddress] = useState('');
  const [gateLandmark, setGateLandmark] = useState('');

  // Chat state
  const [chatMessages, setChatMessages] = useState<Array<{ sender: 'user' | 'merchant'; text: string; time: string }>>([]);
  const [chatInputText, setChatInputText] = useState<string>('');

  // Cart & Pre-Order items
  const [cartItems, setCartItems] = useState<Record<string, number>>({});
  const [orderKind, setOrderKind] = useState<'langsung' | 'preorder'>('langsung');
  const [scheduledSlot, setScheduledSlot] = useState<string>('Putaran Pagi (06:30–09:00)');

  // Pedagang Keliling Live GPS Broadcast states
  const [isKelilingLive, setIsKelilingLive] = useState<boolean>(false);
  const [broadcastNoteInput, setBroadcastNoteInput] = useState<string>('');
  const [routeScheduleDraft, setRouteScheduleDraft] = useState<string>(myLapak?.routeSchedule || '');
  const kelilingWatchIdRef = useRef<number | null>(null);
  const lastBroadcastSentRef = useRef<{ lat: number; lng: number; time: number } | null>(null);
  const lastSpeedSampleRef = useRef<{ lat: number; lng: number; time: number } | null>(null);
  const manualMotionOverrideRef = useRef<MotionState | null>(null);

  useEffect(() => {
    setRouteScheduleDraft(myLapak?.routeSchedule || '');
  }, [myLapak?.routeSchedule]);

  // Add Product form states
  const [newProductName, setNewProductName] = useState('');
  const [newProductPrice, setNewProductPrice] = useState('');
  const [newProductCategory, setNewProductCategory] = useState('Makanan');
  const [newProductDesc, setNewProductDesc] = useState('');

  // ---------------------------------------------------------------------------
  // 6. GPS ACQUISITION (TWO-STAGE HIGH-ACCURACY REFINEMENT + FALLBACK)
  // ---------------------------------------------------------------------------
  const stopGpsWatcher = () => {
    if (gpsWatchIdRef.current !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(gpsWatchIdRef.current);
      gpsWatchIdRef.current = null;
    }
    if (gpsStopTimerRef.current !== null) {
      window.clearTimeout(gpsStopTimerRef.current);
      gpsStopTimerRef.current = null;
    }
  };

  const applyResolvedCoords = (
    newCoords: [number, number],
    accuracyMeters: number | null,
    mode: 'gps' | 'preset' | 'manual',
    label: string
  ) => {
    setUserCoords(newCoords);
    setGpsAccuracy(accuracyMeters);
    setGpsSourceLabel(label);
    setGpsErrorDetail('');
    persistUserLocation(newCoords, mode, label, accuracyMeters);

    // Sinkronkan titik draft lapak jika pedagang belum memverifikasi/mengatur titik sendiri
    setLapaks(prev =>
      prev.map(item =>
        item.isMyLapak &&
        !item.isPublished &&
        item.lat === DEFAULT_COORDS[0] &&
        item.lng === DEFAULT_COORDS[1]
          ? { ...item, lat: newCoords[0], lng: newCoords[1] }
          : item
      )
    );

    if (mapInstanceRef.current && isMapVisibleRef.current) {
      mapInstanceRef.current.flyTo(newCoords, Math.max(mapInstanceRef.current.getZoom(), 16), {
        duration: 0.9,
      });
      pendingRecenterRef.current = false;
    } else {
      pendingRecenterRef.current = true;
    }
  };

  const handleAcquireRealGPS = (silent: boolean = false) => {
    if (!navigator.geolocation) {
      const msg = 'Sensor GPS tidak didukung di browser/perangkat ini';
      setGpsErrorDetail(msg);
      if (!silent) showNotification(msg);
      return;
    }

    stopGpsWatcher();
    setIsGpsAcquiring(true);
    setGpsErrorDetail('');
    if (!silent) showNotification('Mengunci sinyal GPS akurat perangkat...');

    let bestAccuracy = Infinity;
    let receivedAnyFix = false;
    let finished = false;

    const finishAcquisition = () => {
      if (finished) return;
      finished = true;
      stopGpsWatcher();
      setIsGpsAcquiring(false);
    };

    const handlePositionSuccess = (position: GeolocationPosition, isCoarseFallback = false) => {
      const { latitude, longitude, accuracy } = position.coords;
      const roundedAcc = Math.round(accuracy);
      const newCoords: [number, number] = [latitude, longitude];

      if (!receivedAnyFix || roundedAcc < bestAccuracy) {
        bestAccuracy = roundedAcc;
        receivedAnyFix = true;

        const qualityLabel =
          roundedAcc <= 35
            ? `GPS Akurat (±${roundedAcc}m)`
            : roundedAcc <= 250
            ? `GPS / Wi-Fi (±${roundedAcc}m)`
            : `Lokasi Jaringan (±${roundedAcc}m)`;

        applyResolvedCoords(newCoords, roundedAcc, 'gps', qualityLabel);

        if (!silent && !isCoarseFallback && roundedAcc <= 35) {
          showNotification(`Titik GPS akurat terkunci (±${roundedAcc}m)`);
        }
      }

      // Berhenti lebih awal begitu akurasi GPS sudah sangat presisi (<= 20m)
      if (roundedAcc <= 20) {
        finishAcquisition();
      }
    };

    const handleGpsFailure = (err: GeolocationPositionError, allowCoarseRetry: boolean) => {
      if (err.code === err.PERMISSION_DENIED) {
        const denyMsg =
          'Izin lokasi ditolak browser. Aktifkan izin Lokasi pada ikon gembok/setelan browser, atau pilih lokasi manual.';
        setGpsErrorDetail(denyMsg);
        setGpsSourceLabel('Izin GPS Ditolak (Pilih Manual)');
        finishAcquisition();
        if (!silent) showNotification(denyMsg);
        return;
      }

      // Jika mode high-accuracy gagal (mis. di dalam gedung / PC tanpa chip GPS), coba jaringan Wi-Fi/IP
      if (allowCoarseRetry && !receivedAnyFix) {
        navigator.geolocation.getCurrentPosition(
          pos => {
            handlePositionSuccess(pos, true);
            if (!silent) {
              showNotification(
                `Lokasi jaringan ditemukan (±${Math.round(pos.coords.accuracy)}m). Bisa disempurnakan di Peta.`
              );
            }
            finishAcquisition();
          },
          coarseErr => {
            const detail =
              coarseErr.code === coarseErr.TIMEOUT
                ? 'Sinyal lokasi habis waktu (timeout). Pastikan GPS aktif atau pilih titik di peta.'
                : 'Lokasi perangkat tidak tersedia saat ini. Gunakan "Tandai di Peta" atau input manual.';
            setGpsErrorDetail(detail);
            finishAcquisition();
            if (!silent) showNotification(detail);
          },
          { enableHighAccuracy: false, timeout: 10000, maximumAge: 0 }
        );
        return;
      }

      if (receivedAnyFix) {
        finishAcquisition();
      } else {
        const detail =
          err.code === err.TIMEOUT
            ? 'Sinyal GPS terlalu lama merespons. Coba di area terbuka atau tandai titik di peta.'
            : 'Lokasi perangkat tidak dapat dibaca saat ini.';
        setGpsErrorDetail(detail);
        finishAcquisition();
        if (!silent) showNotification(detail);
      }
    };

    try {
      const watchId = navigator.geolocation.watchPosition(
        pos => handlePositionSuccess(pos, false),
        err => handleGpsFailure(err, true),
        {
          enableHighAccuracy: true,
          timeout: 12000,
          maximumAge: 0,
        }
      );
      gpsWatchIdRef.current = watchId;

      // Jendela penyempurnaan GPS maksimal 7.5 detik agar tidak menguras baterai
      gpsStopTimerRef.current = window.setTimeout(() => {
        if (!receivedAnyFix) {
          handleGpsFailure(
            {
              code: 3,
              message: 'GPS refinement timeout',
              PERMISSION_DENIED: 1,
              POSITION_UNAVAILABLE: 2,
              TIMEOUT: 3,
            } as GeolocationPositionError,
            true
          );
        } else {
          if (!silent && bestAccuracy > 35) {
            showNotification(
              `Lokasi terkunci (±${Math.round(bestAccuracy)}m). Gunakan "Tandai di Peta" jika ingin presisi ke rumah.`
            );
          }
          finishAcquisition();
        }
      }, 7500);
    } catch {
      finishAcquisition();
    }
  };

  useEffect(() => {
    const mode = savedGpsMeta?.mode;
    const hasCoords = Boolean(localStorage.getItem('wargaqu_areaqu_user_coords'));
    // Selalu refresh GPS perangkat jika belum pernah disetel manual/preset, atau mode sebelumnya memang GPS
    if (!hasCoords || !mode || mode === 'gps') {
      handleAcquireRealGPS(true);
    }
    return () => {
      stopGpsWatcher();
    };
  }, []);

  useEffect(() => {
    if (showGpsModal) {
      setManualLatInput(userCoords[0].toFixed(6));
      setManualLngInput(userCoords[1].toFixed(6));
    }
  }, [showGpsModal, userCoords]);

  // ---------------------------------------------------------------------------
  // 7. COMPUTED DISTANCES & FILTERING
  // ---------------------------------------------------------------------------
  const computedLapaks = useMemo(() => {
    return lapaks.map(item => {
      const distanceMeter = calculateDistanceMeters(userCoords[0], userCoords[1], item.lat, item.lng);
      const speedRef = typeof item.speedKmh === 'number' && item.speedKmh > 2 ? (item.speedKmh * 1000) / 60 : 90;
      const etaMinutes = Math.max(1, Math.round(distanceMeter / speedRef));
      return {
        ...item,
        distanceMeter,
        etaMinutes
      };
    });
  }, [lapaks, userCoords]);

  const activeSelectedLapak = useMemo(() => {
    if (!selectedLapak) return null;
    return computedLapaks.find(l => l.id === selectedLapak.id) || selectedLapak;
  }, [computedLapaks, selectedLapak]);

  const filteredLapaks = useMemo(() => {
    return computedLapaks
      .filter(item => {
        if (item.isPublished === false) return false;
        const matchCategory = selectedCategory === 'all' ? true : item.category === selectedCategory;
        const isMobileVendor =
          item.status === 'keliling' ||
          item.lapakType === 'keliling' ||
          (item.rigType && item.rigType !== 'menetap');
        const motion = inferMotionState(item.speedKmh, item.motionState);
        const matchMotion =
          motionFilter === 'semua'
            ? true
            : motionFilter === 'keliling_live'
            ? isMobileVendor && item.status !== 'tutup'
            : isMobileVendor && motion === 'ngetem' && item.status !== 'tutup';

        const q = searchQuery.toLowerCase().trim();
        const matchSearch = q
          ? item.name.toLowerCase().includes(q) ||
            item.ownerName.toLowerCase().includes(q) ||
            item.description.toLowerCase().includes(q) ||
            item.address.toLowerCase().includes(q) ||
            (item.routeSchedule || '').toLowerCase().includes(q) ||
            item.catalog.some(p => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q))
          : true;
        const matchRadius = item.distanceMeter <= selectedRadius;
        return matchCategory && matchMotion && matchSearch && matchRadius;
      })
      .sort((a, b) => (a.distanceMeter ?? 0) - (b.distanceMeter ?? 0));
  }, [computedLapaks, selectedCategory, motionFilter, searchQuery, selectedRadius]);

  const favoriteLapaks = useMemo(() => {
    return computedLapaks.filter(l => favoriteIds.includes(l.id));
  }, [computedLapaks, favoriteIds]);

  const incomingOrderCount = useMemo(() => {
    const activeOrders = orders.filter(o => o.lapakId === myLapak.id && o.status !== 'selesai').length;
    const activePings = pings.filter(p => p.lapakId === myLapak.id && p.status !== 'selesai').length;
    return activeOrders + activePings;
  }, [orders, pings, myLapak.id]);

  // ---------------------------------------------------------------------------
  // 8. LEAFLET MAP INITIALIZATION & TAB SYNC
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container) return;

    if ((container as unknown as { _leaflet_id?: number })._leaflet_id) {
      delete (container as unknown as { _leaflet_id?: number })._leaflet_id;
    }

    let map: L.Map | null = null;
    try {
      map = L.map(container, {
        center: userCoords,
        zoom: 16,
        zoomControl: false,
        attributionControl: false
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        subdomains: ['a', 'b', 'c']
      }).addTo(map);

      const userIcon = L.divIcon({
        className: 'custom-user-marker',
        html: `
          <div style="position: relative; width: 38px; height: 38px; display: flex; align-items: center; justify-content: center;">
            <div style="position: absolute; width: 24px; height: 24px; border-radius: 9999px; background-color: #047857; border: 3px solid #ffffff; box-shadow: 0 4px 8px rgba(0,0,0,0.35); display: flex; align-items: center; justify-content: center;">
              <div style="width: 8px; height: 8px; border-radius: 9999px; background-color: #5eead4;"></div>
            </div>
          </div>
        `,
        iconSize: [38, 38],
        iconAnchor: [19, 19]
      });

      const userMarker = L.marker(userCoords, { icon: userIcon, zIndexOffset: 1000 })
        .addTo(map)
        .bindTooltip('Titik Lokasi Anda', { permanent: false, direction: 'top' });

      userMarkerRef.current = userMarker;

      const circle = L.circle(userCoords, {
        radius: selectedRadius,
        color: '#059669',
        weight: 1.5,
        fillColor: '#10b981',
        fillOpacity: 0.1,
        dashArray: '5, 8'
      }).addTo(map);

      radarCircleRef.current = circle;

      const showInitialAcc = Boolean(gpsAccuracy && gpsAccuracy > 15 && gpsAccuracy <= 5000);
      const accCircle = L.circle(userCoords, {
        radius: showInitialAcc ? gpsAccuracy! : 0,
        color: '#0284c7',
        weight: 1,
        opacity: showInitialAcc ? 0.55 : 0,
        fillColor: '#38bdf8',
        fillOpacity: showInitialAcc ? 0.14 : 0,
      }).addTo(map);
      gpsAccuracyCircleRef.current = accCircle;

      const markersLayer = L.layerGroup().addTo(map);
      markersLayerRef.current = markersLayer;

      map.on('click', (e: L.LeafletMouseEvent) => {
        const clickedLat = Number(e.latlng.lat.toFixed(6));
        const clickedLng = Number(e.latlng.lng.toFixed(6));

        if (isSettingLapakPinRef.current) {
          setLapaks(prev =>
            prev.map(item =>
              item.isMyLapak ? { ...item, lat: clickedLat, lng: clickedLng } : item
            )
          );
          setIsSettingLapakPinOnMap(false);
          setActiveTab('lapak');
          showNotification(`Pin lokasi lapak dipasang di ${clickedLat}, ${clickedLng}`);
          return;
        }

        // Hanya ubah titik pengguna bila user sengaja mengaktifkan mode "Tandai Lokasi Saya di Peta"
        if (isSettingUserPinRef.current) {
          setIsSettingUserPinOnMap(false);
          applyResolvedCoords(
            [clickedLat, clickedLng],
            null,
            'manual',
            `Pin Peta (${clickedLat.toFixed(4)}, ${clickedLng.toFixed(4)})`
          );
          showNotification(`Lokasi Anda ditetapkan di ${clickedLat}, ${clickedLng}`);
        }
      });

      mapInstanceRef.current = map;

      setTimeout(() => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize();
        }
      }, 250);
    } catch (err) {
      console.error('Leaflet initialization error:', err);
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
      if (container && (container as unknown as { _leaflet_id?: number })._leaflet_id) {
        delete (container as unknown as { _leaflet_id?: number })._leaflet_id;
      }
    };
  }, []);

  // Refresh Leaflet layout & recenter kamera saat kembali ke Jelajah -> Peta
  useEffect(() => {
    if (activeTab === 'jelajah' && jelajahSubMode === 'peta' && mapInstanceRef.current) {
      setTimeout(() => {
        const map = mapInstanceRef.current;
        if (!map) return;
        map.invalidateSize();
        if (pendingRecenterRef.current) {
          map.setView(userCoords, Math.max(map.getZoom(), 16), { animate: false });
          pendingRecenterRef.current = false;
        }
      }, 90);
    }
  }, [activeTab, jelajahSubMode, userCoords]);

  useEffect(() => {
    if (userMarkerRef.current) {
      userMarkerRef.current.setLatLng(userCoords);
    }
    if (radarCircleRef.current) {
      radarCircleRef.current.setLatLng(userCoords);
      radarCircleRef.current.setRadius(selectedRadius);
    }
    if (gpsAccuracyCircleRef.current) {
      gpsAccuracyCircleRef.current.setLatLng(userCoords);
      const showAcc = Boolean(gpsAccuracy && gpsAccuracy > 15 && gpsAccuracy <= 5000);
      gpsAccuracyCircleRef.current.setRadius(showAcc ? gpsAccuracy! : 0);
      gpsAccuracyCircleRef.current.setStyle({
        fillOpacity: showAcc ? 0.14 : 0,
        opacity: showAcc ? 0.55 : 0,
      });
    }
  }, [userCoords, selectedRadius, gpsAccuracy]);

  // Render Lapak Markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    const markersLayer = markersLayerRef.current;
    if (!map || !markersLayer) return;

    markersLayer.clearLayers();

    filteredLapaks.forEach(lapak => {
      let badgeBg = '#059669';
      if (lapak.category === 'warung') badgeBg = '#d97706';
      else if (lapak.category === 'bengkel') badgeBg = '#0284c7';
      else if (lapak.category === 'pkl') badgeBg = '#ea580c';
      else if (lapak.category === 'keliling') badgeBg = '#7c3aed';
      else if (lapak.category === 'jasa') badgeBg = '#0d9488';
      else if (lapak.category === 'transportasi') badgeBg = '#16a34a';

      const isSelected = activeSelectedLapak?.id === lapak.id;
      const isMine = lapak.isMyLapak;
      const isMobile =
        lapak.status === 'keliling' ||
        lapak.lapakType === 'keliling' ||
        (lapak.rigType && lapak.rigType !== 'menetap');
      const motion = inferMotionState(lapak.speedKmh, lapak.motionState);
      const rigMeta = getRigMeta(lapak.rigType);
      const roundedSpeed = typeof lapak.speedKmh === 'number' ? Math.round(lapak.speedKmh) : null;

      let ringColor = '#ffffff';
      let speedChipBg = '';
      let speedChipLabel = '';
      let showPulseHalo = false;

      if (isMobile && lapak.status !== 'tutup') {
        if (motion === 'melaju') {
          badgeBg = '#6d28d9';
          ringColor = '#ddd6fe';
          speedChipBg = '#5b21b6';
          speedChipLabel = roundedSpeed && roundedSpeed >= 10 ? `${roundedSpeed} km/j` : 'Melaju';
          showPulseHalo = true;
        } else if (motion === 'pelan') {
          badgeBg = '#d97706';
          ringColor = '#fef3c7';
          speedChipBg = '#b45309';
          speedChipLabel = roundedSpeed && roundedSpeed >= 2 ? `${roundedSpeed} km/j` : 'Pelan';
        } else {
          badgeBg = '#059669';
          ringColor = '#d1fae5';
          speedChipBg = '#047857';
          speedChipLabel = 'Ngetem';
        }
      }

      const headingArrow =
        isMobile && motion === 'melaju' && typeof lapak.headingDeg === 'number'
          ? `<div style="position:absolute; top:-9px; left:50%; transform:translateX(-50%) rotate(${Math.round(lapak.headingDeg)}deg); color:#4c1d95; font-size:11px; font-weight:900; text-shadow:0 0 2px #fff;">▲</div>`
          : '';

      const rigMiniCorner =
        isMobile && lapak.rigType && lapak.rigType !== 'menetap'
          ? `<span style="position:absolute; top:-5px; right:-6px; width:18px; height:18px; border-radius:9999px; background:#ffffff; border:1px solid #cbd5e1; display:flex; align-items:center; justify-content:center; font-size:10px; box-shadow:0 1px 3px rgba(0,0,0,0.2);">${rigMeta.icon}</span>`
          : '';

      const pulseHaloHtml = showPulseHalo
        ? `<div style="position:absolute; inset:-6px; border-radius:9999px; border:2px solid #8b5cf6; opacity:0.55; pointer-events:none;"></div>`
        : '';

      const bottomPillHtml = isMine
        ? `<span style="position: absolute; bottom: -9px; left: 50%; transform: translateX(-50%); background: #facc15; color: #1e293b; font-size: 8px; font-weight: 900; padding: 1px 4px; border-radius: 4px; border: 1px solid #ffffff; white-space: nowrap;">${isMobile && speedChipLabel ? `Saya · ${speedChipLabel}` : 'Lapak Saya'}</span>`
        : speedChipLabel
        ? `<span style="position: absolute; bottom: -9px; left: 50%; transform: translateX(-50%); background: ${speedChipBg}; color: #ffffff; font-size: 8px; font-weight: 800; padding: 1px 5px; border-radius: 9999px; border: 1px solid #ffffff; white-space: nowrap; box-shadow: 0 2px 4px rgba(0,0,0,0.25);">${speedChipLabel}</span>`
        : '';

      const markerHtml = `
        <div style="position: relative; cursor: pointer;" class="${isSelected ? 'scale-125' : ''}">
          ${pulseHaloHtml}
          ${headingArrow}
          <div style="
            background: ${isMine ? '#10b981' : badgeBg};
            color: white;
            border-radius: 9999px;
            width: ${isMine ? '40px' : isMobile ? '36px' : '32px'};
            height: ${isMine ? '40px' : isMobile ? '36px' : '32px'};
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: ${isMine ? '18px' : '16px'};
            border: ${isMine ? '3px solid #facc15' : `2.5px solid ${ringColor}`};
            box-shadow: 0 4px 8px rgba(0,0,0,0.35);
          ">
            ${lapak.avatarIcon}
          </div>
          ${rigMiniCorner}
          ${bottomPillHtml}
        </div>
      `;

      const customIcon = L.divIcon({
        className: 'lapak-custom-marker',
        html: markerHtml,
        iconSize: [40, 40],
        iconAnchor: [20, 20]
      });

      const marker = L.marker([lapak.lat, lapak.lng], { icon: customIcon });

      marker.on('click', () => {
        setSelectedLapak(lapak);
        if (routePolylineRef.current) {
          map.removeLayer(routePolylineRef.current);
        }
        const polyline = L.polyline([userCoords, [lapak.lat, lapak.lng]], {
          color: isMobile ? '#6d28d9' : '#059669',
          weight: 4,
          opacity: 0.85,
          dashArray: '8, 8'
        }).addTo(map);
        routePolylineRef.current = polyline;
        map.panTo([lapak.lat, lapak.lng]);
      });

      markersLayer.addLayer(marker);
    });
  }, [filteredLapaks, activeSelectedLapak?.id, userCoords]);

  const handleRecenter = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo(userCoords, 16, { duration: 0.8 });
      showNotification('Peta dipusatkan ke koordinat GPS Anda');
    }
  };

  const handleZoom = (delta: number) => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setZoom(mapInstanceRef.current.getZoom() + delta);
    }
  };

  // ---------------------------------------------------------------------------
  // 9. IDENTITY HANDLERS
  // ---------------------------------------------------------------------------
  const handleSaveConsumerIdentity = (updated: ConsumerIdentity) => {
    setConsumerIdentity(updated);
    showNotification('Identitas Calon Konsumen berhasil disimpan & diverifikasi!');
  };

  const handleSaveMerchantIdentity = (updated: MerchantIdentity) => {
    const applyMerchant = () => {
      setMerchantIdentity(updated);
      let syncedLapak: LapakItem | null = null;
      setLapaks(prev =>
        prev.map(item => {
          if (!item.isMyLapak) return item;
          syncedLapak = {
            ...item,
            name: updated.lapakName,
            ownerName: updated.ownerName,
            ownerWargaId: updated.wargaId,
            rtRw: updated.rtRw,
            isVerifiedWarga: updated.isVerified,
            lapakType: updated.lapakType,
            rigType: updated.rigType || (updated.lapakType === 'keliling' ? 'gerobak' : 'menetap'),
            routeSchedule: updated.routeSchedule || item.routeSchedule || '',
            category: updated.category,
            categoryLabel: getCategoryLabel(updated.category),
            address: updated.baseAddress,
            phone: updated.phone,
            operationalHours: updated.operationalHours,
            description: updated.description,
            avatarIcon: updated.avatarIcon,
            vehicleType: updated.vehicleType,
            status: updated.lapakType === 'keliling' && item.status === 'tutup' ? 'keliling' : item.status,
            isPublished: true
          };
          return syncedLapak;
        })
      );
      if (syncedLapak) {
        RealtimeRelayService.publish(RealtimeRelayService.getRtChannel(), 'areaqu:lapak_sync', {
          lapak: syncedLapak,
        });
      }
      showNotification('Identitas Pedagang & profil lapak berhasil diterbitkan!');
    };

    runWithLapakFeeGate('Sewa & Terbitkan Lapak AreaQu', applyMerchant);
  };

  // ---------------------------------------------------------------------------
  // 10. PEDAGANG ACTIONS
  // ---------------------------------------------------------------------------
  const handleSyncLapakWithMyGPS = () => {
    if (!merchantIdentity.isVerified) {
      showNotification('Lengkapi Identitas Pedagang sebelum membagikan lokasi lapak');
      setIdentitySubTab('pedagang');
      setActiveTab('identitas');
      return;
    }
    runWithLapakFeeGate('Aktifkan Lokasi Radar Lapak AreaQu', () => {
      const updatedLapak = {
        ...myLapak,
        lat: userCoords[0],
        lng: userCoords[1],
        isPublished: true,
      };
      setLapaks(prev =>
        prev.map(item =>
          item.id === myLapak.id ? updatedLapak : item
        )
      );
      RealtimeRelayService.publish(RealtimeRelayService.getRtChannel(), 'areaqu:lapak_sync', {
        lapak: updatedLapak,
      });
      showNotification('Lokasi Lapak Digital disinkronkan dengan titik GPS Anda!');
      if (mapInstanceRef.current && isMapVisibleRef.current) {
        mapInstanceRef.current.panTo(userCoords);
      } else {
        pendingRecenterRef.current = true;
      }
    });
  };

  const stopKelilingBroadcast = (silent = false) => {
    if (kelilingWatchIdRef.current !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(kelilingWatchIdRef.current);
      kelilingWatchIdRef.current = null;
    }
    setIsKelilingLive(false);
    if (!silent) {
      showNotification('Siaran GPS Keliling dihentikan');
    }
  };

  useEffect(() => {
    return () => {
      if (kelilingWatchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(kelilingWatchIdRef.current);
      }
    };
  }, []);

  const handleToggleKelilingLive = () => {
    if (!merchantIdentity.isVerified) {
      showNotification('Lengkapi Identitas Pedagang sebelum mengaktifkan Live Keliling');
      setIdentitySubTab('pedagang');
      setActiveTab('identitas');
      return;
    }
    if (isKelilingLive) {
      stopKelilingBroadcast(false);
      return;
    }
    if (!navigator.geolocation) {
      showNotification('Browser/perangkat tidak mendukung pelacakan GPS live');
      return;
    }

    runWithLapakFeeGate('Aktifkan Live Radar Pedagang Keliling', () => {
      setIsKelilingLive(true);
      manualMotionOverrideRef.current = null;
      lastBroadcastSentRef.current = null;
      lastSpeedSampleRef.current = null;
      showNotification('Live GPS Keliling aktif! Posisi & kecepatan Anda disiarkan real-time.');

      kelilingWatchIdRef.current = navigator.geolocation.watchPosition(
        pos => {
          const { latitude, longitude, speed, heading } = pos.coords;
          const now = Date.now();
          let computedSpeedKmh: number | undefined =
            typeof speed === 'number' && !isNaN(speed) && speed >= 0
              ? Number((speed * 3.6).toFixed(1))
              : undefined;

          if (computedSpeedKmh === undefined && lastSpeedSampleRef.current) {
            const dtSec = (now - lastSpeedSampleRef.current.time) / 1000;
            if (dtSec >= 1.5) {
              const distM = calculateDistanceMeters(
                lastSpeedSampleRef.current.lat,
                lastSpeedSampleRef.current.lng,
                latitude,
                longitude
              );
              computedSpeedKmh = Number(((distM / dtSec) * 3.6).toFixed(1));
            }
          }
          lastSpeedSampleRef.current = { lat: latitude, lng: longitude, time: now };

          const nextMotion = manualMotionOverrideRef.current
            ? manualMotionOverrideRef.current
            : inferMotionState(computedSpeedKmh, myLapak.motionState);

          const updatedLapak: LapakItem = {
            ...myLapak,
            lat: latitude,
            lng: longitude,
            speedKmh: computedSpeedKmh ?? myLapak.speedKmh ?? 0,
            headingDeg: typeof heading === 'number' && !isNaN(heading) ? heading : myLapak.headingDeg,
            motionState: nextMotion,
            lastLocationAt: now,
            status: 'keliling',
            isPublished: true,
          };

          setLapaks(prev => prev.map(item => (item.id === myLapak.id ? updatedLapak : item)));
          setUserCoords([latitude, longitude]);

          const lastSent = lastBroadcastSentRef.current;
          const movedSinceSend = lastSent
            ? calculateDistanceMeters(lastSent.lat, lastSent.lng, latitude, longitude)
            : 999;
          const elapsedSinceSend = lastSent ? now - lastSent.time : 99999;

          if (elapsedSinceSend >= 4000 || movedSinceSend >= 12) {
            lastBroadcastSentRef.current = { lat: latitude, lng: longitude, time: now };
            RealtimeRelayService.publish(RealtimeRelayService.getRtChannel(), 'areaqu:lapak_sync', {
              lapak: updatedLapak,
            });
          }
        },
        err => {
          if (err.code === err.PERMISSION_DENIED) {
            showNotification('Izin GPS ditolak. Aktifkan lokasi browser untuk mode keliling live.');
            stopKelilingBroadcast(true);
          }
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    });
  };

  const handleSwitchMotionState = (mode: MotionState) => {
    if (!merchantIdentity.isVerified) {
      showNotification('Lengkapi Identitas Pedagang dahulu');
      setIdentitySubTab('pedagang');
      setActiveTab('identitas');
      return;
    }
    manualMotionOverrideRef.current = mode;
    const presetSpeed = mode === 'ngetem' ? 0 : mode === 'pelan' ? 4 : 18;
    const updatedLapak: LapakItem = {
      ...myLapak,
      status: 'keliling',
      motionState: mode,
      speedKmh: presetSpeed,
      lastLocationAt: Date.now(),
      isPublished: true,
    };
    setLapaks(prev => prev.map(item => (item.id === myLapak.id ? updatedLapak : item)));
    RealtimeRelayService.publish(RealtimeRelayService.getRtChannel(), 'areaqu:lapak_sync', {
      lapak: updatedLapak,
    });
    const label = mode === 'ngetem' ? 'Ngetem / Mangkal' : mode === 'pelan' ? 'Jalan Pelan' : 'Melaju Motor';
    showNotification(`Ikon peta disetel ke: ${label}`);
  };

  const handleSendKelilingAnnounce = () => {
    if (!merchantIdentity.isVerified) {
      showNotification('Lengkapi Identitas Pedagang sebelum mengumumkan');
      return;
    }
    runWithLapakFeeGate('Kirim Pengumuman Keliling ke Warga', () => {
      const rigMeta = getRigMeta(myLapak.rigType);
      const noteText =
        broadcastNoteInput.trim() ||
        myLapak.routeSchedule ||
        `${myLapak.name} sedang keliling siap mampir di sekitar Anda!`;
      const updatedLapak: LapakItem = {
        ...myLapak,
        status: 'keliling',
        liveBroadcastNote: noteText,
        routeSchedule: routeScheduleDraft.trim(),
        isPublished: true,
        lastLocationAt: Date.now(),
      };
      setLapaks(prev => prev.map(item => (item.id === myLapak.id ? updatedLapak : item)));
      RealtimeRelayService.publish(RealtimeRelayService.getRtChannel(), 'areaqu:lapak_sync', {
        lapak: updatedLapak,
      });
      RealtimeRelayService.publish(RealtimeRelayService.getRtChannel(), 'areaqu:keliling_announce', {
        lapakId: updatedLapak.id,
        lapakName: updatedLapak.name,
        lapakIcon: updatedLapak.avatarIcon,
        ownerName: updatedLapak.ownerName,
        rigLabel: rigMeta.label,
        note: noteText,
        lat: updatedLapak.lat,
        lng: updatedLapak.lng,
        sentAt: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
      });
      setBroadcastNoteInput('');
      showNotification('Pengumuman keliling disiarkan ke warga di sekitar Anda!');
    });
  };

  const handleSaveRouteSchedule = () => {
    const updatedLapak: LapakItem = {
      ...myLapak,
      routeSchedule: routeScheduleDraft.trim(),
    };
    setLapaks(prev => prev.map(item => (item.id === myLapak.id ? updatedLapak : item)));
    setMerchantIdentity(prev => ({ ...prev, routeSchedule: routeScheduleDraft.trim() }));
    if (updatedLapak.isPublished) {
      RealtimeRelayService.publish(RealtimeRelayService.getRtChannel(), 'areaqu:lapak_sync', {
        lapak: updatedLapak,
      });
    }
    showNotification('Jadwal rute & jam keliling disimpan!');
  };

  const handleToggleLapakStatus = (newStatus: 'buka' | 'keliling' | 'tutup') => {
    if (!merchantIdentity.isVerified) {
      showNotification('Verifikasi Identitas Pedagang dahulu sebelum mengubah status lapak');
      setIdentitySubTab('pedagang');
      setActiveTab('identitas');
      return;
    }
    if (newStatus !== 'keliling' && isKelilingLive) {
      stopKelilingBroadcast(true);
    }
    const updatedLapak: LapakItem = {
      ...myLapak,
      status: newStatus,
      motionState: newStatus === 'buka' ? 'ngetem' : myLapak.motionState,
      speedKmh: newStatus === 'buka' ? 0 : myLapak.speedKmh,
    };
    setLapaks(prev => prev.map(item => (item.id === myLapak.id ? updatedLapak : item)));
    if (updatedLapak.isPublished) {
      RealtimeRelayService.publish(RealtimeRelayService.getRtChannel(), 'areaqu:lapak_sync', {
        lapak: updatedLapak,
      });
    }
    showNotification(`Status Lapak diubah menjadi: ${newStatus.toUpperCase()}`);
  };

  const handleToggleLapakPublished = () => {
    if (!merchantIdentity.isVerified) {
      showNotification('Lengkapi Identitas Pedagang untuk mempublikasikan lapak di peta');
      setIdentitySubTab('pedagang');
      setActiveTab('identitas');
      return;
    }
    const nextPublished = !(myLapak.isPublished ?? true);
    const applyToggle = () => {
      const updatedLapak = { ...myLapak, isPublished: nextPublished };
      setLapaks(prev =>
        prev.map(item => (item.id === myLapak.id ? updatedLapak : item))
      );
      RealtimeRelayService.publish(RealtimeRelayService.getRtChannel(), 'areaqu:lapak_sync', {
        lapak: updatedLapak,
      });
      showNotification(
        nextPublished
          ? 'Lapak aktif & lokasi terlihat oleh WargaQu'
          : 'Lapak disembunyikan sementara dari radar peta'
      );
    };
    if (nextPublished) {
      runWithLapakFeeGate('Sewa Tayang Lapak di Peta AreaQu', applyToggle);
    } else {
      applyToggle();
    }
  };

  const handleShareMyLapak = async () => {
    if (!merchantIdentity.isVerified) {
      showNotification('Lengkapi Identitas Pedagang sebelum membagikan lapak');
      setIdentitySubTab('pedagang');
      setActiveTab('identitas');
      return;
    }
    const shareText = `Lapak AreaQu WargaQu\n${myLapak.avatarIcon} ${myLapak.name}\nPemilik: ${myLapak.ownerName}${myLapak.rtRw ? ` (${myLapak.rtRw})` : ''}\nStatus: ${myLapak.status.toUpperCase()}\nLokasi: ${myLapak.address} (${myLapak.lat.toFixed(5)}, ${myLapak.lng.toFixed(5)})\nKatalog: ${myLapak.catalog.length} menu siap pesan.`;
    if (navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(shareText);
        showNotification('Info & koordinat lapak disalin! Siap dibagikan ke grup RT/ChatQu.');
        return;
      } catch {
        // fallback below
      }
    }
    showNotification('Info lapak siap dibagikan ke warga sekitar.');
  };

  const handleImportMenuFromUsahaQu = () => {
    if (!menuList || menuList.length === 0) {
      showNotification('Tidak ada menu di UsahaQu POS untuk diimpor');
      return;
    }
    const importedProducts: CatalogProduct[] = menuList.map(item => ({
      id: 'prod-' + item.id + '-' + Date.now().toString().slice(-4),
      name: item.name,
      price: item.price,
      category:
        item.category === 'bakso_kuah' ? 'Makanan' : item.category === 'minuman' ? 'Minuman' : 'Pelengkap',
      description: item.description,
      imageUrl: item.imageUrl,
      isAvailable: item.isAvailable
    }));

    setLapaks(prev =>
      prev.map(item => {
        if (item.id === myLapak.id) {
          const existingNames = new Set(item.catalog.map(c => c.name.toLowerCase()));
          const newToAdd = importedProducts.filter(p => !existingNames.has(p.name.toLowerCase()));
          return { ...item, catalog: [...item.catalog, ...newToAdd] };
        }
        return item;
      })
    );
    showNotification('Menu UsahaQu POS berhasil diimpor ke Katalog Lapak!');
  };

  const handleAddNewProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProductName.trim()) {
      showNotification('Nama produk wajib diisi');
      return;
    }
    const priceNum = parseInt(newProductPrice.replace(/\D/g, ''), 10) || 0;
    if (priceNum <= 0) {
      showNotification('Harga produk harus lebih dari 0');
      return;
    }
    const newProd: CatalogProduct = {
      id: 'prod-' + Date.now(),
      name: newProductName.trim(),
      price: priceNum,
      category: newProductCategory,
      description: newProductDesc.trim() || 'Menu andalan segar siap disajikan.',
      isAvailable: true
    };
    setLapaks(prev =>
      prev.map(item =>
        item.id === myLapak.id ? { ...item, catalog: [newProd, ...item.catalog] } : item
      )
    );
    setNewProductName('');
    setNewProductPrice('');
    setNewProductDesc('');
    setShowAddProductModal(false);
    showNotification(`Produk "${newProd.name}" ditambahkan ke katalog lapak!`);
  };

  const handleDeleteProduct = (productId: string) => {
    setLapaks(prev =>
      prev.map(item =>
        item.id === myLapak.id
          ? { ...item, catalog: item.catalog.filter(p => p.id !== productId) }
          : item
      )
    );
    showNotification('Produk dihapus dari katalog');
  };

  const handleToggleProductAvailability = (productId: string) => {
    setLapaks(prev =>
      prev.map(item =>
        item.id === myLapak.id
          ? {
              ...item,
              catalog: item.catalog.map(p =>
                p.id === productId ? { ...p, isAvailable: !p.isAvailable } : p
              )
            }
          : item
      )
    );
  };

  // ---------------------------------------------------------------------------
  // 11. CHAT, FAVORITE & ORDER CHECKOUT WITH IDENTITY GATE
  // ---------------------------------------------------------------------------
  const handleToggleFavorite = (lapakId: string) => {
    setFavoriteIds(prev => {
      const exists = prev.includes(lapakId);
      const next = exists ? prev.filter(id => id !== lapakId) : [...prev, lapakId];
      showNotification(exists ? 'Dihapus dari Lapak Favorit' : 'Disimpan ke Lapak Favorit');
      return next;
    });
  };

  const handleOpenChatWithLapak = (lapak: LapakItem, prefilledOrderText?: string) => {
    setSelectedLapak(lapak);
    const senderLabel = consumerIdentity.isVerified
      ? `${consumerIdentity.fullName} (${consumerIdentity.rtRw})`
      : 'Warga AreaQu';
    const initialText =
      prefilledOrderText ||
      `Halo ${lapak.name}, saya ${senderLabel} ingin menanyakan katalog produk yang tersedia hari ini.`;

    setChatMessages([
      {
        sender: 'merchant',
        text: `Halo! Selamat datang di ${lapak.name} (${lapak.ownerName}). Silakan tanyakan stok atau kirim pesanan antar ke teras rumah.`,
        time: 'Baru saja'
      },
      {
        sender: 'user',
        text: initialText,
        time: 'Baru saja'
      }
    ]);
    setShowChatModal(true);
  };

  const handleSendChatMessage = () => {
    if (!chatInputText.trim()) return;
    const msgTime = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    const text = chatInputText.trim();
    const userMsg = {
      sender: 'user' as const,
      text,
      time: msgTime
    };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInputText('');

    if (selectedLapak) {
      RealtimeRelayService.publish(RealtimeRelayService.getRtChannel(), 'areaqu:chat', {
        lapakId: selectedLapak.id,
        senderRole: selectedLapak.isMyLapak ? 'merchant' : 'user',
        senderName: consumerIdentity.fullName || 'Warga',
        text,
        time: msgTime,
      });
    }
  };

  const activeCatalog = selectedLapak?.catalog || [];
  const cartSubtotal = useMemo(() => {
    return Object.entries(cartItems).reduce((sum, [prodId, qty]) => {
      const prod = activeCatalog.find(p => p.id === prodId);
      return sum + (prod ? prod.price * qty : 0);
    }, 0);
  }, [cartItems, activeCatalog]);

  const handleOpenWhatsApp = (phone: string, text: string) => {
    const cleanPhone = phone.replace(/\D/g, '');
    const intlPhone = cleanPhone.startsWith('0') ? '62' + cleanPhone.slice(1) : cleanPhone;
    const url = `https://wa.me/${intlPhone}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  const executeOrderCheckout = (channel: 'areaqu' | 'whatsapp', verifiedConsumer: ConsumerIdentity) => {
    if (!selectedLapak) return;

    const orderedItems = Object.entries(cartItems)
      .filter(([, qty]) => qty > 0)
      .map(([prodId, qty]) => {
        const prod = activeCatalog.find(p => p.id === prodId);
        return {
          id: prodId,
          name: prod?.name || 'Produk',
          qty,
          price: prod?.price || 0
        };
      });

    if (orderedItems.length === 0) {
      showNotification('Silakan pilih minimal 1 produk di katalog');
      return;
    }

    const isPreorder = orderKind === 'preorder';
    const newOrder: AreaOrderItem = {
      id: 'ORD-' + Date.now().toString().slice(-6),
      lapakId: selectedLapak.id,
      lapakName: selectedLapak.name,
      lapakIcon: selectedLapak.avatarIcon,
      lapakOwner: selectedLapak.ownerName,
      consumerName: verifiedConsumer.fullName,
      consumerWargaId: verifiedConsumer.wargaId,
      consumerRtRw: verifiedConsumer.rtRw,
      consumerAddress: verifiedConsumer.addressDetail,
      consumerLandmark: verifiedConsumer.landmark,
      consumerPhone: verifiedConsumer.phone,
      items: orderedItems,
      total: cartSubtotal,
      note: '',
      status: 'menunggu',
      orderKind,
      scheduledSlot: isPreorder ? scheduledSlot.trim() || 'Putaran Berikutnya' : undefined,
      channel,
      createdAt: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
      coords: verifiedConsumer.shareExactLocationOnOrder ? userCoords : undefined
    };

    setOrders(prev => [newOrder, ...prev]);

    RealtimeRelayService.publish(RealtimeRelayService.getRtChannel(), 'order:areaqu', {
      order: newOrder,
      lapakId: newOrder.lapakId,
      lapakName: newOrder.lapakName,
      consumerName: newOrder.consumerName,
    });

    const areaRule = MonetizationService.getRule('areaqu_lapak');
    if (areaRule.enabled && areaRule.feeMode !== 'flat') {
      MonetizationService.recordCharge({
        moduleId: 'areaqu_lapak',
        actionLabel: `Order AreaQu (${selectedLapak.name})`,
        grossAmount: cartSubtotal,
      });
    }

    const orderedLines = orderedItems.map(
      i => `- ${i.name} (${i.qty}x) = Rp ${(i.price * i.qty).toLocaleString('id-ID')}`
    );
    const gpsNote = verifiedConsumer.shareExactLocationOnOrder
      ? `\nTitik GPS Antar: ${userCoords[0].toFixed(5)}, ${userCoords[1].toFixed(5)}`
      : '';
    const orderTypeHeader = isPreorder
      ? `[PRE-ORDER JAM LEWAT: ${newOrder.scheduledSlot}]\n`
      : '';
    const orderText = `${orderTypeHeader}Pesanan AreaQu (${newOrder.id})\nPembeli: ${verifiedConsumer.fullName} (${verifiedConsumer.wargaId} - ${verifiedConsumer.rtRw})\nWA: ${verifiedConsumer.phone}\nAlamat Antar: ${verifiedConsumer.addressDetail}${verifiedConsumer.landmark ? ` (${verifiedConsumer.landmark})` : ''}${gpsNote}\n\nDaftar Pesanan:\n${orderedLines.join('\n')}\nTotal: Rp ${cartSubtotal.toLocaleString('id-ID')}`;

    setShowKatalogModal(false);
    setCartItems({});
    setOrderKind('langsung');

    if (channel === 'areaqu') {
      showNotification(
        isPreorder
          ? 'Pre-Order jadwal lewat tercatat & dikirim ke pedagang!'
          : 'Pesanan tercatat di Aktivitas & dikirim ke pedagang!'
      );
      handleOpenChatWithLapak(selectedLapak, orderText);
    } else {
      showNotification('Pesanan tercatat di Aktivitas! Membuka WhatsApp pedagang...');
      handleOpenWhatsApp(selectedLapak.phone, orderText);
    }
  };

  const handleCheckoutWithIdentityGate = (channel: 'areaqu' | 'whatsapp') => {
    if (cartSubtotal <= 0) {
      showNotification('Silakan pilih minimal 1 produk di katalog');
      return;
    }
    const isComplete =
      consumerIdentity.isVerified &&
      consumerIdentity.fullName.trim().length > 0 &&
      consumerIdentity.phone.trim().length > 0 &&
      consumerIdentity.addressDetail.trim().length > 0;

    if (!isComplete) {
      setGateName(consumerIdentity.fullName);
      setGatePhone(consumerIdentity.phone);
      setGateRtRw(consumerIdentity.rtRw);
      setGateAddress(consumerIdentity.addressDetail);
      setGateLandmark(consumerIdentity.landmark);
      setPendingCheckoutChannel(channel);
      setShowConsumerGateModal(true);
      return;
    }

    executeOrderCheckout(channel, consumerIdentity);
  };

  const handleSubmitConsumerGate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!gateName.trim() || !gatePhone.trim() || !gateAddress.trim()) {
      showNotification('Nama, nomor WhatsApp, dan alamat antar wajib diisi');
      return;
    }
    const updated: ConsumerIdentity = {
      ...consumerIdentity,
      fullName: gateName.trim(),
      phone: gatePhone.trim(),
      rtRw: gateRtRw.trim() || 'Lingkungan Warga',
      addressDetail: gateAddress.trim(),
      landmark: gateLandmark.trim(),
      isVerified: true,
      updatedAt: new Date().toISOString()
    };
    setConsumerIdentity(updated);
    setShowConsumerGateModal(false);
    if (pendingCheckoutChannel) {
      executeOrderCheckout(pendingCheckoutChannel, updated);
      setPendingCheckoutChannel(null);
    }
  };

  const handleUpdateOrderStatus = (orderId: string, status: OrderStatus) => {
    setOrders(prev => prev.map(o => (o.id === orderId ? { ...o, status } : o)));
    RealtimeRelayService.publish(RealtimeRelayService.getRtChannel(), 'order:areaqu_status', {
      orderId,
      status,
    });
    showNotification(`Status pesanan ${orderId} diperbarui: ${status.toUpperCase()}`);
  };

  const handleUpdatePingStatus = (pingId: string, status: KelilingPingStatus) => {
    setPings(prev => prev.map(p => (p.id === pingId ? { ...p, status } : p)));
    RealtimeRelayService.publish(RealtimeRelayService.getRtChannel(), 'areaqu:keliling_ping_status', {
      pingId,
      status,
    });
    const label = status === 'otw' ? 'OTW MAMPIR' : status === 'sampai' ? 'SUDAH SAMPAI' : 'SELESAI';
    showNotification(`Status panggilan diperbarui: ${label}`);
  };

  const handleSendKelilingPing = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSelectedLapak) return;

    const senderName = consumerIdentity.fullName?.trim() || 'Warga Sekitar';
    const senderAddr = consumerIdentity.addressDetail?.trim() || gpsSourceLabel || 'Lokasi GPS Sekitar';

    const newPing: KelilingPingItem = {
      id: 'PNG-' + Date.now().toString().slice(-6),
      lapakId: activeSelectedLapak.id,
      lapakName: activeSelectedLapak.name,
      lapakIcon: activeSelectedLapak.avatarIcon,
      lapakOwner: activeSelectedLapak.ownerName,
      senderName,
      senderAddress: senderAddr,
      senderLandmark: consumerIdentity.landmark || '',
      senderPhone: consumerIdentity.phone || '',
      note: pingNoteInput.trim() || 'Mohon mampir sebentar ke depan rumah / titik saya.',
      status: 'menunggu',
      createdAt: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
      timestamp: Date.now(),
      coords: pingShareCoords ? userCoords : undefined,
    };

    setPings(prev => [newPing, ...prev]);
    RealtimeRelayService.publish(RealtimeRelayService.getRtChannel(), 'areaqu:keliling_ping', {
      ping: newPing,
    });
    setPingNoteInput('');
    setShowPingModal(false);
    showNotification(`Panggilan mampir dikirim ke ${activeSelectedLapak.name}!`);
  };

  return (
    <div className="w-full h-full flex flex-col overflow-hidden relative bg-[#f8fafc] font-sans select-none text-slate-800">
      {/* ========================================================================= */}
      {/* 1. COMPACT TOP APP BAR                                                   */}
      {/* ========================================================================= */}
      <header className="bg-emerald-800 text-white px-3 py-2.5 flex items-center justify-between gap-2 shrink-0 z-30 shadow-sm">
        <button
          onClick={onBackToMain}
          className="w-10 h-10 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center text-white active:scale-95 transition shrink-0"
          title="Kembali ke Beranda WargaQu"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        {/* GPS Location Trigger */}
        <button
          onClick={() => setShowGpsModal(true)}
          className="flex-1 min-w-0 px-3 py-1.5 rounded-xl bg-emerald-950/50 border border-emerald-500/40 flex items-center justify-between gap-2 active:scale-[0.99] transition"
          title="Kalibrasi & Setel Titik GPS"
        >
          <div className="flex items-center gap-2 min-w-0 text-left">
            <LocateFixed className={`w-4 h-4 text-emerald-300 shrink-0 ${isGpsAcquiring ? 'animate-spin' : ''}`} />
            <div className="min-w-0">
              <div className="text-[11px] font-bold text-white truncate">
                AreaQu Radar {gpsAccuracy ? `(±${gpsAccuracy}m)` : ''}
              </div>
              <div className="text-[10px] text-emerald-200 truncate">{gpsSourceLabel}</div>
            </div>
          </div>
          <span className="text-[10px] font-bold text-emerald-300 shrink-0">Setel</span>
        </button>

        <button
          type="button"
          onClick={() => ModuleOnboardingService.openGuide('areaqu')}
          className="w-10 h-10 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center active:scale-95 transition shrink-0"
          title="Panduan & Manfaat AreaQu"
          aria-label="Panduan AreaQu"
        >
          <HelpCircle className="w-5 h-5" />
        </button>

        <button
          onClick={onOpenSiagaQu}
          className="w-10 h-10 rounded-full bg-red-600 hover:bg-red-700 text-white border border-white/60 flex items-center justify-center active:scale-95 transition shrink-0"
          title="Buka SiagaQu (SOS Darurat)"
        >
          <Siren className="w-5 h-5" />
        </button>
      </header>

      {/* ========================================================================= */}
      {/* 2. MAIN CONTENT BY ACTIVE TAB                                             */}
      {/* ========================================================================= */}

      {/* TAB 1: JELAJAH (CUSTOMER RADAR PETA & DAFTAR) */}
      <div className={activeTab === 'jelajah' ? 'flex-1 flex flex-col relative min-h-0' : 'hidden'}>
        {/* Search, Radius, List/Map Toggle & Categories */}
        <div className="bg-white border-b border-slate-200 px-3 py-2 space-y-2 z-20 shrink-0">
          <div className="flex items-center gap-1.5">
            <div className="flex-1 bg-slate-100 rounded-xl flex items-center px-3 min-h-[40px]">
              <Search className="w-4 h-4 text-emerald-700 mr-2 shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Cari bakso, warung, jasa, pemilik..."
                className="bg-transparent flex-1 text-xs text-slate-800 placeholder-slate-400 focus:outline-none"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="text-slate-400 hover:text-slate-600 p-1">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <button
              onClick={() => setShowRadiusModal(true)}
              className="min-h-[40px] px-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-bold flex items-center gap-1 shrink-0"
              title="Atur Radius Radar"
            >
              <Radio className="w-3.5 h-3.5 text-emerald-700" />
              <span className="font-mono tabular-nums">
                {selectedRadius >= 1000 ? `${selectedRadius / 1000}km` : `${selectedRadius}m`}
              </span>
            </button>

            <button
              onClick={() => setJelajahSubMode(prev => (prev === 'peta' ? 'daftar' : 'peta'))}
              className="min-h-[40px] px-2.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl text-slate-800 text-xs font-bold flex items-center gap-1 shrink-0"
              title="Ganti tampilan Peta / Daftar"
            >
              {jelajahSubMode === 'peta' ? (
                <>
                  <List className="w-3.5 h-3.5" />
                  <span>Daftar</span>
                </>
              ) : (
                <>
                  <MapIcon className="w-3.5 h-3.5" />
                  <span>Peta</span>
                </>
              )}
            </button>
          </div>

          {/* Category & Mobile-Vendor Speed Filter Tabs */}
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
            {[{ id: 'all', label: 'Semua', icon: '📍' }, ...CATEGORY_OPTIONS].map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap border transition flex items-center gap-1 shrink-0 ${
                  selectedCategory === cat.id
                    ? 'bg-emerald-700 text-white border-emerald-700'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <span>{cat.icon}</span>
                <span>{cat.label}</span>
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between gap-1.5 pt-0.5">
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
              {[
                { id: 'semua' as const, label: 'Semua Status' },
                { id: 'keliling_live' as const, label: '🛵 Keliling Live' },
                { id: 'ngetem' as const, label: '🟢 Sedang Ngetem' },
              ].map(m => (
                <button
                  key={m.id}
                  onClick={() => setMotionFilter(m.id)}
                  className={`px-2 py-1 rounded-md text-[10px] font-bold whitespace-nowrap border transition shrink-0 ${
                    motionFilter === m.id
                      ? 'bg-violet-700 text-white border-violet-700'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <div className="hidden sm:flex items-center gap-2 text-[10px] text-slate-500 shrink-0">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-600 inline-block" /> Ngetem</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-600 inline-block" /> Pelan</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-violet-700 inline-block" /> Melaju</span>
            </div>
          </div>
        </div>

        {/* Live Pedagang Keliling Announcement Banner */}
        {kelilingBanner && (
          <div className="bg-violet-900 text-white px-3 py-2 flex items-center justify-between gap-2 z-20 shrink-0 border-b border-violet-700">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-lg shrink-0">{kelilingBanner.lapakIcon}</span>
              <div className="min-w-0">
                <div className="text-[11px] font-extrabold truncate flex items-center gap-1">
                  <Megaphone className="w-3 h-3 text-amber-300 shrink-0" />
                  <span>{kelilingBanner.lapakName}</span>
                  <span className="text-violet-200 font-normal">
                    · {kelilingBanner.distanceMeter > 0 ? `${kelilingBanner.distanceMeter}m` : kelilingBanner.rigLabel}
                  </span>
                </div>
                <p className="text-[10px] text-violet-100 truncate">{kelilingBanner.note}</p>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => {
                  const found = computedLapaks.find(l => l.id === kelilingBanner.lapakId);
                  if (found) {
                    setSelectedLapak(found);
                    setShowPingModal(true);
                  }
                }}
                className="px-2.5 py-1 bg-amber-400 hover:bg-amber-300 text-slate-950 rounded-lg text-[10px] font-black"
              >
                Panggil
              </button>
              <button
                onClick={() => setKelilingBanner(null)}
                className="p-1 text-violet-300 hover:text-white"
                title="Tutup pengumuman"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Pin Drop Instruction Banner for Merchant */}
        {isSettingLapakPinOnMap && (
          <div className="bg-amber-500 text-slate-950 px-3 py-2 text-xs font-bold flex items-center justify-between gap-2 z-20 shrink-0">
            <span>Ketuk titik di peta untuk menetapkan lokasi lapak Anda</span>
            <button
              onClick={() => setIsSettingLapakPinOnMap(false)}
              className="px-2 py-1 bg-slate-900 text-white rounded-lg text-[11px]"
            >
              Batal
            </button>
          </div>
        )}

        {/* Pin Drop Instruction Banner for User Location */}
        {isSettingUserPinOnMap && (
          <div className="bg-sky-600 text-white px-3 py-2 text-xs font-bold flex items-center justify-between gap-2 z-20 shrink-0">
            <span>Ketuk titik lokasi Anda pada peta (mis. tepat di depan rumah)</span>
            <button
              onClick={() => setIsSettingUserPinOnMap(false)}
              className="px-2 py-1 bg-slate-900 text-white rounded-lg text-[11px]"
            >
              Batal
            </button>
          </div>
        )}

        {/* Map Canvas */}
        <div className={jelajahSubMode === 'peta' ? 'flex-1 relative min-h-0' : 'hidden'}>
          <div ref={mapContainerRef} className="absolute inset-0 w-full h-full z-10" />

          {/* Map Floating Controls */}
          <div className="absolute right-3 top-3 z-20 flex flex-col gap-2">
            <button
              onClick={handleRecenter}
              className="w-10 h-10 rounded-full bg-white shadow-md border border-slate-200 text-emerald-800 flex items-center justify-center active:scale-95 transition"
              title="Pusatkan ke Posisi GPS Anda"
            >
              <Compass className="w-5 h-5" />
            </button>
            <button
              onClick={() => handleAcquireRealGPS(false)}
              className="w-10 h-10 rounded-full bg-white shadow-md border border-slate-200 text-emerald-800 flex items-center justify-center active:scale-95 transition"
              title="Perbarui Sensor GPS"
            >
              <RefreshCw className={`w-4 h-4 ${isGpsAcquiring ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => handleZoom(1)}
              className="w-10 h-10 rounded-full bg-white shadow-md border border-slate-200 text-slate-700 flex items-center justify-center active:scale-95 transition"
              title="Perbesar Peta"
            >
              <Plus className="w-5 h-5" />
            </button>
            <button
              onClick={() => handleZoom(-1)}
              className="w-10 h-10 rounded-full bg-white shadow-md border border-slate-200 text-slate-700 flex items-center justify-center active:scale-95 transition"
              title="Perkecil Peta"
            >
              <Minus className="w-5 h-5" />
            </button>
          </div>

          {/* Selected Lapak Bottom Sheet */}
          {activeSelectedLapak ? (() => {
            const rigMeta = getRigMeta(activeSelectedLapak.rigType);
            const isMobileVendor =
              activeSelectedLapak.status === 'keliling' ||
              activeSelectedLapak.lapakType === 'keliling' ||
              (activeSelectedLapak.rigType && activeSelectedLapak.rigType !== 'menetap');
            const motion = inferMotionState(activeSelectedLapak.speedKmh, activeSelectedLapak.motionState);
            const speedText =
              typeof activeSelectedLapak.speedKmh === 'number' && activeSelectedLapak.speedKmh > 0
                ? `${Math.round(activeSelectedLapak.speedKmh)} km/j`
                : null;
            return (
              <div className="absolute bottom-0 left-0 right-0 z-30 bg-white rounded-t-3xl shadow-2xl border-t border-slate-200 p-4 space-y-3 animate-in slide-in-from-bottom duration-200">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 min-w-0">
                    <ShieldCheck className="w-4 h-4 shrink-0" />
                    <span className="truncate">
                      {activeSelectedLapak.isVerifiedWarga !== false ? 'Pedagang Terverifikasi' : 'Lapak Warga'}
                      {activeSelectedLapak.rtRw ? ` · ${activeSelectedLapak.rtRw}` : ''}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleToggleFavorite(activeSelectedLapak.id)}
                      className="p-1.5 rounded-full hover:bg-slate-100 text-slate-500"
                      title="Simpan ke Favorit"
                    >
                      <Heart
                        className={`w-4 h-4 ${
                          favoriteIds.includes(activeSelectedLapak.id) ? 'fill-rose-500 text-rose-500' : ''
                        }`}
                      />
                    </button>
                    <button
                      onClick={() => {
                        setSelectedLapak(null);
                        if (routePolylineRef.current && mapInstanceRef.current) {
                          mapInstanceRef.current.removeLayer(routePolylineRef.current);
                        }
                      }}
                      className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full"
                      title="Tutup"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-2xl shrink-0 relative">
                      {activeSelectedLapak.avatarIcon}
                      {isMobileVendor && (
                        <span className="absolute -bottom-1 -right-1 text-xs bg-white rounded-full w-5 h-5 flex items-center justify-center border border-slate-200 shadow-xs">
                          {rigMeta.icon}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-extrabold text-slate-900 leading-snug truncate">
                        {activeSelectedLapak.name}
                      </h3>
                      <div className="text-[11px] text-slate-600 mt-0.5 truncate">
                        <strong className="text-slate-800">{activeSelectedLapak.ownerName}</strong> ·{' '}
                        {isMobileVendor ? rigMeta.label : activeSelectedLapak.categoryLabel}
                      </div>
                      <div className="flex items-center flex-wrap gap-1.5 text-[11px] text-slate-500 mt-0.5">
                        <span
                          className={`font-bold px-1.5 py-0.5 rounded-md border text-[10px] ${
                            activeSelectedLapak.status === 'tutup'
                              ? 'bg-slate-100 text-slate-600 border-slate-200'
                              : isMobileVendor && motion === 'melaju'
                              ? 'bg-violet-50 text-violet-800 border-violet-200'
                              : isMobileVendor && motion === 'pelan'
                              ? 'bg-amber-50 text-amber-800 border-amber-200'
                              : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          }`}
                        >
                          {activeSelectedLapak.status === 'tutup'
                            ? 'Tutup'
                            : isMobileVendor
                            ? motion === 'melaju'
                              ? `Melaju${speedText ? ` ${speedText}` : ''}`
                              : motion === 'pelan'
                              ? `Jalan Pelan${speedText ? ` ${speedText}` : ''}`
                              : 'Sedang Ngetem'
                            : 'Buka'}
                        </span>
                        <span>· {activeSelectedLapak.operationalHours}</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="flex items-center justify-end text-amber-500 font-bold text-xs">
                      <Star className="w-3.5 h-3.5 fill-amber-400 mr-0.5" />
                      <span className="tabular-nums">{activeSelectedLapak.rating}</span>
                    </div>
                    <span className="text-[11px] font-bold text-emerald-700 block font-mono tabular-nums">
                      {activeSelectedLapak.distanceMeter !== undefined
                        ? activeSelectedLapak.distanceMeter >= 1000
                          ? `${(activeSelectedLapak.distanceMeter / 1000).toFixed(1)} km`
                          : `${activeSelectedLapak.distanceMeter} m`
                        : 'Dekat'}
                    </span>
                  </div>
                </div>

                <div className="bg-slate-50 rounded-xl p-2.5 text-xs space-y-1 border border-slate-200/80">
                  <div className="flex items-center text-slate-600 text-[11px]">
                    <MapPin className="w-3.5 h-3.5 text-emerald-600 mr-1.5 shrink-0" />
                    <span className="truncate font-medium">{activeSelectedLapak.address}</span>
                  </div>
                  {activeSelectedLapak.routeSchedule && (
                    <div className="flex items-center text-violet-800 text-[11px] font-semibold">
                      <CalendarClock className="w-3.5 h-3.5 text-violet-600 mr-1.5 shrink-0" />
                      <span className="truncate">Rute: {activeSelectedLapak.routeSchedule}</span>
                    </div>
                  )}
                  <p className="text-slate-600 text-[11px] leading-relaxed line-clamp-2">
                    {activeSelectedLapak.liveBroadcastNote || activeSelectedLapak.description}
                  </p>
                </div>

                <div className="grid grid-cols-4 gap-1.5">
                  <button
                    onClick={() => {
                      setCartItems({});
                      setOrderKind('langsung');
                      setShowKatalogModal(true);
                    }}
                    className="min-h-[44px] px-2 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white shadow-sm active:scale-[0.98] transition flex items-center justify-center gap-1"
                  >
                    <ShoppingBag className="w-4 h-4 shrink-0" />
                    <span className="text-[11px] font-bold truncate">
                      Menu ({activeSelectedLapak.catalog.length})
                    </span>
                  </button>

                  <button
                    onClick={() => {
                      setPingNoteInput('');
                      setShowPingModal(true);
                    }}
                    className="min-h-[44px] px-2 py-2 rounded-xl bg-violet-700 hover:bg-violet-800 text-white shadow-sm active:scale-[0.98] transition flex items-center justify-center gap-1"
                    title="Panggil Pedagang agar Mampir"
                  >
                    <BellRing className="w-4 h-4 shrink-0" />
                    <span className="text-[11px] font-bold truncate">Panggil</span>
                  </button>

                  <button
                    onClick={() => handleOpenChatWithLapak(activeSelectedLapak)}
                    className="min-h-[44px] px-2 py-2 rounded-xl bg-sky-50 hover:bg-sky-100 border border-sky-200 text-sky-800 active:scale-[0.98] transition flex items-center justify-center gap-1"
                  >
                    <MessageCircle className="w-4 h-4 shrink-0" />
                    <span className="text-[11px] font-bold">Chat</span>
                  </button>

                  <button
                    onClick={() =>
                      handleOpenWhatsApp(
                        activeSelectedLapak.phone,
                        `Halo ${activeSelectedLapak.name}, saya ${consumerIdentity.fullName || 'Warga AreaQu'} ingin bertanya/panggil mampir.`
                      )
                    }
                    className="min-h-[44px] px-2 py-2 rounded-xl bg-green-50 hover:bg-green-100 border border-green-200 text-green-800 active:scale-[0.98] transition flex items-center justify-center gap-1"
                  >
                    <Phone className="w-4 h-4 shrink-0" />
                    <span className="text-[11px] font-bold">WA</span>
                  </button>
                </div>
              </div>
            );
          })() : (
            <div className="absolute bottom-3 left-3 right-3 z-20 bg-white/95 backdrop-blur-md rounded-2xl shadow-lg border border-slate-200 p-3 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <h4 className="text-xs font-bold text-slate-900">
                  {filteredLapaks.length} Lapak Terverifikasi di Radar
                </h4>
                <p className="text-[11px] text-slate-500 truncate">
                  {consumerIdentity.isVerified
                    ? `Identitas Pembeli: ${consumerIdentity.fullName} (${consumerIdentity.addressDetail})`
                    : 'Ketuk pin peta atau buka Daftar untuk Panggil / Pre-Order'}
                </p>
              </div>

              <button
                onClick={() => {
                  if (filteredLapaks.length > 0) {
                    setSelectedLapak(filteredLapaks[0]);
                    mapInstanceRef.current?.panTo([filteredLapaks[0].lat, filteredLapaks[0].lng]);
                  }
                }}
                className="min-h-[40px] px-3 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold shrink-0"
              >
                Terdekat
              </button>
            </div>
          )}
        </div>

        {/* Sub-menu Daftar Lapak */}
        {jelajahSubMode === 'daftar' && (
          <div className="flex-1 overflow-y-auto no-scrollbar p-3 space-y-2.5 bg-[#f8fafc]">
            <div className="flex items-center justify-between text-xs text-slate-500 px-1">
              <span>Menampilkan {filteredLapaks.length} lapak terdekat</span>
              <span className="font-mono tabular-nums">
                Radius {selectedRadius >= 1000 ? `${selectedRadius / 1000} km` : `${selectedRadius} m`}
              </span>
            </div>

            {filteredLapaks.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-6 text-center space-y-2">
                <Store className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="text-sm font-bold text-slate-800">Tidak Ada Lapak di Radius Ini</p>
                <p className="text-xs text-slate-500">
                  Coba perluas radius radar atau ubah filter status/pencarian Anda.
                </p>
              </div>
            ) : (
              filteredLapaks.map(lapak => {
                const rigMeta = getRigMeta(lapak.rigType);
                const isMobileVendor =
                  lapak.status === 'keliling' ||
                  lapak.lapakType === 'keliling' ||
                  (lapak.rigType && lapak.rigType !== 'menetap');
                const motion = inferMotionState(lapak.speedKmh, lapak.motionState);
                return (
                  <div
                    key={lapak.id}
                    className="bg-white rounded-2xl border border-slate-200 p-3.5 space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-11 h-11 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-2xl shrink-0 relative">
                          {lapak.avatarIcon}
                          {isMobileVendor && (
                            <span className="absolute -bottom-1 -right-1 text-[10px] bg-white rounded-full w-4 h-4 flex items-center justify-center border border-slate-200">
                              {rigMeta.icon}
                            </span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-xs font-bold text-slate-900 truncate">{lapak.name}</h3>
                          <p className="text-[11px] text-slate-600 truncate">
                            {lapak.ownerName} · {isMobileVendor ? rigMeta.label : lapak.categoryLabel}
                          </p>
                          <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
                            <span className={`font-semibold ${isMobileVendor && motion === 'melaju' ? 'text-violet-700' : 'text-emerald-700'}`}>
                              {lapak.status === 'tutup'
                                ? 'Tutup'
                                : isMobileVendor
                                ? motion === 'melaju'
                                  ? `Melaju${lapak.speedKmh ? ` ±${Math.round(lapak.speedKmh)} km/j` : ''}`
                                  : motion === 'pelan'
                                  ? `Pelan${lapak.speedKmh ? ` ±${Math.round(lapak.speedKmh)} km/j` : ''}`
                                  : 'Ngetem'
                                : 'Buka'}
                            </span>
                            <span>·</span>
                            <span>{lapak.catalog.length} produk</span>
                          </div>
                          {lapak.routeSchedule && (
                            <p className="text-[10px] text-violet-700 font-medium truncate mt-0.5">
                              Rute: {lapak.routeSchedule}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-xs font-extrabold text-emerald-700 font-mono tabular-nums block">
                          {lapak.distanceMeter !== undefined
                            ? lapak.distanceMeter >= 1000
                              ? `${(lapak.distanceMeter / 1000).toFixed(1)} km`
                              : `${lapak.distanceMeter} m`
                            : 'Dekat'}
                        </span>
                        <span className="text-[10px] text-slate-500">±{lapak.etaMinutes} mnt</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-1.5">
                      <button
                        onClick={() => {
                          setSelectedLapak(lapak);
                          setJelajahSubMode('peta');
                          mapInstanceRef.current?.flyTo([lapak.lat, lapak.lng], 17);
                        }}
                        className="min-h-[40px] rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-[11px] font-bold flex items-center justify-center gap-1"
                      >
                        <Navigation className="w-3.5 h-3.5" />
                        <span>Peta</span>
                      </button>
                      <button
                        onClick={() => {
                          setSelectedLapak(lapak);
                          setPingNoteInput('');
                          setShowPingModal(true);
                        }}
                        className="min-h-[40px] rounded-xl bg-violet-50 hover:bg-violet-100 border border-violet-200 text-violet-800 text-[11px] font-bold flex items-center justify-center gap-1"
                      >
                        <BellRing className="w-3.5 h-3.5" />
                        <span>Panggil</span>
                      </button>
                      <button
                        onClick={() => {
                          setSelectedLapak(lapak);
                          setCartItems({});
                          setOrderKind('langsung');
                          setShowKatalogModal(true);
                        }}
                        className="min-h-[40px] rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-bold flex items-center justify-center gap-1"
                      >
                        <ShoppingBag className="w-3.5 h-3.5" />
                        <span>Katalog</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* TAB 2: LAPAK SAYA (PEDAGANG MODE WITH IDENTITY GATE) */}
      {activeTab === 'lapak' && (
        <div className="flex-1 flex flex-col bg-[#f8fafc] overflow-hidden">
          {!merchantIdentity.isVerified ? (
            <div className="flex-1 flex items-center justify-center p-5">
              <div className="bg-white rounded-2xl border border-slate-200 p-5 max-w-sm w-full space-y-4 text-center">
                <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center mx-auto">
                  <AlertTriangle className="w-7 h-7" />
                </div>
                <div className="space-y-1.5">
                  <h2 className="text-base font-bold text-slate-900">
                    Identitas Pedagang Diperlukan
                  </h2>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Setiap warga yang ingin membagikan lokasi lapak dan katalog dagangan wajib memiliki identitas jelas (nama pemilik, ID warga/RT-RW, kategori usaha, dan kontak aktif).
                  </p>
                </div>
                <button
                  onClick={() => {
                    setIdentitySubTab('pedagang');
                    setActiveTab('identitas');
                  }}
                  className="w-full min-h-[46px] bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold"
                >
                  Lengkapi Identitas Pedagang
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Merchant Verified Header + Sub-Menu Switcher */}
              <div className="bg-white border-b border-slate-200 px-4 pt-3 pb-3 space-y-3 shrink-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-11 h-11 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-2xl shrink-0">
                      {myLapak.avatarIcon}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                        <BadgeCheck className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">
                          {myLapak.ownerName}{myLapak.rtRw ? ` · ${myLapak.rtRw}` : ''}
                        </span>
                      </div>
                      <h2 className="text-sm font-extrabold text-slate-900 truncate">
                        {myLapak.name}
                      </h2>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setIdentitySubTab('pedagang');
                      setActiveTab('identitas');
                    }}
                    className="min-h-[38px] px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold flex items-center gap-1 shrink-0"
                    title="Ubah Identitas Lapak"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Identitas</span>
                  </button>
                </div>

                {/* Sub-Menu Lapak Saya: Lokasi & Status | Katalog */}
                <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-xl">
                  <button
                    onClick={() => setLapakSubTab('lokasi')}
                    className={`min-h-[40px] rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                      lapakSubTab === 'lokasi'
                        ? 'bg-white text-emerald-800 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <MapPin className="w-3.5 h-3.5" />
                    <span>Lokasi & Status</span>
                  </button>
                  <button
                    onClick={() => setLapakSubTab('katalog')}
                    className={`min-h-[40px] rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                      lapakSubTab === 'katalog'
                        ? 'bg-white text-emerald-800 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <ShoppingBag className="w-3.5 h-3.5" />
                    <span>Katalog ({myLapak.catalog.length})</span>
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-3.5">
                {lapakSubTab === 'lokasi' && (
                  <>
                    {/* Publication Visibility Toggle */}
                    <div className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="text-xs font-bold text-slate-900">
                          Tampilkan Lapak di Peta Warga
                        </h3>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {(myLapak.isPublished ?? true)
                            ? 'Lokasi & katalog Anda sedang tampil untuk warga sekitar.'
                            : 'Lapak disembunyikan sementara dari radar pencarian.'}
                        </p>
                      </div>
                      <button
                        onClick={handleToggleLapakPublished}
                        className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition ${
                          (myLapak.isPublished ?? true)
                            ? 'bg-emerald-700 text-white'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {(myLapak.isPublished ?? true) ? 'Aktif' : 'Nonaktif'}
                      </button>
                    </div>

                    {/* Operational Status Switcher */}
                    <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-2.5">
                      <h3 className="text-xs font-bold text-slate-900">Status Operasional Saat Ini</h3>
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          onClick={() => handleToggleLapakStatus('buka')}
                          className={`min-h-[44px] rounded-xl text-xs font-bold border transition ${
                            myLapak.status === 'buka'
                              ? 'bg-emerald-700 text-white border-emerald-700'
                              : 'bg-slate-50 text-slate-700 border-slate-200'
                          }`}
                        >
                          Buka
                        </button>
                        <button
                          onClick={() => handleToggleLapakStatus('keliling')}
                          className={`min-h-[44px] rounded-xl text-xs font-bold border transition ${
                            myLapak.status === 'keliling'
                              ? 'bg-violet-700 text-white border-violet-700'
                              : 'bg-slate-50 text-slate-700 border-slate-200'
                          }`}
                        >
                          Keliling
                        </button>
                        <button
                          onClick={() => handleToggleLapakStatus('tutup')}
                          className={`min-h-[44px] rounded-xl text-xs font-bold border transition ${
                            myLapak.status === 'tutup'
                              ? 'bg-slate-700 text-white border-slate-700'
                              : 'bg-slate-50 text-slate-700 border-slate-200'
                          }`}
                        >
                          Tutup
                        </button>
                      </div>
                    </div>

                    {/* Pedagang Keliling Live Radar, Speed State & Siaran Warga */}
                    <div className="bg-white rounded-2xl border border-violet-200 p-4 space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                            <Gauge className="w-4 h-4 text-violet-700 shrink-0" />
                            <span>Radar Pedagang Keliling Live</span>
                          </h3>
                          <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                            Armada: {getRigMeta(myLapak.rigType).icon} {getRigMeta(myLapak.rigType).label}
                            {typeof myLapak.speedKmh === 'number' ? ` · ${Math.round(myLapak.speedKmh)} km/j` : ''}
                          </p>
                        </div>
                        <button
                          onClick={handleToggleKelilingLive}
                          className={`min-h-[38px] px-3 py-1.5 rounded-xl text-[11px] font-bold shrink-0 transition ${
                            isKelilingLive
                              ? 'bg-rose-600 hover:bg-rose-700 text-white'
                              : 'bg-violet-700 hover:bg-violet-800 text-white'
                          }`}
                        >
                          {isKelilingLive ? 'Hentikan Live GPS' : 'Mulai Live GPS'}
                        </button>
                      </div>

                      <div className="space-y-1.5">
                        <span className="text-[11px] font-bold text-slate-700 block">
                          Tampilan Ikon Kecepatan di Peta Warga:
                        </span>
                        <div className="grid grid-cols-3 gap-1.5">
                          {[
                            { id: 'ngetem' as const, label: 'Ngetem', hint: '0 km/j', activeCls: 'bg-emerald-700 text-white border-emerald-700' },
                            { id: 'pelan' as const, label: 'Jalan Pelan', hint: 'Gerobak/Sepeda', activeCls: 'bg-amber-600 text-white border-amber-600' },
                            { id: 'melaju' as const, label: 'Melaju', hint: 'Motor/Pickup', activeCls: 'bg-violet-700 text-white border-violet-700' },
                          ].map(opt => {
                            const currentMotion = inferMotionState(myLapak.speedKmh, myLapak.motionState);
                            const isActive = myLapak.status === 'keliling' && currentMotion === opt.id;
                            return (
                              <button
                                key={opt.id}
                                onClick={() => handleSwitchMotionState(opt.id)}
                                className={`min-h-[42px] px-2 py-1.5 rounded-xl border text-center transition ${
                                  isActive ? opt.activeCls : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                                }`}
                              >
                                <div className="text-[11px] font-bold">{opt.label}</div>
                                <div className={`text-[9px] ${isActive ? 'text-white/85' : 'text-slate-500'}`}>{opt.hint}</div>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-100 space-y-2">
                        <label className="text-[11px] font-bold text-slate-700 block">
                          Siarkan Pemberitahuan Lewat ke Warga Sekitar:
                        </label>
                        <div className="flex gap-1.5">
                          <input
                            type="text"
                            value={broadcastNoteInput}
                            onChange={e => setBroadcastNoteInput(e.target.value)}
                            placeholder="Contoh: Somay & sayur segar melintas Blok A-C!"
                            className="flex-1 min-h-[40px] bg-slate-50 border border-slate-200 rounded-xl px-3 text-xs text-slate-800"
                          />
                          <button
                            onClick={handleSendKelilingAnnounce}
                            className="min-h-[40px] px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold flex items-center gap-1 shrink-0"
                          >
                            <Megaphone className="w-3.5 h-3.5" />
                            <span>Umumkan</span>
                          </button>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-100 space-y-1.5">
                        <label className="text-[11px] font-bold text-slate-700 block">
                          Jadwal Wilayah & Jam Lewat (Untuk Pre-Order):
                        </label>
                        <div className="flex gap-1.5">
                          <input
                            type="text"
                            value={routeScheduleDraft}
                            onChange={e => setRouteScheduleDraft(e.target.value)}
                            placeholder="Contoh: Blok A–D (06:30) · Sore Pasar (16:00)"
                            className="flex-1 min-h-[38px] bg-slate-50 border border-slate-200 rounded-xl px-3 text-xs text-slate-800"
                          />
                          <button
                            onClick={handleSaveRouteSchedule}
                            className="min-h-[38px] px-3 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-[11px] font-bold shrink-0"
                          >
                            Simpan Rute
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Location & Share Actions */}
                    <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
                      <div>
                        <h3 className="text-xs font-bold text-slate-900">Titik Koordinat Lapak</h3>
                        <p className="text-[11px] text-slate-500 mt-0.5">{myLapak.address}</p>
                        <div className="mt-2 bg-slate-50 rounded-xl p-2.5 border border-slate-200/80 text-xs font-mono tabular-nums text-slate-700 flex justify-between">
                          <span>Lat: {myLapak.lat.toFixed(6)}</span>
                          <span>Lng: {myLapak.lng.toFixed(6)}</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={handleSyncLapakWithMyGPS}
                          className="min-h-[44px] px-3 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold flex items-center justify-center gap-1.5"
                        >
                          <LocateFixed className="w-4 h-4" />
                          <span>Ikuti GPS Saya</span>
                        </button>
                        <button
                          onClick={() => {
                            setIsSettingLapakPinOnMap(true);
                            setJelajahSubMode('peta');
                            setActiveTab('jelajah');
                          }}
                          className="min-h-[44px] px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold flex items-center justify-center gap-1.5"
                        >
                          <Crosshair className="w-4 h-4 text-emerald-700" />
                          <span>Pilih di Peta</span>
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={handleShareMyLapak}
                          className="min-h-[44px] px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center justify-center gap-1.5"
                        >
                          <Share2 className="w-4 h-4" />
                          <span>Share Lapak</span>
                        </button>
                        <button
                          onClick={() => setShowPreviewModal(true)}
                          className="min-h-[44px] px-3 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-800 text-xs font-bold flex items-center justify-center gap-1.5"
                        >
                          <Eye className="w-4 h-4" />
                          <span>Pratinjau</span>
                        </button>
                      </div>
                    </div>
                  </>
                )}

                {lapakSubTab === 'katalog' && (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setShowAddProductModal(true)}
                        className="min-h-[44px] px-3 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold flex items-center justify-center gap-1.5"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Tambah Menu</span>
                      </button>

                      <button
                        onClick={handleImportMenuFromUsahaQu}
                        className="min-h-[44px] px-3 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-900 text-xs font-bold flex items-center justify-center gap-1.5"
                      >
                        <ShoppingBag className="w-4 h-4 text-amber-700" />
                        <span>Impor UsahaQu</span>
                      </button>
                    </div>

                    <div className="space-y-2">
                      {myLapak.catalog.map(prod => (
                        <div
                          key={prod.id}
                          className="p-3 rounded-2xl bg-white border border-slate-200 flex items-center justify-between gap-2.5"
                        >
                          <div className="min-w-0 flex-1">
                            <h4 className="text-xs font-bold text-slate-900 truncate">{prod.name}</h4>
                            <p className="text-[11px] text-slate-500 truncate">
                              {prod.category} · {prod.description}
                            </p>
                            <div className="text-xs font-extrabold text-emerald-700 font-mono tabular-nums mt-0.5">
                              Rp {prod.price.toLocaleString('id-ID')}
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              onClick={() => handleToggleProductAvailability(prod.id)}
                              className={`min-h-[36px] px-2.5 py-1 rounded-xl text-[11px] font-bold border transition ${
                                prod.isAvailable
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                  : 'bg-rose-50 text-rose-800 border-rose-200'
                              }`}
                            >
                              {prod.isAvailable ? 'Tersedia' : 'Habis'}
                            </button>
                            <button
                              onClick={() => handleDeleteProduct(prod.id)}
                              className="min-h-[36px] min-w-[36px] flex items-center justify-center text-slate-400 hover:text-rose-600 rounded-xl"
                              title="Hapus Produk"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* TAB 3: AKTIVITAS (PESANAN, FAVORIT, ORDER MASUK) */}
      {activeTab === 'aktivitas' && (
        <ActivityPanel
          orders={orders}
          pings={pings}
          favoriteLapaks={favoriteLapaks}
          myLapakId={myLapak.id}
          onUpdateOrderStatus={handleUpdateOrderStatus}
          onUpdatePingStatus={handleUpdatePingStatus}
          onSelectLapakOnMap={lapak => {
            setSelectedLapak(lapak);
            setJelajahSubMode('peta');
            setActiveTab('jelajah');
            mapInstanceRef.current?.flyTo([lapak.lat, lapak.lng], 17);
          }}
          onToggleFavorite={handleToggleFavorite}
        />
      )}

      {/* TAB 4: IDENTITAS & VERIFIKASI (KONSUMEN, PEDAGANG, KEAMANAN) */}
      {activeTab === 'identitas' && (
        <IdentityPanel
          consumerIdentity={consumerIdentity}
          merchantIdentity={merchantIdentity}
          onSaveConsumerIdentity={handleSaveConsumerIdentity}
          onSaveMerchantIdentity={handleSaveMerchantIdentity}
          userCoords={userCoords}
          gpsSourceLabel={gpsSourceLabel}
          onOpenGpsModal={() => setShowGpsModal(true)}
          onSyncLapakGps={handleSyncLapakWithMyGPS}
          showNotification={showNotification}
          initialSubTab={identitySubTab}
        />
      )}

      {/* ========================================================================= */}
      {/* 3. BOTTOM 4-TAB NAVIGATION BAR (THUMB ZONE)                               */}
      {/* ========================================================================= */}
      <nav className="bg-white border-t border-slate-200 grid grid-cols-4 h-16 shrink-0 z-30">
        <button
          onClick={() => setActiveTab('jelajah')}
          className={`flex flex-col items-center justify-center gap-0.5 transition-colors ${
            activeTab === 'jelajah' ? 'text-emerald-700' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Compass className="w-5 h-5" />
          <span className="text-[11px] font-bold">Jelajah</span>
        </button>

        <button
          onClick={() => setActiveTab('lapak')}
          className={`flex flex-col items-center justify-center gap-0.5 relative transition-colors ${
            activeTab === 'lapak' ? 'text-emerald-700' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Store className="w-5 h-5" />
          <span className="text-[11px] font-bold">Lapak Saya</span>
        </button>

        <button
          onClick={() => setActiveTab('aktivitas')}
          className={`flex flex-col items-center justify-center gap-0.5 relative transition-colors ${
            activeTab === 'aktivitas' ? 'text-emerald-700' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <div className="relative">
            <ClipboardList className="w-5 h-5" />
            {incomingOrderCount > 0 && (
              <span className="absolute -top-1.5 -right-2.5 bg-emerald-700 text-white text-[9px] font-bold px-1 rounded-full font-mono tabular-nums">
                {incomingOrderCount}
              </span>
            )}
          </div>
          <span className="text-[11px] font-bold">Aktivitas</span>
        </button>

        <button
          onClick={() => setActiveTab('identitas')}
          className={`flex flex-col items-center justify-center gap-0.5 relative transition-colors ${
            activeTab === 'identitas' ? 'text-emerald-700' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <UserCheck className="w-5 h-5" />
          <span className="text-[11px] font-bold">Identitas</span>
        </button>
      </nav>

      {/* ========================================================================= */}
      {/* 4. MODAL: KATALOG & MENU PRODUK (WITH IDENTITY-GATED CHECKOUT)            */}
      {/* ========================================================================= */}
      {showKatalogModal && selectedLapak && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-3">
          <div className="bg-white rounded-2xl w-full max-w-sm max-h-[85vh] p-4 space-y-3 shadow-2xl flex flex-col">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-2xl">{selectedLapak.avatarIcon}</span>
                <div className="min-w-0">
                  <h3 className="text-xs font-black text-slate-900 truncate">{selectedLapak.name}</h3>
                  <p className="text-[11px] text-slate-500 truncate">
                    {selectedLapak.ownerName}{selectedLapak.rtRw ? ` · ${selectedLapak.rtRw}` : ''}
                  </p>
                </div>
              </div>
              <button onClick={() => setShowKatalogModal(false)} className="p-1.5 text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 flex-1 overflow-y-auto pr-1">
              {selectedLapak.catalog.map(item => {
                const qty = cartItems[item.id] || 0;
                return (
                  <div
                    key={item.id}
                    className="bg-slate-50 rounded-xl p-2.5 border border-slate-200/80 flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0 flex-1">
                      <h4 className="text-xs font-bold text-slate-800 truncate">{item.name}</h4>
                      <p className="text-[10px] text-slate-500 line-clamp-1">{item.description}</p>
                      <div className="text-xs font-extrabold text-emerald-700 font-mono tabular-nums mt-0.5">
                        Rp {item.price.toLocaleString('id-ID')}
                      </div>
                    </div>

                    {item.isAvailable ? (
                      <div className="flex items-center gap-1.5 shrink-0 bg-white border border-slate-200 rounded-lg p-0.5">
                        <button
                          onClick={() =>
                            setCartItems(prev => ({ ...prev, [item.id]: Math.max(0, (prev[item.id] || 0) - 1) }))
                          }
                          disabled={qty <= 0}
                          className="w-7 h-7 rounded flex items-center justify-center text-slate-600 hover:bg-slate-100 disabled:opacity-30"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-5 text-center text-xs font-extrabold font-mono tabular-nums">
                          {qty}
                        </span>
                        <button
                          onClick={() =>
                            setCartItems(prev => ({ ...prev, [item.id]: (prev[item.id] || 0) + 1 }))
                          }
                          className="w-7 h-7 rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100 flex items-center justify-center"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <span className="text-[11px] font-bold text-rose-600 px-2">Habis</span>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="pt-2 border-t border-slate-100 space-y-2.5">
              {/* Order Mode: Pesan Sekarang vs Pre-Order Jam Lewat */}
              <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-xl">
                <button
                  type="button"
                  onClick={() => setOrderKind('langsung')}
                  className={`min-h-[34px] rounded-lg text-[11px] font-bold transition ${
                    orderKind === 'langsung'
                      ? 'bg-white text-emerald-800 shadow-xs'
                      : 'text-slate-600'
                  }`}
                >
                  Pesan Sekarang
                </button>
                <button
                  type="button"
                  onClick={() => setOrderKind('preorder')}
                  className={`min-h-[34px] rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 transition ${
                    orderKind === 'preorder'
                      ? 'bg-violet-700 text-white shadow-xs'
                      : 'text-slate-600'
                  }`}
                >
                  <CalendarClock className="w-3.5 h-3.5" />
                  <span>Pre-Order Jam Lewat</span>
                </button>
              </div>

              {orderKind === 'preorder' && (
                <div className="bg-violet-50 border border-violet-200 rounded-xl p-2.5 space-y-1.5">
                  <label className="text-[10px] font-bold text-violet-900 block">
                    Pilih / Tulis Jam Rute Lewat (Titip sebelum lewat):
                  </label>
                  <div className="flex flex-wrap gap-1">
                    {[
                      'Putaran Pagi (06:30–09:00)',
                      'Putaran Siang (11:30–13:30)',
                      'Putaran Sore (16:00–18:00)'
                    ].map(slot => (
                      <button
                        key={slot}
                        type="button"
                        onClick={() => setScheduledSlot(slot)}
                        className={`px-2 py-1 rounded-lg text-[10px] font-bold border ${
                          scheduledSlot === slot
                            ? 'bg-violet-700 text-white border-violet-700'
                            : 'bg-white text-violet-900 border-violet-200'
                        }`}
                      >
                        {slot}
                      </button>
                    ))}
                  </div>
                  <input
                    type="text"
                    value={scheduledSlot}
                    onChange={e => setScheduledSlot(e.target.value)}
                    placeholder="Atau ketik jam sendiri, mis. Jam 08:00 pagi"
                    className="w-full min-h-[34px] bg-white border border-violet-200 rounded-lg px-2.5 text-[11px] text-slate-800"
                  />
                </div>
              )}

              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-600 font-medium">Total Pesanan:</span>
                <span className="text-sm font-extrabold text-emerald-700 font-mono tabular-nums">
                  Rp {cartSubtotal.toLocaleString('id-ID')}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleCheckoutWithIdentityGate('areaqu')}
                  disabled={cartSubtotal <= 0}
                  className="min-h-[42px] bg-emerald-700 hover:bg-emerald-800 disabled:bg-slate-300 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{orderKind === 'preorder' ? 'Kirim Pre-Order' : 'Pesan AreaQu'}</span>
                </button>

                <button
                  onClick={() => handleCheckoutWithIdentityGate('whatsapp')}
                  disabled={cartSubtotal <= 0}
                  className="min-h-[42px] bg-green-600 hover:bg-green-700 disabled:bg-slate-300 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>Kirim WhatsApp</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4B. MODAL: PANGGIL / MINTA MAMPIR PEDAGANG KELILING                       */}
      {/* ========================================================================= */}
      {showPingModal && activeSelectedLapak && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-3">
          <div className="bg-white rounded-2xl w-full max-w-sm p-4 space-y-3 shadow-2xl">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-violet-50 border border-violet-200 flex items-center justify-center text-lg shrink-0">
                  {activeSelectedLapak.avatarIcon}
                </div>
                <div className="min-w-0">
                  <h3 className="text-xs font-black text-slate-900 truncate">
                    Panggil / Minta Mampir
                  </h3>
                  <p className="text-[10px] text-slate-500 truncate">
                    Ke: {activeSelectedLapak.name} ({activeSelectedLapak.ownerName})
                  </p>
                </div>
              </div>
              <button onClick={() => setShowPingModal(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSendKelilingPing} className="space-y-2.5">
              <div className="bg-slate-50 rounded-xl p-2.5 text-[11px] text-slate-700 border border-slate-200/80 space-y-1">
                <div className="font-bold text-slate-900">
                  Titik Anda: {consumerIdentity.addressDetail || gpsSourceLabel}
                </div>
                {consumerIdentity.landmark && (
                  <div className="text-slate-600">Patokan: {consumerIdentity.landmark}</div>
                )}
                {activeSelectedLapak.distanceMeter !== undefined && (
                  <div className="text-violet-700 font-semibold">
                    Jarak pedagang saat ini: ±{activeSelectedLapak.distanceMeter} m
                  </div>
                )}
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  Pesan Cepat ke Pedagang:
                </label>
                <div className="flex flex-wrap gap-1 mb-1.5">
                  {[
                    'Mampir ke depan pagar ya!',
                    'Tunggu sebentar, saya keluar rumah.',
                    'Beli somay/sayur/ayam, bawa mampir.'
                  ].map(preset => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setPingNoteInput(preset)}
                      className="px-2 py-1 rounded-lg bg-violet-50 hover:bg-violet-100 border border-violet-200 text-violet-900 text-[10px] font-semibold"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
                <textarea
                  rows={2}
                  value={pingNoteInput}
                  onChange={e => setPingNoteInput(e.target.value)}
                  placeholder="Contoh: Rumah pagar hijau sebelah pos satpam..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800"
                />
              </div>

              <label className="flex items-center gap-2 text-[11px] text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={pingShareCoords}
                  onChange={e => setPingShareCoords(e.target.checked)}
                  className="rounded border-slate-300 text-violet-700"
                />
                <span>Sertakan titik koordinat GPS agar mudah ditemukan</span>
              </label>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowPingModal(false)}
                  className="min-h-[42px] bg-slate-100 text-slate-700 rounded-xl text-xs font-bold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="min-h-[42px] bg-violet-700 hover:bg-violet-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5"
                >
                  <BellRing className="w-3.5 h-3.5" />
                  <span>Kirim Panggilan</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. MODAL: CONSUMER IDENTITY GATE BEFORE ORDER                             */}
      {/* ========================================================================= */}
      {showConsumerGateModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-xs z-50 flex items-center justify-center p-3">
          <div className="bg-white rounded-2xl w-full max-w-sm p-4 space-y-3 shadow-2xl">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-emerald-700" />
                <div>
                  <h3 className="text-xs font-black text-slate-900">Konfirmasi Identitas Pembeli</h3>
                  <p className="text-[10px] text-slate-500">Wajib diisi sekali agar pedagang yakin alamat antar Anda</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowConsumerGateModal(false);
                  setPendingCheckoutChannel(null);
                }}
                className="text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitConsumerGate} className="space-y-2.5">
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">Nama Lengkap Pembeli</label>
                <input
                  type="text"
                  required
                  value={gateName}
                  onChange={e => setGateName(e.target.value)}
                  placeholder="Nama lengkap Anda"
                  className="w-full min-h-[40px] bg-slate-50 border border-slate-200 rounded-xl px-3 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">No. WhatsApp Aktif</label>
                  <input
                    type="tel"
                    required
                    value={gatePhone}
                    onChange={e => setGatePhone(e.target.value)}
                    placeholder="0812-xxxx-xxxx"
                    className="w-full min-h-[40px] bg-slate-50 border border-slate-200 rounded-xl px-3 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">Wilayah RT / RW</label>
                  <input
                    type="text"
                    value={gateRtRw}
                    onChange={e => setGateRtRw(e.target.value)}
                    placeholder="RT 03 / RW 05"
                    className="w-full min-h-[40px] bg-slate-50 border border-slate-200 rounded-xl px-3 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">Alamat Blok / No. Rumah</label>
                <input
                  type="text"
                  required
                  value={gateAddress}
                  onChange={e => setGateAddress(e.target.value)}
                  placeholder="Contoh: Blok A No. 12"
                  className="w-full min-h-[40px] bg-slate-50 border border-slate-200 rounded-xl px-3 text-xs"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">Patokan Rumah (Opsional)</label>
                <input
                  type="text"
                  value={gateLandmark}
                  onChange={e => setGateLandmark(e.target.value)}
                  placeholder="Contoh: Pagar hitam depan pos ronda"
                  className="w-full min-h-[40px] bg-slate-50 border border-slate-200 rounded-xl px-3 text-xs"
                />
              </div>

              <button
                type="submit"
                className="w-full min-h-[44px] bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold"
              >
                Verifikasi & Lanjutkan Pesanan
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. MODAL: CHAT PENJUAL                                                    */}
      {/* ========================================================================= */}
      {showChatModal && selectedLapak && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-3">
          <div className="bg-white rounded-2xl w-full max-w-sm h-[75vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="bg-emerald-800 text-white p-3 flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xl">{selectedLapak.avatarIcon}</span>
                <div className="min-w-0">
                  <h3 className="text-xs font-bold truncate">{selectedLapak.name}</h3>
                  <p className="text-[10px] text-emerald-200 truncate">
                    {selectedLapak.ownerName}{selectedLapak.rtRw ? ` · ${selectedLapak.rtRw}` : ''}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => {
                    setShowChatModal(false);
                    onOpenChatQu();
                  }}
                  className="px-2 py-1 bg-emerald-700 hover:bg-emerald-600 text-[10px] font-bold rounded-lg"
                >
                  ChatQu
                </button>
                <button onClick={() => setShowChatModal(false)} className="p-1 text-emerald-200 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 bg-slate-100 p-3 overflow-y-auto space-y-2.5">
              {chatMessages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-relaxed whitespace-pre-line ${
                      msg.sender === 'user'
                        ? 'bg-emerald-700 text-white rounded-tr-none'
                        : 'bg-white text-slate-800 border border-slate-200 rounded-tl-none'
                    }`}
                  >
                    {msg.text}
                  </div>
                  <span className="text-[9px] text-slate-400 mt-0.5 px-1">{msg.time}</span>
                </div>
              ))}
            </div>

            <div className="p-2.5 bg-white border-t border-slate-200 flex items-center gap-2">
              <input
                type="text"
                value={chatInputText}
                onChange={e => setChatInputText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSendChatMessage()}
                placeholder="Ketik pesan ke penjual..."
                className="flex-1 min-h-[40px] bg-slate-100 rounded-xl px-3 text-xs text-slate-800 focus:outline-none"
              />
              <button
                onClick={handleSendChatMessage}
                className="w-10 h-10 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white flex items-center justify-center shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 7. MODAL: GPS CALIBRATION                                                 */}
      {/* ========================================================================= */}
      {showGpsModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs z-50 flex items-center justify-center p-3">
          <div className="bg-white rounded-2xl w-full max-w-sm max-h-[90vh] overflow-y-auto no-scrollbar p-4 space-y-3.5 shadow-2xl">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <LocateFixed className="w-4 h-4 text-emerald-700" />
                <div>
                  <h3 className="text-xs font-black text-slate-800">Kalibrasi Titik GPS Akurat</h3>
                  <p className="text-[10px] text-slate-500">Sesuaikan posisi GPS ke lokasi nyata Anda</p>
                </div>
              </div>
              <button onClick={() => setShowGpsModal(false)} className="text-slate-400">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Live Coordinate Readout */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-bold text-slate-700">Status Saat Ini:</span>
                <span
                  className={`font-bold ${
                    gpsAccuracy && gpsAccuracy <= 35
                      ? 'text-emerald-700'
                      : gpsAccuracy && gpsAccuracy > 250
                      ? 'text-amber-700'
                      : 'text-slate-700'
                  }`}
                >
                  {gpsSourceLabel}
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px] font-mono tabular-nums text-slate-600">
                <span>Lat: {userCoords[0].toFixed(6)}</span>
                <span>Lng: {userCoords[1].toFixed(6)}</span>
              </div>
              {gpsAccuracy && gpsAccuracy > 150 && (
                <p className="text-[10px] text-amber-700 leading-snug pt-0.5">
                  Akurasi jaringan ±{gpsAccuracy}m bisa bergeser dari posisi sebenarnya (umum di laptop/dalam ruangan). Gunakan "Tandai di Peta" untuk presisi tepat ke bangunan.
                </p>
              )}
              {gpsErrorDetail && (
                <p className="text-[10px] text-rose-600 font-semibold leading-snug pt-0.5">
                  {gpsErrorDetail}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <button
                onClick={() => {
                  handleAcquireRealGPS(false);
                  setShowGpsModal(false);
                }}
                className="w-full min-h-[48px] p-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold flex items-center justify-between"
              >
                <div className="flex items-center gap-2.5 text-left">
                  <RefreshCw className={`w-4 h-4 ${isGpsAcquiring ? 'animate-spin' : ''}`} />
                  <div>
                    <div>Deteksi Otomatis Sensor GPS HP</div>
                    <div className="text-[10px] text-emerald-100 font-normal">Kunci ulang koordinat presisi perangkat</div>
                  </div>
                </div>
                <ChevronDown className="w-4 h-4 -rotate-90" />
              </button>

              <button
                onClick={() => {
                  setIsSettingLapakPinOnMap(false);
                  setIsSettingUserPinOnMap(true);
                  setJelajahSubMode('peta');
                  setActiveTab('jelajah');
                  setShowGpsModal(false);
                  showNotification('Ketuk titik lokasi Anda langsung pada peta');
                }}
                className="w-full min-h-[44px] p-3 rounded-xl bg-sky-50 hover:bg-sky-100 border border-sky-200 text-sky-900 text-xs font-bold flex items-center justify-between"
              >
                <div className="flex items-center gap-2.5 text-left">
                  <Crosshair className="w-4 h-4 text-sky-700" />
                  <div>
                    <div>Tandai Langsung Titik Saya di Peta</div>
                    <div className="text-[10px] text-sky-700 font-normal">Geser peta &amp; ketuk tepat di lokasi Anda</div>
                  </div>
                </div>
                <ChevronDown className="w-4 h-4 -rotate-90 text-sky-700" />
              </button>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-700 block mb-1.5">
                Pilihan Cepat Wilayah:
              </label>
              <div className="space-y-1.5">
                {LOCATION_PRESETS.map((preset, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      applyResolvedCoords(preset.coords, null, 'preset', preset.name);
                      setShowGpsModal(false);
                      showNotification(`Titik GPS dipindahkan ke ${preset.name}`);
                    }}
                    className="w-full p-2.5 rounded-xl bg-slate-50 hover:bg-emerald-50 border border-slate-200 text-left flex items-center justify-between"
                  >
                    <div>
                      <div className="text-xs font-bold text-slate-800">{preset.name}</div>
                      <div className="text-[10px] text-slate-500">{preset.desc}</div>
                    </div>
                    <span className="text-[10px] font-bold text-emerald-700">Pilih</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 space-y-2">
              <label className="text-[11px] font-bold text-slate-700 block">
                Input Manual Lat / Lng (bisa tempel dari Google Maps):
              </label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={manualLatInput}
                  placeholder="-6.200000"
                  onChange={e => {
                    const val = e.target.value;
                    if (val.includes(',')) {
                      const parts = val.split(',').map(s => s.trim());
                      if (parts.length >= 2 && !isNaN(parseFloat(parts[0])) && !isNaN(parseFloat(parts[1]))) {
                        setManualLatInput(parts[0]);
                        setManualLngInput(parts[1]);
                        return;
                      }
                    }
                    setManualLatInput(val);
                  }}
                  className="bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-mono"
                />
                <input
                  type="text"
                  value={manualLngInput}
                  placeholder="106.816666"
                  onChange={e => setManualLngInput(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-mono"
                />
              </div>
              <button
                onClick={() => {
                  const lat = parseFloat(manualLatInput);
                  const lng = parseFloat(manualLngInput);
                  if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
                    showNotification('Koordinat tidak valid (Lat -90..90, Lng -180..180)');
                    return;
                  }
                  applyResolvedCoords(
                    [lat, lng],
                    null,
                    'manual',
                    `Manual: ${lat.toFixed(4)}, ${lng.toFixed(4)}`
                  );
                  setShowGpsModal(false);
                  showNotification('Koordinat GPS manual diterapkan');
                }}
                className="w-full min-h-[42px] bg-emerald-700 text-white rounded-xl text-xs font-bold"
              >
                Terapkan Koordinat Manual
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 8. MODAL: TAMBAH PRODUK KATALOG (PEDAGANG)                                */}
      {/* ========================================================================= */}
      {showAddProductModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs z-50 flex items-center justify-center p-3">
          <div className="bg-white rounded-2xl w-full max-w-sm p-4 space-y-3 shadow-2xl">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <span className="font-bold text-xs text-slate-800">Tambah Produk Menu Lapak</span>
              <button onClick={() => setShowAddProductModal(false)} className="text-slate-400">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddNewProduct} className="space-y-2.5">
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">Nama Produk / Menu</label>
                <input
                  type="text"
                  required
                  value={newProductName}
                  onChange={e => setNewProductName(e.target.value)}
                  placeholder="Contoh: Bakso Mercon Kuah Pedas"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">Harga (Rp)</label>
                  <input
                    type="number"
                    required
                    value={newProductPrice}
                    onChange={e => setNewProductPrice(e.target.value)}
                    placeholder="25000"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">Kategori</label>
                  <select
                    value={newProductCategory}
                    onChange={e => setNewProductCategory(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs"
                  >
                    <option value="Makanan">Makanan</option>
                    <option value="Minuman">Minuman</option>
                    <option value="Sembako">Sembako</option>
                    <option value="Camilan">Camilan</option>
                    <option value="Jasa">Jasa</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">Deskripsi Singkat</label>
                <textarea
                  rows={2}
                  value={newProductDesc}
                  onChange={e => setNewProductDesc(e.target.value)}
                  placeholder="Keterangan porsi atau bahan..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs"
                />
              </div>
              <div className="pt-1 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddProductModal(false)}
                  className="flex-1 min-h-[42px] bg-slate-100 text-slate-700 rounded-xl text-xs font-bold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 min-h-[42px] bg-emerald-700 text-white rounded-xl text-xs font-bold"
                >
                  Simpan Produk
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 9. MODAL: LIVE PREVIEW LAPAK                                              */}
      {/* ========================================================================= */}
      {showPreviewModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs z-50 flex items-center justify-center p-3">
          <div className="bg-white rounded-2xl w-full max-w-sm p-4 space-y-3 shadow-2xl">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <span className="font-bold text-xs text-slate-800">Pratinjau Tampilan Lapak Customer</span>
              <button onClick={() => setShowPreviewModal(false)} className="text-slate-400">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 flex items-center gap-3">
              <span className="text-3xl">{myLapak.avatarIcon}</span>
              <div className="min-w-0">
                <h4 className="text-xs font-black text-slate-900 truncate">{myLapak.name}</h4>
                <p className="text-[11px] text-slate-600 truncate">
                  {myLapak.ownerName}{myLapak.rtRw ? ` · ${myLapak.rtRw}` : ''}
                </p>
                <p className="text-[10px] text-slate-500 truncate">{myLapak.address}</p>
              </div>
            </div>

            <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
              {myLapak.catalog.map(prod => (
                <div key={prod.id} className="p-2 rounded-lg bg-slate-50 border border-slate-100 flex justify-between items-center text-xs">
                  <div className="min-w-0 pr-2">
                    <div className="font-bold text-slate-800 truncate">{prod.name}</div>
                    <div className="text-[10px] text-slate-500 truncate">{prod.description}</div>
                  </div>
                  <div className="font-extrabold text-emerald-700 font-mono tabular-nums shrink-0">
                    Rp {prod.price.toLocaleString('id-ID')}
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => setShowPreviewModal(false)}
              className="w-full min-h-[42px] bg-slate-800 text-white rounded-xl text-xs font-bold"
            >
              Tutup Pratinjau
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 10. MODAL: RADIUS SELECTOR                                                */}
      {/* ========================================================================= */}
      {showRadiusModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-xs p-4 space-y-3 shadow-2xl">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <span className="font-bold text-xs text-slate-800">Pilih Radius Radar Kawasan</span>
              <button onClick={() => setShowRadiusModal(false)} className="text-slate-400">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-1.5">
              {[
                { value: 500, label: '500 m (Lingkup RT)' },
                { value: 1000, label: '1 km (Lingkup RW)' },
                { value: 5000, label: '5 km (Kecamatan)' },
                { value: 10000, label: '10 km (Kota)' },
                { value: 25000, label: '25 km (Kawasan)' },
                { value: 50000, label: '50 km (Antar Kota)' },
                { value: 100000, label: '100 km (Maksimal)' }
              ].map(opt => (
                <button
                  key={opt.value}
                  onClick={() => {
                    setSelectedRadius(opt.value);
                    setShowRadiusModal(false);
                    showNotification(`Radius radar disetel ke ${opt.label}`);
                  }}
                  className={`w-full p-2.5 rounded-xl text-left text-xs font-bold flex items-center justify-between transition ${
                    selectedRadius === opt.value
                      ? 'bg-emerald-50 border border-emerald-500 text-emerald-800'
                      : 'hover:bg-slate-100 text-slate-700'
                  }`}
                >
                  <span>{opt.label}</span>
                  {selectedRadius === opt.value && <CheckCircle className="w-4 h-4 text-emerald-600" />}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
      <ModularFeeSheet
        isOpen={lapakFeeModal.open}
        moduleId="areaqu_lapak"
        actionLabel={lapakFeeModal.actionLabel}
        unlockModule={true}
        onClose={() => setLapakFeeModal({ open: false, actionLabel: '', onPaidCallback: null })}
        onPaid={() => {
          const cb = lapakFeeModal.onPaidCallback;
          setLapakFeeModal({ open: false, actionLabel: '', onPaidCallback: null });
          if (cb) cb();
        }}
        showNotification={showNotification}
      />
    </div>
  );
};
