import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router';
import { MapPin, CheckCircle, Star, Lock, CreditCard, ArrowLeft, Loader2, Plus, Minus } from 'lucide-react';
import { apiCall } from '../utils/supabase';

interface BusinessType {
  id: string;
  name: string;
  requiredKeywords: string[];
  optionalKeywords: string[];
  isPremium: boolean;
  premiumPrice: number;
}

const BUSINESS_TYPES: BusinessType[] = [
  {
    id: 'laundromat',
    name: 'Laundromats',
    requiredKeywords: ['laundry', 'laundromat'],
    optionalKeywords: ['wash', 'dry', 'clean'],
    isPremium: false,
    premiumPrice: 0,
  },
  {
    id: 'auto-shops',
    name: 'Auto Shops',
    requiredKeywords: ['car', 'auto'],
    optionalKeywords: ['repair', 'tire', 'service', 'mechanic'],
    isPremium: false,
    premiumPrice: 0,
  },
  {
    id: 'apartments',
    name: 'Apartments',
    requiredKeywords: ['apartment', 'apartments'],
    optionalKeywords: ['complex', 'housing', 'residential'],
    isPremium: false,
    premiumPrice: 0,
  },
  {
    id: 'hotels',
    name: 'Hotels',
    requiredKeywords: ['hotel', 'motel'],
    optionalKeywords: ['inn', 'lodge', 'resort'],
    isPremium: false,
    premiumPrice: 0,
  },
  {
    id: 'hospitals',
    name: 'Hospitals',
    requiredKeywords: ['hospital', 'medical center'],
    optionalKeywords: ['health', 'clinic'],
    isPremium: false,
    premiumPrice: 0,
  },
  {
    id: 'urgent-cares',
    name: 'Urgent Cares',
    requiredKeywords: ['urgent care'],
    optionalKeywords: ['walk-in', 'immediate care'],
    isPremium: false,
    premiumPrice: 0,
  },
  {
    id: 'pet-hospitals',
    name: 'Pet Hospitals',
    requiredKeywords: ['veterinary', 'vet', 'animal hospital'],
    optionalKeywords: ['pet clinic', 'animal care'],
    isPremium: false,
    premiumPrice: 0,
  },
  {
    id: 'gyms',
    name: 'Gyms & Fitness Centers',
    requiredKeywords: ['gym', 'fitness'],
    optionalKeywords: ['workout', 'training', 'exercise'],
    isPremium: false,
    premiumPrice: 0,
  },
  {
    id: 'warehouses',
    name: 'Warehouses',
    requiredKeywords: ['warehouse', 'distribution'],
    optionalKeywords: ['storage', 'logistics', 'fulfillment'],
    isPremium: true,
    premiumPrice: 49,
  },
  {
    id: 'senior-communities',
    name: 'Senior Communities',
    requiredKeywords: ['senior', 'retirement'],
    optionalKeywords: ['assisted living', 'nursing home', 'care'],
    isPremium: true,
    premiumPrice: 49,
  },
];

const RADIUS_OPTIONS = [
  { miles: 5, price: 97, label: '5 miles', description: 'Perfect for urban areas' },
  { miles: 10, price: 197, label: '10 miles', description: 'Most popular choice', popular: true },
  { miles: 15, price: 297, label: '15 miles', description: '~20 min drive' },
  { miles: 20, price: 397, label: '20 miles', description: '~30 min drive' },
  { miles: 30, price: 497, label: '30 miles', description: 'Large territory' },
];

const EXTRA_SELECTION_PRICE = 29;

type Step = 'location' | 'radius' | 'businesses' | 'payment' | 'complete';

interface UserLocation {
  address: string;
  city: string;
  state: string;
  zipCode: string;
}

