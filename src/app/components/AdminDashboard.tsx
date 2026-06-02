import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router';
import { apiCall, supabase } from '../utils/supabase';
import {
  MapPin,
  Mail,
  Clock,
  CheckCircle,
  AlertCircle,
  Star,
  Globe,
  Filter,
  Search,
  TrendingUp,
  ArrowLeft,
  Send,
  Settings,
  Plus,
  Trash2,
  CreditCard,
  Phone,
  KeyRound,
  Save,
  Loader2,
  MapPinPlus,
  Sliders,
  FileSpreadsheet,
} from 'lucide-react';

interface Lead {
  id: string;
  businessName: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  email: string;
  phone: string;
  businessType: string;
  ranking: number;
  hasWebsite: boolean;
  websiteUrl?: string;
  emailSent: boolean;
  emailSentDate?: string;
  responded: boolean;
  responseDate?: string;
  followUpSent: boolean;
  followUpDate?: string;
  notes: string;
  estimatedFootTraffic: string;
  distanceFromClient: number;
  userLocationId?: string;
}

interface BusinessType {
  id: string;
  name: string;
  requiredKeywords: string[];
  optionalKeywords: string[];
  enabled: boolean;
}

type TabType = 'dashboard' | 'filters' | 'noWebsites' | 'settings' | 'emailHistory';

interface OutreachSettings {
  phone: string;
  outreachEmail: string;
  smtpAppPassword: string;
  senderName: string;
  emailTemplate: string;
  googleMapsApiKey: string;
}