export default function PricingPage() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState<Step>('location');
  const [selectedRadius, setSelectedRadius] = useState(10);
  const [selectedBusinessTypes, setSelectedBusinessTypes] = useState<string[]>([]);
  const [extraSelections, setExtraSelections] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentError, setPaymentError] = useState('');

  const [locationData, setLocationData] = useState<UserLocation>({
    address: '',
    city: '',
    state: '',
    zipCode: '',
  });

  const [paymentData, setPaymentData] = useState({
    cardNumber: '',
    cardName: '',
    expiryDate: '',
    cvv: '',
  });

  const [isFirstPurchase, setIsFirstPurchase] = useState(true);
  const [extraLocationMode, setExtraLocationMode] = useState(false);
  const [upgradeRadiusMode, setUpgradeRadiusMode] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    // Always load saved location
    const savedLocation = localStorage.getItem('vendlocate_saved_location');
    if (savedLocation) {
      setLocationData(JSON.parse(savedLocation));
    }

    // Always load current radius from purchase
    const currentUser = localStorage.getItem('vendlocate_current_user');
    if (currentUser) {
      const user = JSON.parse(currentUser);
      const purchases = JSON.parse(localStorage.getItem('vendlocate_purchases') || '[]');
      const userPurchase = purchases.find((p: any) => p.userId === user.id);
      if (userPurchase?.radius) {
        setSelectedRadius(userPurchase.radius);
      }
      if (userPurchase?.location) {
        setLocationData(userPurchase.location);
      }
    }

    if (params.get('action') === 'new-location') {
      setExtraLocationMode(true);
      return;
    }
    if (params.get('action') === 'upgrade-radius') {
      setUpgradeRadiusMode(true);
      setCurrentStep('radius');
      return;
    }

    if (!currentUser) {
      navigate('/login');
      return;
    }
  }, [navigate]);

  const basePrice = RADIUS_OPTIONS.find((r) => r.miles === selectedRadius)?.price || 197;
  const premiumTypesPrice = selectedBusinessTypes
    .filter((id) => BUSINESS_TYPES.find((bt) => bt.id === id)?.isPremium)
    .reduce((sum, id) => sum + (BUSINESS_TYPES.find((bt) => bt.id === id)?.premiumPrice || 0), 0);
  const extraSelectionsPrice = extraSelections * EXTRA_SELECTION_PRICE;
  const totalPrice = basePrice + premiumTypesPrice + extraSelectionsPrice;

  const freeSelections = 5;
  const totalAvailableSelections = freeSelections + extraSelections;
  const premiumSelected = selectedBusinessTypes.filter((id) =>
    BUSINESS_TYPES.find((bt) => bt.id === id)?.isPremium
  ).length;
  const standardSelected = selectedBusinessTypes.length - premiumSelected;

  const handleBusinessTypeToggle = (typeId: string) => {
    const type = BUSINESS_TYPES.find((bt) => bt.id === typeId);
    if (!type) return;

    if (selectedBusinessTypes.includes(typeId)) {
      setSelectedBusinessTypes(selectedBusinessTypes.filter((id) => id !== typeId));
    } else {
      const currentStandardSelected = selectedBusinessTypes.filter(
        (id) => !BUSINESS_TYPES.find((bt) => bt.id === id)?.isPremium
      ).length;

      if (type.isPremium || currentStandardSelected < totalAvailableSelections) {
        setSelectedBusinessTypes([...selectedBusinessTypes, typeId]);
      }
    }
  };

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setPaymentError('');
    setIsProcessing(true);

    // DUMMY CARD BYPASS: evanbaker127@gmail.com with card 4242 4242 4242 4242
    const currentUser = JSON.parse(localStorage.getItem('vendlocate_current_user') || '{}');
    const isTestUser = currentUser.email === 'evanbaker127@gmail.com';
    const isTestCard = paymentData.cardNumber.replace(/\s/g, '') === '4242424242424242';

    if (isTestUser && isTestCard) {
      // Skip payment — go straight through
      if (extraLocationMode) {
        try {
          await apiCall('/user-locations/unlock', {
            method: 'POST',
            body: JSON.stringify({
              address: locationData.address,
              city: locationData.city,
              state: locationData.state,
              zipCode: locationData.zipCode,
              preferredRadius: selectedRadius,
              stripePaymentIntentId: 'pi_test_dummy_' + Date.now(),
              paymentConfirmed: true,
            }),
          });
        } catch {}
        setIsProcessing(false);
        navigate('/dashboard');
        return;
      }

      if (upgradeRadiusMode) {
        try {
          await apiCall('/user-location', {
            method: 'POST',
            body: JSON.stringify({
              location: locationData,
              preferredRadius: selectedRadius,
            }),
          });
        } catch {}
        setIsProcessing(false);
        navigate('/dashboard');
        return;
      }

      // First purchase
      try {
        await apiCall('/user-location', {
          method: 'POST',
          body: JSON.stringify({
            location: locationData,
            preferredRadius: selectedRadius,
          }),
        });
        const response = await apiCall('/create-payment-intent', {
          method: 'POST',
          body: JSON.stringify({
            radius: selectedRadius,
            businessTypes: selectedBusinessTypes,
            extraSelections,
            premiumTypes: selectedBusinessTypes.filter((id) => BUSINESS_TYPES.find((bt) => bt.id === id)?.isPremium),
            totalPrice,
            location: locationData,
          }),
        });
        // Store purchase locally
        const purchases = JSON.parse(localStorage.getItem('vendlocate_purchases') || '[]');
        purchases.push({
          id: response.purchaseId || Date.now().toString(),
          userId: currentUser.id,
          radius: selectedRadius,
          businessTypes: selectedBusinessTypes,
          extraSelections,
          location: locationData,
          totalPrice,
          purchaseDate: new Date().toISOString(),
        });
        localStorage.setItem('vendlocate_purchases', JSON.stringify(purchases));
        localStorage.setItem('vendlocate_saved_location', JSON.stringify(locationData));
      } catch {}
      setIsProcessing(false);
      navigate('/dashboard');
      return;
    }

    if (extraLocationMode) {
      try {
        const chargeResponse = await apiCall('/user-locations/charge', {
          method: 'POST',
        });

        const result = await apiCall('/user-locations/unlock', {
          method: 'POST',
          body: JSON.stringify({
            address: locationData.address,
            city: locationData.city,
            state: locationData.state,
            zipCode: locationData.zipCode,
            preferredRadius: selectedRadius,
            stripePaymentIntentId: chargeResponse.paymentIntentId,
            paymentConfirmed: true,
          }),
        });

        setIsProcessing(false);
        navigate('/dashboard');
      } catch (err: any) {
        setPaymentError(err.message || 'Failed to add new location. Please try again.');
        setIsProcessing(false);
      }
      return;
    }

    if (upgradeRadiusMode) {
      try {
        // Charge the DIFFERENCE between the new tier and what they already paid
        const newPrice = RADIUS_OPTIONS.find(r => r.miles === selectedRadius)?.price || 197;
        const purchases = JSON.parse(localStorage.getItem('vendlocate_purchases') || '[]');
        const currentUser = JSON.parse(localStorage.getItem('vendlocate_current_user') || '{}');
        const userPurchase = purchases.find((p: any) => p.userId === currentUser.id);
        const currentPaidPrice = userPurchase?.radius
          ? (RADIUS_OPTIONS.find(r => r.miles === userPurchase.radius)?.price || 0)
          : 0;
        const upgradePrice = Math.max(0, newPrice - currentPaidPrice);

        await apiCall('/create-payment-intent', {
          method: 'POST',
          body: JSON.stringify({
            radius: selectedRadius,
            businessTypes: [],
            extraSelections: 0,
            premiumTypes: [],
            totalPrice: upgradePrice,
            location: locationData,
          }),
        });

        // Update the user's radius
        await apiCall('/user-location', {
          method: 'POST',
          body: JSON.stringify({
            location: locationData,
            preferredRadius: selectedRadius,
          }),
        });

        setIsProcessing(false);
        navigate('/dashboard');
      } catch (err: any) {
        setPaymentError(err.message || 'Failed to set radius. Please try again.');
        setIsProcessing(false);
      }
      return;
    }

    try {
      const currentUser = JSON.parse(localStorage.getItem('vendlocate_current_user') || '{}');
      const purchases = JSON.parse(localStorage.getItem('vendlocate_purchases') || '[]');
      const premiumTypes = selectedBusinessTypes.filter((id) => BUSINESS_TYPES.find((bt) => bt.id === id)?.isPremium);

      const newPurchase = {
        id: Date.now().toString(),
        userId: currentUser.id,
        radius: selectedRadius,
        businessTypes: selectedBusinessTypes,
        extraSelections,
        location: locationData,
        totalPrice,
        purchaseDate: new Date().toISOString(),
        unlockedRadii: [selectedRadius],
      };

      purchases.push(newPurchase);
      localStorage.setItem('vendlocate_purchases', JSON.stringify(purchases));
      localStorage.setItem('vendlocate_saved_location', JSON.stringify(locationData));

      // Save selected business types to search settings immediately
      const allTypes = BUSINESS_TYPES.map(bt => ({
        id: bt.id,
        name: bt.name,
        requiredKeywords: [...(bt.requiredKeywords || [])],
        optionalKeywords: [...(bt.optionalKeywords || [])],
        enabled: selectedBusinessTypes.includes(bt.id),
      }));
      const existingSearchSettings = JSON.parse(localStorage.getItem('vendlocate_search_settings') || '{}');
      localStorage.setItem('vendlocate_search_settings', JSON.stringify({
        ...existingSearchSettings,
        enabledBusinessTypes: allTypes.filter(t => t.enabled).map(t => t.name),
        businessTypes: allTypes,
      }));

      try {
        await apiCall('/user-location', {
          method: 'POST',
          body: JSON.stringify({
            location: locationData,
            preferredRadius: selectedRadius,
          }),
        });

        const response = await apiCall('/create-payment-intent', {
          method: 'POST',
          body: JSON.stringify({
            radius: selectedRadius,
            businessTypes: selectedBusinessTypes,
            extraSelections,
            premiumTypes,
            totalPrice,
            location: locationData,
          }),
        });

        if (response.purchaseId) {
          purchases[purchases.length - 1].id = response.purchaseId;
          localStorage.setItem('vendlocate_purchases', JSON.stringify(purchases));
        }
      } catch {
        // Keep local progress if Supabase is unavailable
      }

      setIsProcessing(false);
      navigate('/dashboard');
    } catch (err: any) {
      setPaymentError(err.message || 'Payment failed. Please try again.');
      setIsProcessing(false);
    }
  };

  // Location Step
  if (currentStep === 'location') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
        <div className="max-w-2xl mx-auto">
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 text-indigo-600 hover:text-indigo-700 mb-6 font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>

          <div className="bg-white rounded-2xl shadow-xl p-8">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <MapPin className="w-8 h-8 text-indigo-600" />
              </div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                {extraLocationMode ? 'Add New Location' : 'Your Location'}
              </h1>
              <p className="text-gray-600">
                {extraLocationMode
                  ? 'Enter your new search location. Your current locked location stays active alongside this one.'
                  : isFirstPurchase
                  ? "Enter your location once. We'll remember it for all future searches."
                  : 'Update your location anytime. This affects your search center point.'}
              </p>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                setCurrentStep(extraLocationMode ? 'payment' : 'radius');
              }}
              className="space-y-6"
            >
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Street Address</label>
                <input
                  type="text"
                  required
                  value={locationData.address}
                  onChange={(e) => setLocationData({ ...locationData, address: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="123 Main St"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">City</label>
                  <input
                    type="text"
                    required
                    value={locationData.city}
                    onChange={(e) => setLocationData({ ...locationData, city: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="Springfield"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">State</label>
                  <input
                    type="text"
                    required
                    value={locationData.state}
                    onChange={(e) => setLocationData({ ...locationData, state: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="IL"
                    maxLength={2}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">ZIP Code</label>
                  <input
                    type="text"
                    required
                    value={locationData.zipCode}
                    onChange={(e) => setLocationData({ ...locationData, zipCode: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="62701"
                  />
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-900">
                  {extraLocationMode
                    ? 'This adds a new search location for $97. Your existing locked location remains unchanged. Leads from both locations will appear in your dashboard.'
                    : 'Your location is your search center point. All searches are measured from this address. You can update it anytime.'}
                </p>
              </div>

              <button
                type="submit"
                className="w-full bg-indigo-600 text-white py-4 rounded-lg font-semibold hover:bg-indigo-700 transition-colors"
              >
                {extraLocationMode ? 'Continue to Payment — $97' : 'Continue to Search Distance'}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // Radius Selection Step
  if (currentStep === 'radius') {
    // Compute the highest radius the user has already paid for
    const currentUser = JSON.parse(localStorage.getItem('vendlocate_current_user') || '{}');
    const purchases = JSON.parse(localStorage.getItem('vendlocate_purchases') || '[]');
    const userPurchase = purchases.find((p: any) => p.userId === currentUser.id);
    const paidRadiusMiles = userPurchase?.radius || 0;
    const paidPrice = RADIUS_OPTIONS.find(r => r.miles === paidRadiusMiles)?.price || 0;

    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
        <div className="max-w-6xl mx-auto">
          <button
            onClick={() => setCurrentStep('location')}
            className="inline-flex items-center gap-2 text-indigo-600 hover:text-indigo-700 mb-6 font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Location
          </button>

          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              {upgradeRadiusMode ? 'Upgrade Your Search Distance' : 'Choose Your Search Distance'}
            </h1>
            <p className="text-xl text-gray-600">
              {upgradeRadiusMode
                ? `You've paid for ${paidRadiusMiles} miles. Upgrade to search farther.`
                : `Pay more to unlock searches farther from ${locationData.city}, ${locationData.state}`}
            </p>
            {upgradeRadiusMode && paidRadiusMiles > 0 && (
              <p className="text-sm text-green-600 mt-2 font-medium">
                Tiers at or below {paidRadiusMiles} miles are free — you already paid for them.
              </p>
            )}
            {!upgradeRadiusMode && (
              <p className="text-sm text-gray-600 mt-2">
                Larger search areas cost more because the program scans more businesses and finds more leads for your account.
              </p>
            )}
          </div>

          <div className="grid md:grid-cols-3 lg:grid-cols-5 gap-6 mb-8">
            {RADIUS_OPTIONS.map((option) => {
              const isAlreadyPaid = upgradeRadiusMode && option.miles <= paidRadiusMiles;
              const upgradeCost = upgradeRadiusMode
                ? Math.max(0, option.price - paidPrice)
                : option.price;

              return (
                <button
                  key={option.miles}
                  onClick={() => setSelectedRadius(option.miles)}
                  className={`relative bg-white rounded-xl shadow-md p-6 text-center transition-all hover:shadow-lg ${
                    selectedRadius === option.miles
                      ? 'ring-4 ring-indigo-600 border-2 border-indigo-600'
                      : isAlreadyPaid
                      ? 'border-2 border-green-300 bg-green-50'
                      : 'border-2 border-gray-200'
                  }`}
                >
                  {option.popular && !isAlreadyPaid && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-indigo-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                      POPULAR
                    </div>
                  )}
                  {isAlreadyPaid && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-green-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                      FREE
                    </div>
                  )}
                  <MapPin className={`w-10 h-10 mx-auto mb-3 ${isAlreadyPaid ? 'text-green-600' : 'text-indigo-600'}`} />
                  {isAlreadyPaid ? (
                    <>
                      <div className="text-3xl font-bold text-green-600 mb-1">Free</div>
                      <div className="text-xs text-green-700 mb-1 line-through">${option.price}</div>
                    </>
                  ) : (
                    <div className="text-3xl font-bold text-gray-900 mb-1">${upgradeRadiusMode ? upgradeCost : option.price}</div>
                  )}
                  <div className="text-lg font-semibold text-gray-700 mb-1">{option.label}</div>
                  <div className="text-xs text-gray-500 mb-2">{option.description}</div>
                  {selectedRadius === option.miles && (
                    <CheckCircle className={`w-6 h-6 absolute top-4 right-4 ${isAlreadyPaid ? 'text-green-600' : 'text-indigo-600'}`} />
                  )}
                </button>
              );
            })}
          </div>

          <div className="bg-white rounded-xl shadow-md p-6 mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">What's Included at {selectedRadius} Miles</h3>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <span className="text-gray-700">100+ pre-qualified leads in your radius</span>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <span className="text-gray-700">Automated email campaigns</span>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <span className="text-gray-700">48-hour smart follow-ups</span>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <span className="text-gray-700">Lead ranking & analytics</span>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <span className="text-gray-700">5 business type selections</span>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <span className="text-gray-700">Automatic Supabase database sync</span>
              </div>
            </div>
          </div>

          <button
            onClick={async () => {
              if (upgradeRadiusMode) {
                // If the selected radius is one they already have, just set it — no payment
                if (selectedRadius <= paidRadiusMiles) {
                  try {
                    await apiCall('/user-location', {
                      method: 'POST',
                      body: JSON.stringify({
                        location: locationData,
                        preferredRadius: selectedRadius,
                      }),
                    });
                  } catch {}
                  // Update local purchase record
                  const allPurchases = JSON.parse(localStorage.getItem('vendlocate_purchases') || '[]');
                  const idx = allPurchases.findIndex((p: any) => p.userId === currentUser.id);
                  if (idx >= 0) {
                    allPurchases[idx].radius = selectedRadius;
                    localStorage.setItem('vendlocate_purchases', JSON.stringify(allPurchases));
                  }
                  navigate('/dashboard');
                  return;
                }
                setCurrentStep('payment');
              } else {
                setCurrentStep('businesses');
              }
            }}
            className="w-full bg-indigo-600 text-white py-4 rounded-lg text-lg font-semibold hover:bg-indigo-700 transition-colors"
          >
            {upgradeRadiusMode
              ? (selectedRadius <= paidRadiusMiles ? 'Set Radius (Free)' : 'Set Radius')
              : 'Continue to Business Selection'}
          </button>
        </div>
      </div>
    );
  }

  // Business Types Step
  if (currentStep === 'businesses') {
    const standardTypes = BUSINESS_TYPES.filter((bt) => !bt.isPremium);
    const premiumTypes = BUSINESS_TYPES.filter((bt) => bt.isPremium);

    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
        <div className="max-w-6xl mx-auto">
          <button
            onClick={() => setCurrentStep('radius')}
            className="inline-flex items-center gap-2 text-indigo-600 hover:text-indigo-700 mb-6 font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Distance Selection
          </button>

          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">Choose Business Types</h1>
            <p className="text-xl text-gray-600 mb-2">
              Select up to {totalAvailableSelections} business types to target
            </p>
            <p className="text-sm text-gray-500">
              ({standardSelected}/{totalAvailableSelections} standard selections used)
            </p>
            <p className="text-sm text-indigo-600 mt-2 font-medium">
              You can always add more locations later for $97 each — your selected business types apply to every location.
            </p>

          </div>

          {/* Extra Selections */}
          <div className="bg-white rounded-xl shadow-md p-6 mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-1">Need More Selections?</h3>
                <p className="text-sm text-gray-600">
                  Add extra business type slots for ${EXTRA_SELECTION_PRICE} each
                </p>
              </div>
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setExtraSelections(Math.max(0, extraSelections - 1))}
                  disabled={extraSelections === 0 || (selectedBusinessTypes.length - premiumSelected) > (freeSelections + extraSelections - 1)}
                  className="w-10 h-10 rounded-lg border-2 border-gray-300 flex items-center justify-center hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  title={(selectedBusinessTypes.length - premiumSelected) > (freeSelections + extraSelections - 1) ? 'Unselect some business types first' : undefined}
                >
                  <Minus className="w-5 h-5 text-gray-600" />
                </button>
                <div className="text-2xl font-bold text-gray-900 w-12 text-center">{extraSelections}</div>
                <button
                  onClick={() => setExtraSelections(extraSelections + 1)}
                  className="w-10 h-10 rounded-lg border-2 border-indigo-600 flex items-center justify-center hover:bg-indigo-50"
                >
                  <Plus className="w-5 h-5 text-indigo-600" />
                </button>
              </div>
            </div>
          </div>

          {/* Standard Business Types */}
          <div className="mb-8">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">Standard Locations</h3>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
              {standardTypes.map((type) => {
                const isSelected = selectedBusinessTypes.includes(type.id);
                const canSelect = isSelected || standardSelected < totalAvailableSelections;

                return (
                  <button
                    key={type.id}
                    onClick={() => handleBusinessTypeToggle(type.id)}
                    disabled={!canSelect}
                    className={`relative bg-white rounded-lg shadow-md p-4 text-left transition-all ${
                      isSelected
                        ? 'ring-4 ring-indigo-600 border-2 border-indigo-600'
                        : canSelect
                        ? 'border-2 border-gray-200 hover:border-indigo-300'
                        : 'border-2 border-gray-200 opacity-50 cursor-not-allowed'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-semibold text-gray-900">{type.name}</h4>
                      {isSelected && <CheckCircle className="w-5 h-5 text-indigo-600 flex-shrink-0" />}
                    </div>
                    <div className="text-xs text-gray-600 mb-2">
                      <strong>Required:</strong> {type.requiredKeywords.join(', ')}
                    </div>
                    <div className="text-xs text-gray-500">
                      <strong>Optional:</strong> {type.optionalKeywords.join(', ')}
                    </div>
                    {!canSelect && !isSelected && (
                      <div className="absolute inset-0 bg-white/80 rounded-lg flex items-center justify-center">
                        <Lock className="w-6 h-6 text-gray-400" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Premium Business Types */}
          <div className="mb-8">
            <div className="bg-gradient-to-r from-amber-500 to-orange-500 rounded-xl p-6 mb-4 text-white">
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 flex-shrink-0">
                  <Star className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold mb-2">Premium Locations - Best ROI</h3>
                  <p className="text-amber-50 mb-3">
                    These are the highest-performing vending machine locations with the best profit potential.
                    Warehouses and senior communities consistently outperform other location types.
                  </p>
                  <ul className="space-y-1 text-amber-50">
                    <li>• High daily foot traffic guaranteed</li>
                    <li>• Long-term placement stability</li>
                    <li>• Lower competition from other operators</li>
                    <li>• Premium pricing justified by results</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {premiumTypes.map((type) => {
                const isSelected = selectedBusinessTypes.includes(type.id);

                return (
                  <button
                    key={type.id}
                    onClick={() => handleBusinessTypeToggle(type.id)}
                    className={`relative bg-gradient-to-br from-amber-50 to-orange-50 rounded-lg shadow-md p-6 text-left transition-all border-2 ${
                      isSelected
                        ? 'ring-4 ring-amber-500 border-amber-500'
                        : 'border-amber-200 hover:border-amber-400'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Star className="w-5 h-5 text-amber-600" />
                        <h4 className="font-bold text-gray-900 text-lg">{type.name}</h4>
                      </div>
                      {isSelected && <CheckCircle className="w-6 h-6 text-amber-600 flex-shrink-0" />}
                    </div>
                    <div className="text-sm text-gray-700 mb-2">
                      <strong>Required:</strong> {type.requiredKeywords.join(', ')}
                    </div>
                    <div className="text-sm text-gray-600 mb-3">
                      <strong>Optional:</strong> {type.optionalKeywords.join(', ')}
                    </div>
                    <div className="flex items-center justify-between pt-3 border-t border-amber-200">
                      <span className="text-xs font-semibold text-amber-800">PREMIUM ADD-ON</span>
                      <span className="text-xl font-bold text-amber-600">+${type.premiumPrice}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Price Summary */}
          <div className="bg-white rounded-xl shadow-md p-6 mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Order Summary</h3>
            <div className="space-y-2 mb-4">
              <div className="flex justify-between text-gray-700">
                <span>{selectedRadius} mile search radius</span>
                <span>${basePrice}</span>
              </div>
              {extraSelections > 0 && (
                <div className="flex justify-between text-gray-700">
                  <span>{extraSelections} extra selection(s)</span>
                  <span>${extraSelectionsPrice}</span>
                </div>
              )}
              {premiumTypesPrice > 0 && (
                <div className="flex justify-between text-gray-700">
                  <span>{premiumSelected} premium location type(s)</span>
                  <span>${premiumTypesPrice}</span>
                </div>
              )}
              <div className="pt-3 border-t border-gray-200">
                <div className="flex justify-between text-xl font-bold text-gray-900">
                  <span>Total</span>
                  <span>${totalPrice}</span>
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={() => setCurrentStep('payment')}
            disabled={selectedBusinessTypes.length === 0}
            className="w-full bg-indigo-600 text-white py-4 rounded-lg text-lg font-semibold hover:bg-indigo-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            Continue to Payment
          </button>
        </div>
      </div>
    );
  }

  // Payment Step
  if (currentStep === 'payment') {
    const backStep = upgradeRadiusMode ? 'radius' : extraLocationMode ? 'location' : 'businesses';
    const backLabel = upgradeRadiusMode ? 'Distance Selection' : extraLocationMode ? 'Location' : 'Business Selection';
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
        <div className="max-w-3xl mx-auto">
          <button
            onClick={() => setCurrentStep(backStep)}
            className="inline-flex items-center gap-2 text-indigo-600 hover:text-indigo-700 mb-6 font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to {backLabel}
          </button>

          <div className="bg-white rounded-2xl shadow-xl p-8">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CreditCard className="w-8 h-8 text-indigo-600" />
              </div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                {upgradeRadiusMode ? 'Upgrade Search Radius' : extraLocationMode ? 'Add New Location' : 'Complete Your Purchase'}
              </h1>
              <p className="text-gray-600">Secure checkout - Your information is protected</p>
            </div>

            {/* Order Summary */}
            <div className="bg-indigo-50 rounded-lg p-6 mb-8">
              <h3 className="font-semibold text-gray-900 mb-4">Order Summary</h3>
              <div className="space-y-2 text-sm mb-4">
                {upgradeRadiusMode ? (() => {
                  try {
                    const newPrice = RADIUS_OPTIONS.find(r => r.miles === selectedRadius)?.price || 197;
                    const purchases = JSON.parse(localStorage.getItem('vendlocate_purchases') || '[]');
                    const currentUser = JSON.parse(localStorage.getItem('vendlocate_current_user') || '{}');
                    const userPurchase = purchases.find((p: any) => p.userId === currentUser.id);
                    const currentPaidPrice = userPurchase?.radius
                      ? (RADIUS_OPTIONS.find(r => r.miles === userPurchase.radius)?.price || 0)
                      : 0;
                    const currentMiles = userPurchase?.radius || 0;
                    return (
                      <>
                        <div className="flex justify-between">
                          <span className="text-gray-700">Current: {currentMiles} miles (paid ${currentPaidPrice})</span>
                          <span className="font-medium text-gray-500 line-through">${currentPaidPrice}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-700">Upgrade to: {selectedRadius} miles</span>
                          <span className="font-medium">${newPrice}</span>
                        </div>
                      </>
                    );
                  } catch {
                    return (
                      <div className="flex justify-between">
                        <span className="text-gray-700">Upgrade to: {selectedRadius} miles</span>
                      </div>
                    );
                  }
                })() : extraLocationMode ? (
                  <div className="flex justify-between">
                    <span className="text-gray-700">New search location (unlocks editing)</span>
                    <span className="font-medium">$97</span>
                  </div>
                ) : (
                  <>
                <div className="flex justify-between">
                  <span className="text-gray-700">{selectedRadius} mile search radius</span>
                  <span className="font-medium">${basePrice}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-700">
                    {selectedBusinessTypes.length - premiumSelected} standard location types
                  </span>
                  <span className="font-medium">Included</span>
                </div>
                {extraSelections > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-700">{extraSelections} extra selection(s)</span>
                    <span className="font-medium">${extraSelectionsPrice}</span>
                  </div>
                )}
                {premiumSelected > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-700">{premiumSelected} premium location type(s)</span>
                    <span className="font-medium">${premiumTypesPrice}</span>
                  </div>
                )}
                </>)}
              </div>
              <div className="pt-4 border-t border-indigo-200">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-semibold text-gray-900">Total Amount</span>
                  <span className="text-3xl font-bold text-indigo-600">
                    ${upgradeRadiusMode ? (() => {
                      try {
                        const newP = RADIUS_OPTIONS.find(r => r.miles === selectedRadius)?.price || 197;
                        const p = JSON.parse(localStorage.getItem('vendlocate_purchases') || '[]');
                        const u = JSON.parse(localStorage.getItem('vendlocate_current_user') || '{}');
                        const up = p.find((x: any) => x.userId === u.id);
                        const cp = up?.radius ? (RADIUS_OPTIONS.find(r => r.miles === up.radius)?.price || 0) : 0;
                        return Math.max(0, newP - cp);
                      } catch { return 0; }
                    })() : extraLocationMode ? 97 : totalPrice}
                  </span>
                </div>
              </div>
            </div>

            {/* Payment Form */}
            <form onSubmit={handlePayment} className="space-y-6">
              {paymentError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                  {paymentError}
                </div>
              )}

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Your Location</h3>
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <p className="text-sm text-gray-700">
                    <strong>Address:</strong> {locationData.address}, {locationData.city}, {locationData.state}{' '}
                    {locationData.zipCode}
                  </p>
                  <button
                    type="button"
                    onClick={() => setCurrentStep('location')}
                    className="text-indigo-600 hover:text-indigo-700 text-sm font-medium mt-2"
                  >
                    Change Location
                  </button>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Payment Information</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Cardholder Name</label>
                    <input
                      type="text"
                      required
                      value={paymentData.cardName}
                      onChange={(e) => setPaymentData({ ...paymentData, cardName: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="John Doe"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Card Number</label>
                    <input
                      type="text"
                      required
                      value={paymentData.cardNumber}
                      onChange={(e) => setPaymentData({ ...paymentData, cardNumber: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="1234 5678 9012 3456"
                      maxLength={19}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Expiry Date</label>
                      <input
                        type="text"
                        required
                        value={paymentData.expiryDate}
                        onChange={(e) => setPaymentData({ ...paymentData, expiryDate: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        placeholder="MM/YY"
                        maxLength={5}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">CVV</label>
                      <input
                        type="text"
                        required
                        value={paymentData.cvv}
                        onChange={(e) => setPaymentData({ ...paymentData, cvv: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        placeholder="123"
                        maxLength={4}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-green-800">
                    <strong>100% Secure Payment</strong> - Your payment information is encrypted and secure. We never
                    store your credit card details.
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={isProcessing}
                className="w-full bg-indigo-600 text-white py-4 rounded-lg font-semibold text-lg hover:bg-indigo-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    {upgradeRadiusMode ? 'Setting Radius...' : 'Processing Payment...'}
                  </>
                ) : (
                  <>
                    <Lock className="w-5 h-5" />
                    {upgradeRadiusMode ? (() => {
                      try {
                        const newP = RADIUS_OPTIONS.find(r => r.miles === selectedRadius)?.price || 197;
                        const p = JSON.parse(localStorage.getItem('vendlocate_purchases') || '[]');
                        const u = JSON.parse(localStorage.getItem('vendlocate_current_user') || '{}');
                        const up = p.find((x: any) => x.userId === u.id);
                        const cp = up?.radius ? (RADIUS_OPTIONS.find(r => r.miles === up.radius)?.price || 0) : 0;
                        return `Set Radius — $${Math.max(0, newP - cp)}`;
                      } catch { return 'Set Radius'; }
                    })() : extraLocationMode ? 'Pay $97' : `Pay $${totalPrice}`}
                  </>
                )}
              </button>

              <p className="text-xs text-center text-gray-500">
                By completing this purchase, you agree to our Terms of Service and Privacy Policy
              </p>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