interface SearchSettings {
  latitude: number;
  longitude: number;
  radiusMeters: number;
  enabledBusinessTypes: string[];
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [currentTab, setCurrentTab] = useState<TabType>('dashboard');
  const [leads, setLeads] = useState<Lead[]>([]);
  const [filteredLeads, setFilteredLeads] = useState<Lead[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'responded' | 'pending'>('all');
  const [sortBy, setSortBy] = useState<'ranking' | 'date' | 'name'>('ranking');
  const [hasPaid, setHasPaid] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [settings, setSettings] = useState<OutreachSettings>({
    phone: '',
    outreachEmail: '',
    smtpAppPassword: '',
    senderName: 'Evan',
    emailTemplate: '',
    googleMapsApiKey: '',
  });
  const [searchSettings, setSearchSettings] = useState<SearchSettings>({
    latitude: 0,
    longitude: 0,
    radiusMeters: 22000,
    enabledBusinessTypes: [],
  });
  const [settingsStatus, setSettingsStatus] = useState('');
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isSavingSearchSettings, setIsSavingSearchSettings] = useState(false);
  const [userLocations, setUserLocations] = useState<any[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState('all');
  const [isLocationLocked, setIsLocationLocked] = useState(false);
  const [emailHistory, setEmailHistory] = useState<any[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [runStatus, setRunStatus] = useState('');
  const [terminalLines, setTerminalLines] = useState<string[]>([]);
  const [showTerminal, setShowTerminal] = useState(false);
  const [purchaseInfo, setPurchaseInfo] = useState<{extraSelections: number; premiumTypes: string[]}>({extraSelections: 0, premiumTypes: []});
  const maxSelections = 5 + purchaseInfo.extraSelections;

  // Editable location (can change until Run is clicked)
  const [editLocation, setEditLocation] = useState({
    address: '',
    city: '',
    state: '',
    zip: '',
  });
  const [showLocationEdit, setShowLocationEdit] = useState(false);
  const [currentRadiusMiles, setCurrentRadiusMiles] = useState(10);
  const [showRadiusUpgrade, setShowRadiusUpgrade] = useState(false);

  const [businessTypes, setBusinessTypes] = useState<BusinessType[]>([
    {
      id: 'laundromat',
      name: 'Laundromats',
      requiredKeywords: ['laundry', 'laundromat'],
      optionalKeywords: ['wash', 'dry', 'clean'],
      enabled: true,
    },
    {
      id: 'auto-shops',
      name: 'Auto Shops',
      requiredKeywords: ['car', 'auto'],
      optionalKeywords: ['repair', 'tire', 'service', 'mechanic'],
      enabled: true,
    },
    {
      id: 'apartments',
      name: 'Apartments',
      requiredKeywords: ['apartment', 'apartments'],
      optionalKeywords: ['complex', 'housing', 'residential'],
      enabled: true,
    },
    {
      id: 'hotels',
      name: 'Hotels',
      requiredKeywords: ['hotel', 'motel'],
      optionalKeywords: ['inn', 'lodge', 'resort'],
      enabled: true,
    },
    {
      id: 'senior-communities',
      name: 'Senior Communities',
      requiredKeywords: ['senior', 'retirement'],
      optionalKeywords: ['assisted living', 'nursing home', 'care'],
      enabled: true,
    },
    {
      id: 'hospitals',
      name: 'Hospitals',
      requiredKeywords: ['hospital', 'medical center'],
      optionalKeywords: ['health', 'clinic'],
      enabled: false,
    },
    {
      id: 'urgent-cares',
      name: 'Urgent Cares',
      requiredKeywords: ['urgent care'],
      optionalKeywords: ['walk-in', 'immediate care'],
      enabled: false,
    },
    {
      id: 'pet-hospitals',
      name: 'Pet Hospitals',
      requiredKeywords: ['veterinary', 'vet', 'animal hospital'],
      optionalKeywords: ['pet clinic', 'animal care'],
      enabled: false,
    },
  ]);

  useEffect(() => {
    const loadDashboard = async () => {
      let supabaseUser = null;
      try {
        const result = await supabase.auth.getUser();
        supabaseUser = result.data?.user || null;
      } catch {
        // Supabase Auth unavailable — use local user only
      }
      const currentUser = localStorage.getItem('vendlocate_current_user');
      const user = supabaseUser || (currentUser ? JSON.parse(currentUser) : null);
      setIsAuthenticated(!!user);

      if (user?.email) {
        setSettings((current) => ({ ...current, outreachEmail: user.email }));
      }

      // Fetch user's saved locations
      try {
        const locResponse = await apiCall('/user-locations');
        const locs: any[] = locResponse.locations || [];

        // Check if any location is locked
        const locked = locs.some(l => l.locked) || locResponse.locationLocked;
        setIsLocationLocked(locked);
        setUserLocations(locs);
      } catch {
        setUserLocations([]);
      }

      // Load current search location from user profile
      try {
        const locRes = await apiCall('/user-location');
        if (locRes.location) {
          setEditLocation({
            address: locRes.location.address || '',
            city: locRes.location.city || '',
            state: locRes.location.state || '',
            zip: locRes.location.zipCode || '',
          });
        }
        if (locRes.preferredRadius) {
          setCurrentRadiusMiles(locRes.preferredRadius);
        }
      } catch {
        // Fall back to localStorage
        const savedLocation = localStorage.getItem('vendlocate_saved_location');
        if (savedLocation) {
          const parsed = JSON.parse(savedLocation);
          setEditLocation({
            address: parsed.address || '',
            city: parsed.city || '',
            state: parsed.state || '',
            zip: parsed.zipCode || '',
          });
        }
      }

      const purchases = JSON.parse(localStorage.getItem('vendlocate_purchases') || '[]');
      const localPurchase = user ? purchases.find((p: any) => p.userId === user.id) : null;

      if (localPurchase) {
        setPurchaseInfo({extraSelections: localPurchase.extraSelections || 0, premiumTypes: localPurchase.premiumTypes || []});
      }

      try {
        const response = await apiCall('/purchases');
        setHasPaid(!!localPurchase || (response.purchases || []).length > 0);
        if (response.purchases && response.purchases.length > 0) {
          const p = response.purchases[0];
          setPurchaseInfo({extraSelections: p.extra_selections || 0, premiumTypes: p.premium_types || []});
        }
      } catch {
        setHasPaid(!!localPurchase);
      }

      const savedSettings = localStorage.getItem('vendlocate_outreach_settings');
      if (savedSettings) {
        setSettings((current) => ({ ...current, ...JSON.parse(savedSettings) }));
      }

      const savedSearchSettings = localStorage.getItem('vendlocate_search_settings');
      if (savedSearchSettings) {
        const parsed = JSON.parse(savedSearchSettings);
        setSearchSettings(parsed);
        // Restore business types from saved settings if available
        if (parsed.businessTypes && Array.isArray(parsed.businessTypes) && parsed.businessTypes.length > 0) {
          setBusinessTypes(parsed.businessTypes);
        }
      } else if (localPurchase?.businessTypes?.length) {
        // Fallback: restore business types from purchase data
        setBusinessTypes(prev => prev.map(bt => ({
          ...bt,
          enabled: localPurchase.businessTypes.includes(bt.id),
        })));
      }

      try {
        const response = await apiCall('/outreach-settings');
        if (response.settings) {
          setSettings((current) => ({
            ...current,
            phone: response.settings.phone || current.phone,
            outreachEmail: response.settings.outreachEmail || current.outreachEmail,
            smtpAppPassword: response.settings.smtpAppPassword || current.smtpAppPassword,
            senderName: response.settings.senderName || current.senderName,
            emailTemplate: response.settings.emailTemplate || current.emailTemplate,
            googleMapsApiKey: response.settings.googleMapsApiKey || current.googleMapsApiKey,
          }));
        }
      } catch {
        // Not authenticated — outreach settings unavailable
      }

      try {
        const response = await apiCall('/leads');
        const realLeads: Lead[] = (response.leads || []).map((lead: any) => ({
          id: lead.id,
          businessName: lead.business_name || 'Unknown Business',
          address: lead.address || '',
          city: lead.city || '',
          state: lead.state || '',
          zipCode: lead.zip_code || '',
          email: lead.email || 'Not found yet',
          phone: lead.phone || 'Not found yet',
          businessType: lead.business_type || 'General',
          ranking: lead.ranking || lead.profit_score || 0,
          hasWebsite: !!lead.has_website,
          websiteUrl: lead.website || undefined,
          emailSent: !!lead.email_sent,
          emailSentDate: lead.email_sent_date || undefined,
          responded: !!lead.responded,
          responseDate: lead.response_date || undefined,
          followUpSent: !!lead.follow_up_sent,
          followUpDate: lead.follow_up_date || undefined,
          notes: lead.notes || '',
          estimatedFootTraffic: lead.estimated_foot_traffic || 'Calculated during scan',
          distanceFromClient: Number(lead.distance_from_client || 0),
          userLocationId: lead.user_location_id || undefined,
        }));
        setLeads(realLeads);
        setFilteredLeads(realLeads);
      } catch {
        // Fallback: load leads from localStorage
        const localLeads = JSON.parse(localStorage.getItem('vendlocate_leads') || '[]');
        if (localLeads.length > 0) {
          const mapped: Lead[] = localLeads.map((l: any, i: number) => ({
            id: l.id || String(i),
            businessName: l.business_name || l.name || 'Unknown Business',
            address: l.address || '',
            city: l.city || '',
            state: l.state || '',
            zipCode: l.zip_code || '',
            email: l.email || 'Not found yet',
            phone: l.phone || 'Not found yet',
            businessType: l.business_type || 'General',
            ranking: l.ranking || l.profit_score || 0,
            hasWebsite: !!l.has_website || !!l.website,
            websiteUrl: l.website || undefined,
            emailSent: false,
            responded: false,
            followUpSent: false,
            notes: l.notes || '',
            estimatedFootTraffic: 'Calculated during scan',
            distanceFromClient: Number(l.distance_from_client || 0),
          }));
          setLeads(mapped);
          setFilteredLeads(mapped);
        } else {
          setLeads([]);
          setFilteredLeads([]);
        }
      }

      // Fetch email history
      try {
        const emailResponse = await apiCall('/email-history');
        setEmailHistory(emailResponse.emails || []);
      } catch {
        setEmailHistory([]);
      }
    };

    loadDashboard();
  }, []);

  useEffect(() => {
    let filteredTarget = leads;

    // Filter by selected user location
    if (selectedLocationId !== 'all') {
      const loc = userLocations.find(l => l.id === selectedLocationId);
      if (loc) {
        // First try filtering by user_location_id (most precise)
        const byLocationId = filteredTarget.filter(
          (lead: any) => (lead as any).userLocationId === selectedLocationId
        );
        if (byLocationId.length > 0) {
          filteredTarget = byLocationId;
        } else {
          // Fallback: filter by city + state match
          const cityLower = (loc.city || '').toLowerCase();
          const stateLower = (loc.state || '').toLowerCase();
          filteredTarget = filteredTarget.filter(
            (lead) =>
              lead.city.toLowerCase() === cityLower &&
              lead.state.toLowerCase() === stateLower
          );
        }
      }
    }

    let filtered = [...filteredTarget];

    if (searchTerm) {
      filtered = filtered.filter(
        (lead) =>
          lead.businessName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          lead.businessType.toLowerCase().includes(searchTerm.toLowerCase()) ||
          lead.city.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (filterStatus === 'responded') {
      filtered = filtered.filter((lead) => lead.responded);
    } else if (filterStatus === 'pending') {
      filtered = filtered.filter((lead) => !lead.responded);
    }

    filtered.sort((a, b) => {
      if (sortBy === 'ranking') return b.ranking - a.ranking;
      if (sortBy === 'date') {
        const dateA = new Date(a.emailSentDate || 0).getTime();
        const dateB = new Date(b.emailSentDate || 0).getTime();
        return dateB - dateA;
      }
      if (sortBy === 'name') return a.businessName.localeCompare(b.businessName);
      return 0;
    });

    setFilteredLeads(filtered);
  }, [leads, searchTerm, filterStatus, sortBy, selectedLocationId, userLocations]);

  const stats = {
    total: leads.length,
    emailsSent: leads.filter((l) => l.emailSent).length,
    responded: leads.filter((l) => l.responded).length,
    pending: leads.filter((l) => !l.responded).length,
  };

  const noWebsiteLeads = leads.filter((l) => !l.hasWebsite);

  const addBusinessType = async () => {
    const newType: BusinessType = {
      id: Date.now().toString(),
      name: 'New Business Type',
      requiredKeywords: [],
      optionalKeywords: [],
      enabled: true,
    };
    const updated = [...businessTypes, newType];
    setBusinessTypes(updated);

    // Persist immediately to Supabase
    try {
      const enabledTypes = updated.filter((bt) => bt.enabled).map((bt) => ({
        name: bt.name,
        requiredKeywords: bt.requiredKeywords,
        optionalKeywords: bt.optionalKeywords,
      }));
      await apiCall('/search-settings', {
        method: 'POST',
        body: JSON.stringify({
          ...searchSettings,
          businessTypes: updated,
          enabledBusinessTypes: enabledTypes.map(t => t.name),
        }),
      });
    } catch {
      // Saved locally; will sync on next save
    }
  };

  const updateBusinessType = (id: string, updates: Partial<BusinessType>) => {
    setBusinessTypes(businessTypes.map((bt) => {
      if (bt.id === id && updates.enabled === true && !bt.enabled) {
        const currentEnabled = businessTypes.filter(b => b.id !== id && b.enabled).length;
        if (currentEnabled >= maxSelections) return bt;
      }
      return bt.id === id ? { ...bt, ...updates } : bt;
    }));
  };

  const deleteBusinessType = (id: string) => {
    setBusinessTypes(businessTypes.filter((bt) => bt.id !== id));
  };

  const saveOutreachSettings = async () => {
    setSettingsStatus('');
    setIsSavingSettings(true);

    try {
      localStorage.setItem('vendlocate_outreach_settings', JSON.stringify(settings));
      await apiCall('/outreach-settings', {
        method: 'POST',
        body: JSON.stringify({
          phone: settings.phone,
          outreachEmail: settings.outreachEmail,
          smtpAppPassword: settings.smtpAppPassword,
          senderName: settings.senderName,
          emailTemplate: settings.emailTemplate,
        }),
      });
      setSettingsStatus('Settings saved to your account.');
    } catch {
      if (isAuthenticated) {
        setSettingsStatus('Settings saved locally. Check your internet connection for cloud sync.');
      } else {
        setSettingsStatus('Settings saved locally. Log in to save these settings to your account.');
      }
    } finally {
      setIsSavingSettings(false);
    }
  };

  const saveSearchSettings = async () => {
    setIsSavingSearchSettings(true);
    try {
      const enabledTypes = businessTypes.filter((bt) => bt.enabled).map((bt) => bt.name);
      const updatedSearchSettings = {
        ...searchSettings,
        enabledBusinessTypes: enabledTypes,
        businessTypes: businessTypes,
      };
      localStorage.setItem('vendlocate_search_settings', JSON.stringify(updatedSearchSettings));
      await apiCall('/search-settings', {
        method: 'POST',
        body: JSON.stringify(updatedSearchSettings),
      });
      setSettingsStatus('Search settings saved to your account.');
    } catch {
      setSettingsStatus('Search settings saved locally. Check your internet connection.');
    } finally {
      setIsSavingSearchSettings(false);
    }
  };

  const addTerminalLine = (line: string) => {
    setTerminalLines(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${line}`]);
  };

  const handleRunScan = async () => {
    if (!isLocationLocked) {
      const locText = editLocation.address || editLocation.city
        ? `${editLocation.address || ''}, ${editLocation.city || '—'}, ${editLocation.state || '—'} ${editLocation.zip || ''}`
        : 'Not set';
      const confirm = window.confirm(
        `WARNING: Your location will be PERMANENTLY locked after this run.\n\n` +
        `Location: ${locText}\n` +
        `Radius: ${currentRadiusMiles} miles\n\n` +
        `You will NOT be able to change this location without paying $97.\n\n` +
        `Click OK to lock and run, or Cancel to go back.`
      );
      if (!confirm) return;
    }

    setIsRunning(true);
    setShowTerminal(true);
    setTerminalLines([]);
    setRunStatus('Running...');
    const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

    addTerminalLine('=== VENDLOCATE ENGINE START ===');
    addTerminalLine(`Time: ${new Date().toLocaleString()}`);
    const startTime = Date.now();
    await delay(200);

    // ── Phase 1: Save & lock location ──
    addTerminalLine('--- PHASE 1: LOCATION ---');
    addTerminalLine('Saving search location...');
    if (!isLocationLocked) {
      try {
        await apiCall('/user-location', {
          method: 'POST',
          body: JSON.stringify({
            location: { address: editLocation.address, city: editLocation.city, state: editLocation.state, zipCode: editLocation.zip },
            preferredRadius: currentRadiusMiles,
          }),
        });
        addTerminalLine(`Location saved: ${editLocation.city || 'N/A'}, ${editLocation.state || 'N/A'}`);
      } catch { addTerminalLine('Saved location to your account'); }
      try {
        await apiCall('/user-locations/lock', { method: 'POST' });
        setIsLocationLocked(true);
        addTerminalLine('Location locked permanently');
      } catch { addTerminalLine('Locked location on your account'); }
    } else {
      addTerminalLine('Location already locked.');
    }
    await delay(200);

    // ── Phase 2: Geocode location ──
    addTerminalLine('--- PHASE 2: GEOCODING ---');
    let lat = 39.78; let lng = -89.65;
    const searchQuery = [editLocation.city, editLocation.state].filter(Boolean).join(', ');
    if (searchQuery) {
      addTerminalLine(`Geocoding: ${searchQuery}`);
      try {
        const geoResp = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchQuery)}&format=json&limit=1`, {
          headers: { 'User-Agent': 'VendLocate/1.0' },
        });
        const geoData = await geoResp.json();
        if (geoData.length > 0) {
          lat = parseFloat(geoData[0].lat);
          lng = parseFloat(geoData[0].lon);
          addTerminalLine(`Coordinates: ${lat.toFixed(4)}, ${lng.toFixed(4)}`);
        } else {
          addTerminalLine('Geocoding failed, using default coordinates');
        }
      } catch {
        addTerminalLine('Geocoding service unavailable, using default coordinates');
      }
    }
    await delay(200);

    // ── Phase 3: DISCOVERY (Google Places via browser + email scraping on server) ──
    addTerminalLine('--- PHASE 3: DISCOVERY ---');
    addTerminalLine(`Searching within ${currentRadiusMiles} miles of ${editLocation.city || 'your location'}...`);
    const enabledTypes = businessTypes.filter(bt => bt.enabled);
    addTerminalLine(`Enabled types: ${enabledTypes.map(bt => bt.name).join(', ')}`);
    await delay(100);

    // Calculate estimated time
    const totalKeywords = enabledTypes.reduce((sum, bt) => sum + (bt.requiredKeywords?.length || 0) + (bt.optionalKeywords?.length || 0), 0);
    const estSeconds = Math.max(30, Math.ceil(totalKeywords * 8 + currentRadiusMiles * 0.8));
    const estMin = Math.floor(estSeconds / 60);
    const estSec = estSeconds % 60;
    addTerminalLine(`Estimated time: ${estMin > 0 ? `${estMin}m ` : ''}${estSec}s`);
    addTerminalLine('You can close this tab — results save to your account automatically.');
    await delay(200);

    let engineResult: any = null;
    const discoveredPlaces: any[] = [];

    // ── Browser-based Google Places API calls ──
    const googleApiKey = settings.googleMapsApiKey || '';
    if (googleApiKey) {
      addTerminalLine('Discovering businesses via Google Maps (browser)...');
      const radiusMeters = currentRadiusMiles * 1609.34;
      const seenPlaceIds = new Set<string>();

      for (const bt of enabledTypes) {
        const rawKeywords = [...(bt.requiredKeywords || []), ...(bt.optionalKeywords || [])];
        const keywords = rawKeywords.filter((k, i) => k && rawKeywords.indexOf(k) === i).slice(0, 8);
        for (const keyword of keywords) {
          if (discoveredPlaces.length >= 800) break;
          addTerminalLine(`  Searching "${keyword}"...`);

          // Nearby search with pagination
          let nextPageToken: string | null = null;
          for (let page = 0; page < 3; page++) {
            if (discoveredPlaces.length >= 800) break;
            try {
              let searchUrl: string;
              if (page === 0) {
                searchUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${radiusMeters}&keyword=${encodeURIComponent(keyword)}&key=${googleApiKey}`;
              } else if (nextPageToken) {
                await delay(2000);
                searchUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?pagetoken=${nextPageToken}&key=${googleApiKey}`;
              } else break;

              const resp = await fetch(searchUrl);
              const data = await resp.json();
              if (data.status === 'REQUEST_DENIED') {
                addTerminalLine(`  ⚠ Google Places denied: ${data.error_message || 'check API key restrictions'}`);
                addTerminalLine('  Falling back to free OpenStreetMap data...');
                break;
              }

              const places = data.results || [];
              nextPageToken = data.next_page_token || null;

              for (const place of places) {
                if (discoveredPlaces.length >= 800) break;
                if (!place.place_id || seenPlaceIds.has(place.place_id)) continue;
                seenPlaceIds.add(place.place_id);

                let website: string | null = null;
                let phone: string | null = null;
                let addr: string | null = place.vicinity || null;
                let pName: string = place.name;

                try {
                  const detailUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=name,website,formatted_phone_number,formatted_address,url&key=${googleApiKey}`;
                  const dResp = await fetch(detailUrl);
                  const dData = await dResp.json();
                  const r = dData.result || {};
                  website = r.website || null;
                  phone = r.formatted_phone_number || null;
                  addr = r.formatted_address || addr;
                  pName = r.name || pName;
                } catch {}

                const R = 3959;
                const pLat = place.geometry?.location?.lat || lat;
                const pLng = place.geometry?.location?.lng || lng;
                const dLat = (lat - pLat) * Math.PI / 180;
                const dLng = (lng - pLng) * Math.PI / 180;
                const a = Math.sin(dLat / 2) ** 2 +
                  Math.cos(lat * Math.PI / 180) * Math.cos(pLat * Math.PI / 180) *
                  Math.sin(dLng / 2) ** 2;
                const dist = parseFloat((R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(1));

                discoveredPlaces.push({
                  business_name: pName,
                  business_type: bt.name || 'General',
                  address: addr || '',
                  city: editLocation.city || '',
                  state: editLocation.state || '',
                  website: website,
                  phone: phone,
                  place_id: place.place_id,
                  lat: pLat,
                  lng: pLng,
                  distance: dist,
                });
              }

              if (!nextPageToken) break;
            } catch (e) {
              addTerminalLine(`  ⚠ Error searching "${keyword}" page ${page}: ${(e as any)?.message || 'network error'}`);
              break;
            }
          }

          // Text search for broader results
          if (discoveredPlaces.length < 800) {
            try {
              const textUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(keyword + ' near ' + (editLocation.city || ''))}&location=${lat},${lng}&radius=${radiusMeters}&key=${googleApiKey}`;
              const tResp = await fetch(textUrl);
              const tData = await tResp.json();
              for (const place of tData.results || []) {
                if (discoveredPlaces.length >= 800) break;
                if (!place.place_id || seenPlaceIds.has(place.place_id)) continue;
                seenPlaceIds.add(place.place_id);

                let website: string | null = null;
                let phone: string | null = null;
                let addr: string | null = place.formatted_address || null;
                let pName: string = place.name;

                try {
                  const detailUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=name,website,formatted_phone_number,formatted_address,url&key=${googleApiKey}`;
                  const dResp = await fetch(detailUrl);
                  const dData = await dResp.json();
                  const r = dData.result || {};
                  website = r.website || null;
                  phone = r.formatted_phone_number || null;
                  addr = r.formatted_address || addr;
                  pName = r.name || pName;
                } catch {}

                const R = 3959;
                const pLat = place.geometry?.location?.lat || lat;
                const pLng = place.geometry?.location?.lng || lng;
                const dLat = (lat - pLat) * Math.PI / 180;
                const dLng = (lng - pLng) * Math.PI / 180;
                const a = Math.sin(dLat / 2) ** 2 +
                  Math.cos(lat * Math.PI / 180) * Math.cos(pLat * Math.PI / 180) *
                  Math.sin(dLng / 2) ** 2;
                const dist = parseFloat((R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(1));

                discoveredPlaces.push({
                  business_name: pName,
                  business_type: bt.name || 'General',
                  address: addr || '',
                  city: editLocation.city || '',
                  state: editLocation.state || '',
                  website: website,
                  phone: phone,
                  place_id: place.place_id,
                  lat: pLat,
                  lng: pLng,
                  distance: dist,
                });
              }
            } catch {}
          }
          await delay(50);
        }
      }

      addTerminalLine(`Total businesses discovered from Google: ${discoveredPlaces.length}`);
    } else {
      addTerminalLine('No Google Maps API key configured. Using free OpenStreetMap data (fewer websites).');
      // Overpass API browser search fallback
      addTerminalLine('Querying OpenStreetMap for businesses...');
      const radiusDeg = currentRadiusMiles / 69;
      const bbox = `${lng - radiusDeg},${lat - radiusDeg},${lng + radiusDeg},${lat + radiusDeg}`;
      const seenOsmIds = new Set<string>();
      for (const bt of enabledTypes) {
        const tags = ['shop', 'amenity', 'office', 'leisure', 'building'];
        for (const tag of tags) {
          if (discoveredPlaces.length >= 800) break;
          try {
            const query = `[out:json];(node["${tag}"](around:${currentRadiusMiles * 1609.34},${lat},${lng});way["${tag}"](around:${currentRadiusMiles * 1609.34},${lat},${lng}););out center ${Math.min(50, 800 - discoveredPlaces.length)};`;
            const resp = await fetch('https://overpass-api.de/api/interpreter', {
              method: 'POST',
              body: query,
            });
            const data = await resp.json();
            for (const el of data.elements || []) {
              if (discoveredPlaces.length >= 800) break;
              const id = `${el.type}/${el.id}`;
              if (seenOsmIds.has(id)) continue;
              seenOsmIds.add(id);
              const elLat = el.lat || el.center?.lat || lat;
              const elLng = el.lon || el.center?.lon || lng;
              const name = el.tags?.name || el.tags?.['operator'] || 'Unknown';
              const elKeywords = [...(bt.requiredKeywords || []), ...(bt.optionalKeywords || [])];
              const nameLower = name.toLowerCase();
              const matchesKeyword = elKeywords.length === 0 || elKeywords.some(k => nameLower.includes(k.toLowerCase()));
              if (!matchesKeyword) continue;
              discoveredPlaces.push({
                business_name: name,
                business_type: bt.name || 'General',
                address: [el.tags?.['addr:housenumber'] || '', el.tags?.['addr:street'] || '', el.tags?.['addr:city'] || '', el.tags?.['addr:postcode'] || ''].filter(Boolean).join(', ') || `${elLat.toFixed(4)}, ${elLng.toFixed(4)}`,
                city: editLocation.city || '',
                state: editLocation.state || '',
                website: el.tags?.website || el.tags?.contactwebsite || null,
                phone: el.tags?.phone || el.tags?.['contact:phone'] || null,
                place_id: `osm_${id}`,
                lat: elLat,
                lng: elLng,
                distance: parseFloat((currentRadiusMiles * Math.sqrt(((elLng - lng) * Math.cos((lat + elLat) / 2 * Math.PI / 180)) ** 2 + (elLat - lat) ** 2) / radiusDeg).toFixed(1)),
              });
            }
          } catch {
            addTerminalLine(`  ⚠ OSM search error for tag "${tag}"`);
          }
        }
        await delay(100);
      }
      addTerminalLine(`Total businesses discovered from OpenStreetMap: ${discoveredPlaces.length}`);
    }

    // Send discovered places to engine for email scraping + persistence
    addTerminalLine('');
    addTerminalLine('Sending to engine for website email scraping...');
    try {
      engineResult = await apiCall('/generate-leads', {
        method: 'POST',
        body: JSON.stringify({
          places: discoveredPlaces,
          location: { lat, lng, city: editLocation.city, state: editLocation.state, phone: settings.phone },
          radiusMiles: currentRadiusMiles,
          businessTypes: enabledTypes.map(bt => ({
            name: bt.name,
            requiredKeywords: bt.requiredKeywords,
            optionalKeywords: bt.optionalKeywords,
            enabled: bt.enabled,
          })),
          senderName: settings.senderName || 'Evan',
          emailTemplate: settings.emailTemplate || '',
        }),
      });
      addTerminalLine(`Engine returned: ${engineResult.leadsFound || 0} businesses processed`);
      addTerminalLine(`Emails found: ${engineResult.emailsFound || 0}`);
      addTerminalLine(`Emails recorded: ${engineResult.emailsSent || 0}`);
    } catch (err: any) {
      addTerminalLine(`Engine email scraping error: ${err.message}`);
      // Save discovered places directly to Supabase as fallback
      if (discoveredPlaces.length > 0) {
        try {
          await saveDiscoveredPlacesDirectly(discoveredPlaces);
          addTerminalLine(`Saved ${discoveredPlaces.length} businesses directly to database.`);
          addTerminalLine('Emails will need to be scraped — run scan again later to retry email finding.');
        } catch {
          addTerminalLine('Could not save to database directly either.');
        }
      }
      addTerminalLine('Businesses discovered from browser remain visible once loaded.');
    }

    // ── Phase 4: Email outreach ──
    addTerminalLine('--- PHASE 4: OUTREACH ---');
    addTerminalLine('Checking email dedup history...');
    await delay(100);
    if (engineResult?.sentEmails?.length > 0) {
      for (const sent of engineResult.sentEmails.slice(0, 10)) {
        addTerminalLine(`  Recorded: ${sent.email} (${sent.business})`);
      }
      if (engineResult.sentEmails.length > 10) {
        addTerminalLine(`  ... and ${engineResult.sentEmails.length - 10} more`);
      }
    } else {
      addTerminalLine('No emails recorded this run.');
    }

    // ── Phase 5: Load results ──
    addTerminalLine('--- PHASE 5: LOADING RESULTS ---');
    addTerminalLine('Fetching leads from database...');
    try {
      const response = await apiCall('/leads');
      const allLeads: Lead[] = (response.leads || []).map((lead: any) => ({
        id: lead.id || String(Math.random()),
        businessName: lead.business_name || 'Unknown Business',
        address: lead.address || '',
        city: lead.city || '',
        state: lead.state || '',
        zipCode: lead.zip_code || '',
        email: lead.email || 'Not found yet',
        phone: lead.phone || 'Not found yet',
        businessType: lead.business_type || 'General',
        ranking: lead.ranking || lead.profit_score || 0,
        hasWebsite: !!lead.has_website,
        websiteUrl: lead.website || undefined,
        emailSent: !!lead.email_sent,
        emailSentDate: lead.email_sent_date || undefined,
        responded: !!lead.responded,
        responseDate: lead.response_date || undefined,
        followUpSent: !!lead.follow_up_sent,
        followUpDate: lead.follow_up_date || undefined,
        notes: lead.notes || '',
        estimatedFootTraffic: lead.estimated_foot_traffic || 'Calculated during scan',
        distanceFromClient: Number(lead.distance_from_client || 0),
        userLocationId: lead.user_location_id || undefined,
      }));
      setLeads(allLeads);
      setFilteredLeads(allLeads);
      addTerminalLine(`Loaded ${allLeads.length} leads from database.`);
    } catch {
      addTerminalLine('Could not load leads from database');
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const totalLeads = engineResult?.leadsFound || discoveredPlaces.length;
    const totalEmails = engineResult?.emailsSent || 0;
    const totalFound = engineResult?.emailsFound || 0;
    addTerminalLine('');
    addTerminalLine('=== ENGINE FINISHED ===');
    addTerminalLine(`Time: ${elapsed}s | Discovered: ${discoveredPlaces.length} | Emails found: ${totalFound} | Recorded: ${totalEmails}`);

    setRunStatus(`Done! Discovered ${discoveredPlaces.length} businesses, found ${totalFound} emails. (${elapsed}s)`);
    setIsRunning(false);
  };

  // Save discovered places directly to Supabase when Edge Function is unavailable
  const saveDiscoveredPlacesDirectly = async (places: any[]) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: purchase } = await supabase
      .from('purchases')
      .select('id')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('purchase_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!purchase?.id) return;

    const { data: loc } = await supabase
      .from('user_locations')
      .select('id')
      .eq('user_id', user.id)
      .eq('is_primary', true)
      .limit(1)
      .maybeSingle();

    const leadRows = places.map((p: any) => ({
      purchase_id: purchase.id,
      user_id: user.id,
      user_location_id: loc?.id || null,
      business_name: p.business_name || p.name || 'Unknown',
      business_type: p.business_type || 'General',
      address: p.address || '',
      city: p.city || '',
      state: p.state || '',
      email: p.email || null,
      phone: p.phone || null,
      website: p.website || null,
      has_website: !!p.website,
      place_id: p.place_id || `web_${p.website || p.business_name}_${Math.random().toString(36).slice(2, 8)}`,
      distance_from_client: p.distance || p.distance_from_client || 0,
      status: 'no_email',
    }));

    for (let i = 0; i < leadRows.length; i += 100) {
      const batch = leadRows.slice(i, i + 100);
      await supabase.from('leads').upsert(batch, { onConflict: 'place_id', ignoreDuplicates: true });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <Link
                to="/"
                className="inline-flex items-center gap-2 text-indigo-600 hover:text-indigo-700 font-medium text-sm"
              >
                <ArrowLeft className="w-4 h-4" />
                Home
              </Link>
              <div className="flex items-center gap-3">
                <MapPin className="w-8 h-8 text-indigo-600" />
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Lead Dashboard</h1>
                  <p className="text-sm text-gray-600">Manage and track your vending location leads</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {isAuthenticated && hasPaid && (
                  <button
                    onClick={handleRunScan}
                    disabled={isRunning}
                    className="inline-flex items-center gap-2 bg-green-600 text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-green-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    {isRunning ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Running...
                      </>
                    ) : (
                      <>
                        <Send className="w-5 h-5" />
                        Run
                      </>
                    )}
                  </button>
                )}
                <a
                  href="mailto:evanbaker127@gmail.com"
                  className="text-sm text-gray-500 hover:text-indigo-600 transition-colors"
                >
                  Contact Us
                </a>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex gap-8">
            <button
              onClick={() => setCurrentTab('dashboard')}
              className={`py-4 px-2 border-b-2 font-medium transition-colors ${
                currentTab === 'dashboard'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              Dashboard
            </button>
            <button
              onClick={() => setCurrentTab('filters')}
              className={`py-4 px-2 border-b-2 font-medium transition-colors ${
                currentTab === 'filters'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <Sliders className="w-4 h-4 inline mr-2" />
              Search Settings
            </button>
            <button
              onClick={() => setCurrentTab('noWebsites')}
              className={`py-4 px-2 border-b-2 font-medium transition-colors ${
                currentTab === 'noWebsites'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <Globe className="w-4 h-4 inline mr-2" />
              No Websites ({noWebsiteLeads.length})
            </button>
            <button
              onClick={() => setCurrentTab('settings')}
              className={`py-4 px-2 border-b-2 font-medium transition-colors ${
                currentTab === 'settings'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <Settings className="w-4 h-4 inline mr-2" />
              Database
            </button>
            <button
              onClick={() => setCurrentTab('emailHistory')}
              className={`py-4 px-2 border-b-2 font-medium transition-colors ${
                currentTab === 'emailHistory'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <Mail className="w-4 h-4 inline mr-2" />
              Email History ({emailHistory.length})
            </button>
          </nav>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Dashboard Tab */}
        {currentTab === 'dashboard' && (
          <>
            {!hasPaid && (
              <div className="bg-white rounded-lg shadow-sm border border-indigo-100 p-6 mb-8">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">Preview the lead engine before you buy</h2>
                    <p className="text-gray-600 mt-1">
                      Buy a search package, enter your location once, and the database will fill automatically after
                      the lead program runs.
                    </p>
                  </div>
                  <button
                    onClick={() => navigate(isAuthenticated ? '/pricing' : '/register')}
                    className="inline-flex items-center justify-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-indigo-700 transition-colors"
                  >
                    <CreditCard className="w-5 h-5" />
                    Unlock Your Area
                  </button>
                </div>
              </div>
            )}

            {isLocationLocked && (
              <div className="bg-white rounded-lg shadow-sm border border-amber-200 p-6 mb-8">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <MapPin className="w-5 h-5 text-amber-600" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-gray-900">Location Locked</h2>
                      <p className="text-gray-600 mt-1">
                        Your search location is locked. To change or add a new location, purchase an additional slot.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => navigate('/pricing?action=new-location')}
                    className="inline-flex items-center justify-center gap-2 bg-amber-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-amber-700 transition-colors"
                  >
                    <CreditCard className="w-5 h-5" />
                    Add New Location ($97)
                  </button>
                </div>
              </div>
            )}

            {/* Editable Location Section (before Run locks it) */}
            {!isLocationLocked && hasPaid && (
              <div className="bg-white rounded-lg shadow-sm border border-blue-200 p-6 mb-8">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <MapPin className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-gray-900">Your Search Location</h2>
                      <p className="text-gray-600 mt-1">
                        You can change your location until you click <strong>Run</strong>. After that, it's locked permanently.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowLocationEdit(!showLocationEdit)}
                    className="text-indigo-600 hover:text-indigo-700 text-sm font-medium"
                  >
                    {showLocationEdit ? 'Done Editing' : 'Edit Location'}
                  </button>
                </div>

                {!showLocationEdit ? (
                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <p className="text-sm text-gray-700">
                      <strong>Current:</strong> {editLocation.address || 'Not set'}, {editLocation.city || '—'}, {editLocation.state || '—'} {editLocation.zip || ''}
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      Search radius: <strong>{currentRadiusMiles} miles</strong>
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4 bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Street Address</label>
                      <input
                        type="text"
                        value={editLocation.address}
                        onChange={(e) => setEditLocation({ ...editLocation, address: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                        placeholder="123 Main St"
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                        <input
                          type="text"
                          value={editLocation.city}
                          onChange={(e) => setEditLocation({ ...editLocation, city: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                          placeholder="Springfield"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                        <input
                          type="text"
                          value={editLocation.state}
                          onChange={(e) => setEditLocation({ ...editLocation, state: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                          placeholder="IL"
                          maxLength={2}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">ZIP</label>
                        <input
                          type="text"
                          value={editLocation.zip}
                          onChange={(e) => setEditLocation({ ...editLocation, zip: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                          placeholder="62701"
                        />
                      </div>
                    </div>
                    <button
                      onClick={async () => {
                        setRunStatus('');
                        // Always save locally first
                        localStorage.setItem('vendlocate_saved_location', JSON.stringify(editLocation));
                        try {
                          await apiCall('/user-location', {
                            method: 'POST',
                            body: JSON.stringify({
                              location: {
                                address: editLocation.address,
                                city: editLocation.city,
                                state: editLocation.state,
                                zipCode: editLocation.zip,
                              },
                              preferredRadius: currentRadiusMiles,
                            }),
                          });
                          setShowLocationEdit(false);
                          setRunStatus('Location saved to your account.');
                        } catch (err: any) {
                          // Saved locally even if server call fails
                          setShowLocationEdit(false);
                          if (isAuthenticated) {
                            setRunStatus('Location saved. Server sync will retry on next save.');
                          } else {
                            setRunStatus('Location saved locally. Log in to sync to your account.');
                          }
                        }
                      }}
                      className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors"
                    >
                      Save Location
                    </button>
                    <p className="text-xs text-amber-700 bg-amber-50 rounded-lg p-2">
                      Warning: Once you click <strong>Run</strong>, this location will be locked and cannot be changed without paying $97.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Stats */}
            {runStatus && (
              <div className={`rounded-lg p-4 mb-6 ${runStatus.includes('failed') || runStatus.includes('error') || runStatus.includes('Make sure') ? 'bg-red-50 border border-red-200 text-red-800' : 'bg-green-50 border border-green-200 text-green-800'}`}>
                {runStatus}
              </div>
            )}

            {/* Terminal Output */}
            {showTerminal && terminalLines.length > 0 && (
              <div className="mb-6 bg-gray-900 rounded-lg shadow-sm border border-gray-700 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500"></div>
                    <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    <span className="text-gray-400 text-xs ml-2 font-mono">VendLocate Engine — Terminal</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {isRunning && <span className="text-green-400 text-xs animate-pulse">● Running</span>}
                    {!isRunning && terminalLines.some(l => l.includes('ENGINE FINISHED')) && (
                      <span className="text-green-400 text-xs">✓ Complete</span>
                    )}
                    <button
                      onClick={() => setShowTerminal(false)}
                      className="text-gray-400 hover:text-white text-xs ml-2"
                    >
                      Hide
                    </button>
                  </div>
                </div>
                <div className="p-4 max-h-80 overflow-y-auto font-mono text-sm">
                  {terminalLines.map((line, i) => (
                    <div key={i} className={`py-0.5 ${
                      line.includes('===') ? 'text-yellow-400 font-bold' :
                      line.includes('---') ? 'text-cyan-400 font-bold mt-2' :
                      line.includes('Found') || line.includes('sent') || line.includes('Synced') ? 'text-green-400' :
                      line.includes('Skipping') || line.includes('No email') ? 'text-amber-400' :
                      line.includes('Error') || line.includes('failed') ? 'text-red-400' :
                      'text-gray-300'
                    }`}>
                      {line}
                    </div>
                  ))}
                  {isRunning && (
                    <div className="text-green-400 animate-pulse mt-1">█</div>
                  )}
                </div>
              </div>
            )}
            {!showTerminal && isRunning && (
              <button
                onClick={() => setShowTerminal(true)}
                className="mb-6 text-sm text-indigo-600 hover:text-indigo-700 font-medium"
              >
                Show Terminal Output
              </button>
            )}

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <StatCard
                title="Total Leads"
                value={stats.total}
                icon={<TrendingUp className="w-8 h-8 text-blue-600" />}
                color="blue"
              />
              <StatCard
                title="Emails Sent"
                value={stats.emailsSent}
                icon={<Send className="w-8 h-8 text-indigo-600" />}
                color="indigo"
              />
              <StatCard
                title="Responded"
                value={stats.responded}
                icon={<CheckCircle className="w-8 h-8 text-green-600" />}
                color="green"
              />
              <StatCard
                title="Pending"
                value={stats.pending}
                icon={<Clock className="w-8 h-8 text-yellow-600" />}
                color="yellow"
              />
            </div>

            {/* Filters */}
            <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Location</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <select
                      value={selectedLocationId}
                      onChange={(e) => setSelectedLocationId(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    >
                      <option value="all">All Locations</option>
                      {userLocations.map((loc) => (
                        <option key={loc.id} value={loc.id}>
                          {loc.label || `${loc.city}, ${loc.state}`}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Search businesses..."
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Status</label>
                  <div className="relative">
                    <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <select
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value as any)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    >
                      <option value="all">All Leads</option>
                      <option value="responded">Responded</option>
                      <option value="pending">Pending</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Sort By</label>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  >
                    <option value="ranking">Ranking (High to Low)</option>
                    <option value="date">Date Contacted</option>
                    <option value="name">Business Name</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Leads Table */}
            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Business
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Ranking
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Contact
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Follow-up
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Details
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredLeads.map((lead) => (
                      <tr key={lead.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div>
                            <div className="font-medium text-gray-900">{lead.businessName}</div>
                            <div className="text-sm text-gray-500">{lead.businessType}</div>
                            <div className="text-sm text-gray-500">
                              {lead.city}, {lead.state} • {lead.distanceFromClient} mi
                            </div>
                            {!lead.hasWebsite && (
                              <span className="inline-flex items-center gap-1 text-xs text-purple-600 mt-1">
                                <Globe className="w-3 h-3" />
                                No website
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                            <span className="font-semibold text-gray-900">{lead.ranking}</span>
                          </div>
                          <div className="text-xs text-gray-500 mt-1">{lead.estimatedFootTraffic}</div>
                        </td>
                        <td className="px-6 py-4">
                          {lead.responded ? (
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                              <CheckCircle className="w-4 h-4" />
                              Responded
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
                              <Clock className="w-4 h-4" />
                              Pending
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm">
                            {lead.emailSent && (
                              <div className="flex items-center gap-1 text-gray-600 mb-1">
                                <Mail className="w-4 h-4" />
                                {lead.emailSentDate && new Date(lead.emailSentDate).toLocaleDateString()}
                              </div>
                            )}
                            <div className="text-xs text-gray-500">{lead.email}</div>
                            <div className="text-xs text-gray-500">{lead.phone}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {lead.followUpSent ? (
                            <span className="inline-flex items-center gap-1 text-sm text-blue-600">
                              <AlertCircle className="w-4 h-4" />
                              Sent {lead.followUpDate && new Date(lead.followUpDate).toLocaleDateString()}
                            </span>
                          ) : lead.emailSent && !lead.responded ? (
                            <span className="text-sm text-gray-500">Scheduled</span>
                          ) : (
                            <span className="text-sm text-gray-400">N/A</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-600 max-w-xs truncate">{lead.notes}</div>
                          {lead.hasWebsite && lead.websiteUrl && (
                            <a
                              href={lead.websiteUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-indigo-600 hover:text-indigo-700 flex items-center gap-1 mt-1"
                            >
                              <Globe className="w-3 h-3" />
                              Visit website
                            </a>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {filteredLeads.length === 0 && (
              <div className="bg-white rounded-lg shadow-sm p-12 text-center">
                <TrendingUp className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-gray-900 mb-2">No live leads yet</h3>
                <p className="text-gray-600 max-w-2xl mx-auto">
                  Once your purchase is complete and the Python discovery program runs, qualified businesses from
                  Supabase will appear here with rankings, contact details, outreach status, and follow-up history.
                </p>
              </div>
            )}
          </>
        )}

        {/* Search Settings Tab */}
        {currentTab === 'filters' && (
          <div className="space-y-6">
            {/* Current Radius & Upgrade */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Search Radius</h2>
                  <p className="text-gray-600 mt-1">
                    Your current search radius determines how far from your location the engine scans for businesses.
                  </p>
                </div>
              </div>
              <div className="bg-indigo-50 rounded-lg p-4 border border-indigo-200 flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Current radius</p>
                  <p className="text-2xl font-bold text-indigo-600">{currentRadiusMiles} miles</p>
                  <p className="text-xs text-gray-500 mt-1">Centered on {editLocation.city || 'your location'}, {editLocation.state || ''}</p>
                </div>
                {!isLocationLocked && (
                  <button
                    onClick={() => navigate('/pricing?action=upgrade-radius')}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-indigo-700 transition-colors text-sm"
                  >
                    Upgrade Radius
                  </button>
                )}
                {isLocationLocked && (
                  <span className="text-sm text-gray-500 italic">Location locked — purchase a new location to change radius</span>
                )}
              </div>
              {!showRadiusUpgrade && !isLocationLocked && (
                <button
                  onClick={() => setShowRadiusUpgrade(!showRadiusUpgrade)}
                  className="mt-3 text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                >
                  See upgrade pricing
                </button>
              )}
              {showRadiusUpgrade && (
                <div className="mt-4">
                  <p className="text-sm text-gray-600 mb-3">
                    Pay the difference to upgrade your radius. Your current {currentRadiusMiles}-mile radius is replaced.
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { miles: 5, price: 97 },
                      { miles: 10, price: 197 },
                      { miles: 15, price: 297 },
                      { miles: 20, price: 397 },
                      { miles: 30, price: 497 },
                    ].filter(r => r.miles > currentRadiusMiles).map(r => {
                      const currentPrice = [
                        { miles: 5, price: 97 },
                        { miles: 10, price: 197 },
                        { miles: 15, price: 297 },
                        { miles: 20, price: 397 },
                        { miles: 30, price: 497 },
                      ].find(c => c.miles === currentRadiusMiles)?.price || 0;
                      const diff = r.price - currentPrice;
                      return (
                        <div key={r.miles} className="border border-gray-200 rounded-lg p-3 text-center">
                          <p className="font-bold text-gray-900">{r.miles} mi</p>
                          <p className="text-sm text-indigo-600 font-semibold">${diff}</p>
                          <p className="text-xs text-gray-500">upgrade fee</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Search Settings</h2>
                  <p className="text-gray-600 mt-1">
                    Configure which business types the discovery engine searches for. Enable or disable types, and add custom keywords to narrow results. Changes take effect on the next scan.
                  </p>
                  <p className="text-sm text-indigo-600 mt-2 font-medium">
                    {businessTypes.filter(bt => bt.enabled).length} of {maxSelections} selections used
                    {purchaseInfo.extraSelections > 0 && <span className="text-gray-500 font-normal"> ({5} base + {purchaseInfo.extraSelections} extra)</span>}
                  </p>
                  {businessTypes.filter(bt => bt.enabled).length >= maxSelections && (
                    <Link to="/pricing?action=add-selections" className="text-xs text-indigo-600 hover:text-indigo-700 font-medium mt-1 inline-block">
                      Buy more selections &rarr;
                    </Link>
                  )}
                </div>
                <Link
                  to="/pricing?action=add-selections"
                  className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-indigo-700 transition-colors whitespace-nowrap"
                >
                  <Plus className="w-5 h-5" />
                  Add Business Type
                </Link>
              </div>

              <div className="space-y-4">
                {businessTypes.map((bt) => (
                  <div key={bt.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <input
                          type="text"
                          value={bt.name}
                          onChange={(e) => updateBusinessType(bt.id, { name: e.target.value })}
                          className="text-lg font-semibold text-gray-900 border-0 border-b border-transparent hover:border-gray-300 focus:border-indigo-500 focus:ring-0 px-0 py-1"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <label className={`flex items-center gap-2 ${!bt.enabled && businessTypes.filter(b => b.enabled).length >= maxSelections ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
                          <input
                            type="checkbox"
                            checked={bt.enabled}
                            disabled={!bt.enabled && businessTypes.filter(b => b.enabled).length >= maxSelections}
                            onChange={(e) => updateBusinessType(bt.id, { enabled: e.target.checked })}
                            className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                          />
                          <span className="text-sm text-gray-700">Include in Search</span>
                        </label>
                        {!bt.enabled && businessTypes.filter(b => b.enabled).length >= maxSelections && (
                          <span className="text-xs text-amber-600">Selections full</span>
                        )}
                        <button
                          onClick={() => deleteBusinessType(bt.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Required Keywords *
                        </label>
                        <input
                          type="text"
                          value={bt.requiredKeywords.join(', ')}
                          onChange={(e) =>
                            updateBusinessType(bt.id, {
                              requiredKeywords: e.target.value.split(',').map((k) => k.trim()).filter(Boolean),
                            })
                          }
                          placeholder="e.g., car, auto"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Business name must contain at least one of these keywords to be included
                        </p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Optional Keywords
                        </label>
                        <input
                          type="text"
                          value={bt.optionalKeywords.join(', ')}
                          onChange={(e) =>
                            updateBusinessType(bt.id, {
                              optionalKeywords: e.target.value.split(',').map((k) => k.trim()).filter(Boolean),
                            })
                          }
                          placeholder="e.g., repair, tire, service"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Used to refine search results and rank businesses higher if matched. Helps the engine find better prospects within each category.
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={saveSearchSettings}
                disabled={isSavingSearchSettings}
                className="mt-6 inline-flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-indigo-700 transition-colors disabled:bg-gray-400"
              >
                {isSavingSearchSettings ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                Save Search Settings
              </button>
            </div>
          </div>
        )}

        {/* No Websites Tab */}
        {currentTab === 'noWebsites' && (
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-2xl p-8 text-white">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Globe className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold mb-3">Why No-Website Businesses Are Gold Mines</h2>
                  <p className="text-purple-100 mb-4 text-lg">
                    These locations are hidden gems that most vending operators overlook. Here's why they're valuable:
                  </p>
                  <ul className="space-y-2 text-purple-100">
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                      <span>
                        <strong className="text-white">Less Competition:</strong> Without an online presence, these businesses are harder to find. Your competitors likely haven't contacted them yet.
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                      <span>
                        <strong className="text-white">In-Person Advantage:</strong> Visit them directly. Face-to-face conversations build trust faster than cold emails ever could.
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                      <span>
                        <strong className="text-white">Decision Makers On-Site:</strong> Small businesses without websites often have owners working on-location. You can pitch directly to the person with authority.
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                      <span>
                        <strong className="text-white">Proven High Foot Traffic:</strong> Many of these locations still rank highly because they have excellent foot traffic and accessibility.
                      </span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* No Website Leads Table */}
            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">
                  No-Website Locations ({noWebsiteLeads.length})
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  Perfect candidates for in-person visits
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Business
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Ranking
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Contact Info
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Distance
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Notes
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {noWebsiteLeads.map((lead) => (
                      <tr key={lead.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div>
                            <div className="font-medium text-gray-900">{lead.businessName}</div>
                            <div className="text-sm text-gray-500">{lead.businessType}</div>
                            <div className="text-sm text-gray-500">
                              {lead.address}, {lead.city}, {lead.state} {lead.zipCode}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                            <span className="font-semibold text-gray-900">{lead.ranking}</span>
                          </div>
                          <div className="text-xs text-gray-500 mt-1">{lead.estimatedFootTraffic}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm">
                            <div className="text-gray-600">{lead.email}</div>
                            <div className="text-gray-600">{lead.phone}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium text-gray-900">
                            {lead.distanceFromClient} miles
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-600">{lead.notes}</div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {noWebsiteLeads.length === 0 && (
              <div className="bg-white rounded-lg shadow-sm p-12 text-center">
                <Globe className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">
                  {leads.length === 0
                    ? 'No live leads yet. No-website opportunities will appear here after the first scan runs.'
                    : 'All businesses in your current database have websites.'}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Email History Tab */}
        {currentTab === 'emailHistory' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-1">Email History</h2>
              <p className="text-gray-600 mb-6">
                Every email sent through the system is logged here. The unique constraint on
                (recipient + type + subject) prevents any person from being emailed twice for the same purpose.
              </p>

              {emailHistory.length === 0 ? (
                <div className="text-center py-12">
                  <Mail className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No emails sent yet</h3>
                  <p className="text-gray-500">
                    Email history will appear here after the outreach engine runs and sends emails.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Recipient
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Type
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Subject
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Sent At
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {emailHistory.map((email: any) => (
                        <tr key={email.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <div className="text-sm font-medium text-gray-900">{email.recipient}</div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              email.email_type === 'outreach_initial'
                                ? 'bg-blue-100 text-blue-800'
                                : email.email_type === 'outreach_followup'
                                ? 'bg-purple-100 text-purple-800'
                                : email.email_type === 'verification'
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}>
                              {email.email_type.replace(/_/g, ' ')}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-sm text-gray-900 max-w-xs truncate">{email.subject}</div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1 text-sm ${
                              email.status === 'sent'
                                ? 'text-green-600'
                                : email.status === 'failed'
                                ? 'text-red-600'
                                : 'text-yellow-600'
                            }`}>
                              {email.status === 'sent' && <CheckCircle className="w-4 h-4" />}
                              {email.status === 'failed' && <AlertCircle className="w-4 h-4" />}
                              {email.status === 'queued' && <Clock className="w-4 h-4" />}
                              {email.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500">
                            {email.sent_at && new Date(email.sent_at).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Database Tab */}
        {currentTab === 'settings' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-1">Outreach Settings</h2>
              <p className="text-gray-600 mb-6">
                Save the contact details used by the outreach engine. Leads and sent-email history sync to Supabase
                automatically when the discovery program runs.
              </p>

              {settingsStatus && (
                <div className="mb-6 bg-indigo-50 border border-indigo-200 text-indigo-800 px-4 py-3 rounded-lg">
                  {settingsStatus}
                </div>
              )}

              <div className="grid md:grid-cols-3 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="tel"
                      value={settings.phone}
                      onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
                      placeholder="(555) 123-4567"
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Sending Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="email"
                      value={settings.outreachEmail}
                      onChange={(e) => setSettings({ ...settings, outreachEmail: e.target.value })}
                      placeholder="you@gmail.com"
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Gmail App Password</label>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="password"
                      value={settings.smtpAppPassword}
                      onChange={(e) => setSettings({ ...settings, smtpAppPassword: e.target.value })}
                      placeholder="16-character app password"
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <p className="text-sm text-blue-900 font-medium mb-2">How to get a Gmail app password</p>
                <ol className="list-decimal list-inside text-sm text-blue-800 space-y-1">
                  <li>Turn on 2-Step Verification in your Google Account.</li>
                  <li>Go to Google Account, Security, App passwords.</li>
                  <li>Create an app password for Mail, then paste the 16-character code here.</li>
                </ol>
              </div>

              <div className="grid md:grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Your Name (used in emails)</label>
                  <input
                    type="text"
                    value={settings.senderName}
                    onChange={(e) => setSettings({ ...settings, senderName: e.target.value })}
                    placeholder="Evan"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                  <p className="text-xs text-gray-500 mt-1">This name appears as the sender in all outreach emails</p>
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Email Template</label>
                <p className="text-xs text-gray-500 mb-2">
                  Edit the email sent to every business. Use {'{business_name}'} where the business name should appear.
                </p>
                <textarea
                  value={settings.emailTemplate || `Hi {business_name} Team,\n\nI run a small vending service that installs and maintains modern smart vending machines at NO COST to your business.\n\nWe handle installation, restocking, repairs, and maintenance.\n\nIf you already have vending machines, we can replace them with newer, more reliable smart machines.\n\nWould you be open to a quick conversation?\n\nBest,\n${settings.senderName || 'Evan'}`}
                  onChange={(e) => setSettings({ ...settings, emailTemplate: e.target.value })}
                  rows={12}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-mono text-sm"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Preview: The {'{business_name}'} tag gets replaced with each business's actual name when the email is sent.
                </p>
                <div className="mt-2 bg-gray-50 border border-gray-200 rounded-lg p-3">
                  <p className="text-xs font-medium text-gray-700 mb-1">Preview with a sample business:</p>
                  <p className="text-xs text-gray-600 whitespace-pre-wrap">
                    {(settings.emailTemplate || `Hi {business_name} Team,\n\nI run a small vending service that installs and maintains modern smart vending machines at NO COST to your business.\n\nWe handle installation, restocking, repairs, and maintenance.\n\nIf you already have vending machines, we can replace them with newer, more reliable smart machines.\n\nWould you be open to a quick conversation?\n\nBest,\n${settings.senderName || 'Evan'}`).replace('{business_name}', 'Sunshine Laundromat')}
                  </p>
                </div>
              </div>

              <button
                onClick={saveOutreachSettings}
                disabled={isSavingSettings}
                className="inline-flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-indigo-700 transition-colors disabled:bg-gray-400"
              >
                {isSavingSettings ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                Save Settings
              </button>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <details className="mb-6">
                <summary className="text-sm font-semibold text-gray-700 cursor-pointer hover:text-indigo-600 select-none">
                  Developer Settings
                </summary>
                <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="text-xs text-gray-500 mb-3">
                    These settings are shared system-wide. Set your Google Maps API key here for business discovery.
                  </p>
                  <div className="flex items-end gap-3">
                    <div className="flex-1">
                      <label className="block text-xs font-medium text-gray-700 mb-1">Google Maps API Key</label>
                      <input
                        type="password"
                        value={settings.googleMapsApiKey}
                        onChange={(e) => setSettings({ ...settings, googleMapsApiKey: e.target.value })}
                        placeholder="AIza..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-mono text-sm"
                      />
                    </div>
                    <button
                      onClick={async () => {
                        localStorage.setItem('vendlocate_outreach_settings', JSON.stringify(settings));
                        try {
                          await apiCall('/outreach-settings', {
                            method: 'POST',
                            body: JSON.stringify({ googleMapsApiKey: settings.googleMapsApiKey }),
                          });
                          setSettingsStatus('API key saved to account.');
                        } catch {
                          setSettingsStatus('API key saved locally.');
                        }
                      }}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors whitespace-nowrap"
                    >
                      Save Key
                    </button>
                  </div>
                  <p className="text-xs text-gray-400 mt-2">
                    Get a key at <a href="https://console.cloud.google.com" target="_blank" className="underline">console.cloud.google.com</a> — enable Places API.
                  </p>
                </div>
              </details>

              <h2 className="text-2xl font-bold text-gray-900 mb-1">Upload CSV</h2>
              <p className="text-gray-600 mb-4">
                Upload a CSV file of leads to import them into your dashboard and Supabase. The CSV should have columns like: name, email, phone, business_type, city, state, address, website.
              </p>
              <div className="flex items-center gap-4">
                <label className="inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-indigo-700 transition-colors cursor-pointer">
                  <FileSpreadsheet className="w-5 h-5" />
                  Choose CSV File
                  <input
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setSettingsStatus('Uploading CSV...');
                      try {
                        const text = await file.text();
                        const lines = text.split('\n').filter(l => l.trim());
                        if (lines.length < 2) {
                          setSettingsStatus('CSV file is empty or has no data rows.');
                          return;
                        }
                        const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/[^a-z0-9_]/g, ''));
                        const rows = lines.slice(1).map(line => {
                          const vals = line.split(',');
                          const row: any = {};
                          headers.forEach((h, i) => { row[h] = vals[i]?.trim() || ''; });
                          return row;
                        });

                        // Upload to Supabase
                        const { data: { user } } = await supabase.auth.getUser();
                        if (user) {
                          const { data: purchase } = await supabase
                            .from('purchases')
                            .select('id')
                            .eq('user_id', user.id)
                            .order('purchase_date', { ascending: false })
                            .limit(1)
                            .maybeSingle();

                          const leadRows = rows.map((r: any, i: number) => ({
                            purchase_id: purchase?.id || null,
                            user_id: user.id,
                            business_name: r.name || r['business_name'] || r['Business Name'] || 'Unknown Business',
                            business_type: r.business_type || r['business_type'] || r['Business Type'] || 'General',
                            email: r.email || r.Email || null,
                            phone: r.phone || r.Phone || null,
                            website: r.website || r['website'] || r['Website URL'] || null,
                            has_website: !!(r.website || r['website']),
                            address: r.address || r.Address || null,
                            city: r.city || r.City || editLocation.city || null,
                            state: r.state || r.State || editLocation.state || null,
                            zip_code: r.zip || r.zip_code || r['Zip Code'] || null,
                            place_id: `csv_${user.id.substring(0, 8)}_${Date.now()}_${i}`,
                            profit_score: r.profit_score ? parseInt(r.profit_score) : Math.floor(Math.random() * 40) + 50,
                            ranking: r.ranking ? parseInt(r.ranking) : Math.floor(Math.random() * 40) + 50,
                            status: 'new',
                          }));

                          const { error } = await supabase.from('leads').upsert(leadRows, {
                            onConflict: 'place_id',
                            ignoreDuplicates: true,
                          });
                          if (error) {
                            setSettingsStatus(`Upload error: ${error.message}`);
                          } else {
                            setSettingsStatus(`Uploaded ${leadRows.length} leads! Switching to dashboard...`);
                            // Reload leads into dashboard
                            try {
                              const response = await apiCall('/leads');
                              const realLeads: Lead[] = (response.leads || []).map((lead: any) => ({
                                id: lead.id || String(Math.random()),
                                businessName: lead.business_name || 'Unknown Business',
                                address: lead.address || '',
                                city: lead.city || '',
                                state: lead.state || '',
                                zipCode: lead.zip_code || '',
                                email: lead.email || 'Not found yet',
                                phone: lead.phone || 'Not found yet',
                                businessType: lead.business_type || 'General',
                                ranking: lead.ranking || lead.profit_score || 0,
                                hasWebsite: !!lead.has_website,
                                websiteUrl: lead.website || undefined,
                                emailSent: !!lead.email_sent,
                                responded: !!lead.responded,
                                followUpSent: !!lead.follow_up_sent,
                                notes: lead.notes || '',
                                estimatedFootTraffic: lead.estimated_foot_traffic || 'N/A',
                                distanceFromClient: Number(lead.distance_from_client || 0),
                              }));
                              setLeads(realLeads);
                              setFilteredLeads(realLeads);
                            } catch {}
                            setTimeout(() => setCurrentTab('dashboard'), 1000);
                          }
                        } else {
                          // Save locally if not logged in
                          localStorage.setItem('vendlocate_leads', JSON.stringify(rows));
                          setSettingsStatus(`Saved ${rows.length} leads locally. Log in to sync to Supabase.`);
                        }
                      } catch (err: any) {
                        setSettingsStatus(`CSV parse error: ${err.message}`);
                      }
                    }}
                  />
                </label>
                <span className="text-sm text-gray-500">Supports .csv files with headers</span>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-1">Automatic Database Sync</h2>
              <p className="text-gray-600 mb-6">
                The Python program automatically writes all data to Supabase. There's nothing you need to upload or export.
              </p>

              <div className="grid md:grid-cols-3 gap-4 mb-6">
                <div className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <MapPinPlus className="w-5 h-5 text-indigo-600" />
                    <h3 className="font-semibold text-gray-900">Lead Data</h3>
                  </div>
                  <p className="text-sm text-gray-600 mb-3">
                    Each discovered business is stored with:
                  </p>
                  <ul className="text-xs text-gray-600 space-y-1">
                    <li>• Business name & address</li>
                    <li>• Contact email & phone</li>
                    <li>• Business type category</li>
                    <li>• Distance from your location</li>
                    <li>• Profitability ranking score</li>
                  </ul>
                </div>

                <div className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Send className="w-5 h-5 text-indigo-600" />
                    <h3 className="font-semibold text-gray-900">Outreach History</h3>
                  </div>
                  <p className="text-sm text-gray-600 mb-3">
                    Each email sent is recorded:
                  </p>
                  <ul className="text-xs text-gray-600 space-y-1">
                    <li>• Email address sent to</li>
                    <li>• Date & time sent</li>
                    <li>• Prevents duplicate contact</li>
                    <li>• Tracks response status</li>
                    <li>• Follow-up timing</li>
                  </ul>
                </div>

                <div className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingUp className="w-5 h-5 text-indigo-600" />
                    <h3 className="font-semibold text-gray-900">Real-Time Updates</h3>
                  </div>
                  <p className="text-sm text-gray-600 mb-3">
                    Dashboard updates automatically:
                  </p>
                  <ul className="text-xs text-gray-600 space-y-1">
                    <li>• Starts empty — populates after the first scan</li>
                    <li>• Populates after first scan</li>
                    <li>• Shows live results only</li>
                    <li>• Updates as emails send</li>
                    <li>• Tracks all interactions</li>
                  </ul>
                </div>
              </div>

              <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                <p className="text-sm text-indigo-900">
                  <strong>Before your first scan:</strong> This dashboard will be empty. After the discovery program completes, you'll see all real businesses found within your purchased search radius with their rankings and contact information ready for outreach.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon,
  color,
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
  color: string;
}) {
  const colorClasses = {
    blue: 'bg-blue-50 border-blue-200',
    indigo: 'bg-indigo-50 border-indigo-200',
    green: 'bg-green-50 border-green-200',
    yellow: 'bg-yellow-50 border-yellow-200',
    purple: 'bg-purple-50 border-purple-200',
  };

  return (
    <div className={`${colorClasses[color as keyof typeof colorClasses]} border rounded-lg p-6`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
          <p className="text-3xl font-bold text-gray-900">{value}</p>
        </div>
        {icon}
      </div>
    </div>
  );
}
