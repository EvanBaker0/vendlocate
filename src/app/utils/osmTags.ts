export const OSM_TAG_MAP = {
  laundromat: [
    { type: 'node', tags: ['amenity=laundry'] },
    { type: 'way', tags: ['amenity=laundry'] },
    { type: 'node', tags: ['shop=laundry'] },
    { type: 'way', tags: ['shop=laundry'] },
  ],
  laundry: [
    { type: 'node', tags: ['amenity=laundry'] },
    { type: 'way', tags: ['amenity=laundry'] },
    { type: 'node', tags: ['shop=laundry'] },
    { type: 'way', tags: ['shop=laundry'] },
  ],
  wash: [
    { type: 'node', tags: ['amenity=laundry'] },
    { type: 'way', tags: ['amenity=laundry'] },
    { type: 'node', tags: ['amenity=car_wash'] },
    { type: 'way', tags: ['amenity=car_wash'] },
  ],
  dry: [
    { type: 'node', tags: ['amenity=laundry'] },
    { type: 'way', tags: ['amenity=laundry'] },
  ],
  cleaner: [
    { type: 'node', tags: ['shop=laundry', 'shop=dry_cleaning'] },
    { type: 'way', tags: ['shop=laundry', 'shop=dry_cleaning'] },
  ],
  'car wash': [
    { type: 'node', tags: ['amenity=car_wash'] },
    { type: 'way', tags: ['amenity=car_wash'] },
  ],

  auto: [
    { type: 'node', tags: ['shop=car_repair'] },
    { type: 'way', tags: ['shop=car_repair'] },
    { type: 'node', tags: ['shop=car'] },
    { type: 'way', tags: ['shop=car'] },
  ],
  car: [
    { type: 'node', tags: ['shop=car_repair'] },
    { type: 'way', tags: ['shop=car_repair'] },
    { type: 'node', tags: ['shop=car'] },
    { type: 'way', tags: ['shop=car'] },
  ],
  repair: [
    { type: 'node', tags: ['shop=car_repair'] },
    { type: 'way', tags: ['shop=car_repair'] },
  ],
  tire: [
    { type: 'node', tags: ['shop=tyres'] },
    { type: 'way', tags: ['shop=tyres'] },
  ],
  service: [
    { type: 'node', tags: ['shop=car_repair'] },
    { type: 'way', tags: ['shop=car_repair'] },
  ],
  mechanic: [
    { type: 'node', tags: ['shop=car_repair'] },
    { type: 'way', tags: ['shop=car_repair'] },
  ],

  apartment: [
    { type: 'node', tags: ['building=apartments'] },
    { type: 'way', tags: ['building=apartments'] },
    { type: 'relation', tags: ['building=apartments'] },
    { type: 'node', tags: ['building=residential', 'residential=apartments'] },
    { type: 'way', tags: ['building=residential', 'residential=apartments'] },
  ],
  apartments: [
    { type: 'node', tags: ['building=apartments'] },
    { type: 'way', tags: ['building=apartments'] },
    { type: 'relation', tags: ['building=apartments'] },
  ],
  complex: [
    { type: 'node', tags: ['building=apartments'] },
    { type: 'way', tags: ['building=apartments'] },
  ],
  housing: [
    { type: 'node', tags: ['building=residential'] },
    { type: 'way', tags: ['building=residential'] },
  ],
  residential: [
    { type: 'node', tags: ['building=residential'] },
    { type: 'way', tags: ['building=residential'] },
  ],

  hotel: [
    { type: 'node', tags: ['tourism=hotel'] },
    { type: 'way', tags: ['tourism=hotel'] },
    { type: 'node', tags: ['tourism=motel'] },
    { type: 'way', tags: ['tourism=motel'] },
  ],
  motel: [
    { type: 'node', tags: ['tourism=motel'] },
    { type: 'way', tags: ['tourism=motel'] },
  ],
  inn: [
    { type: 'node', tags: ['tourism=hotel', 'tourism=guest_house', 'tourism=hostel'] },
    { type: 'way', tags: ['tourism=hotel', 'tourism=guest_house', 'tourism=hostel'] },
  ],
  lodge: [
    { type: 'node', tags: ['tourism=guest_house', 'tourism=hotel'] },
    { type: 'way', tags: ['tourism=guest_house', 'tourism=hotel'] },
  ],
  resort: [
    { type: 'node', tags: ['tourism=resort'] },
    { type: 'way', tags: ['tourism=resort'] },
  ],
  guest: [
    { type: 'node', tags: ['tourism=guest_house'] },
    { type: 'way', tags: ['tourism=guest_house'] },
  ],

  senior: [
    { type: 'node', tags: ['amenity=social_facility'] },
    { type: 'way', tags: ['amenity=social_facility'] },
    { type: 'node', tags: ['social_facility=assisted_living'] },
    { type: 'way', tags: ['social_facility=assisted_living'] },
    { type: 'node', tags: ['social_facility=group_home'] },
    { type: 'way', tags: ['social_facility=group_home'] },
  ],
  retirement: [
    { type: 'node', tags: ['amenity=social_facility', 'social_facility=assisted_living'] },
    { type: 'way', tags: ['amenity=social_facility', 'social_facility=assisted_living'] },
  ],
  'assisted living': [
    { type: 'node', tags: ['social_facility=assisted_living'] },
    { type: 'way', tags: ['social_facility=assisted_living'] },
    { type: 'node', tags: ['amenity=social_facility'] },
    { type: 'way', tags: ['amenity=social_facility'] },
  ],
  'nursing home': [
    { type: 'node', tags: ['amenity=nursing_home'] },
    { type: 'way', tags: ['amenity=nursing_home'] },
    { type: 'node', tags: ['healthcare=nursing_home'] },
    { type: 'way', tags: ['healthcare=nursing_home'] },
  ],
  care: [
    { type: 'node', tags: ['amenity=social_facility', 'amenity=nursing_home'] },
    { type: 'way', tags: ['amenity=social_facility', 'amenity=nursing_home'] },
  ],

  hospital: [
    { type: 'node', tags: ['amenity=hospital'] },
    { type: 'way', tags: ['amenity=hospital'] },
    { type: 'node', tags: ['healthcare=hospital'] },
    { type: 'way', tags: ['healthcare=hospital'] },
  ],
  'medical center': [
    { type: 'node', tags: ['amenity=hospital', 'healthcare=hospital'] },
    { type: 'way', tags: ['amenity=hospital', 'healthcare=hospital'] },
  ],
  health: [
    { type: 'node', tags: ['amenity=hospital', 'amenity=clinic', 'healthcare=*'] },
    { type: 'way', tags: ['amenity=hospital', 'amenity=clinic', 'healthcare=*'] },
  ],
  clinic: [
    { type: 'node', tags: ['amenity=clinic'] },
    { type: 'way', tags: ['amenity=clinic'] },
    { type: 'node', tags: ['healthcare=clinic'] },
    { type: 'way', tags: ['healthcare=clinic'] },
  ],

  'urgent care': [
    { type: 'node', tags: ['amenity=clinic', 'healthcare=urgent_care'] },
    { type: 'way', tags: ['amenity=clinic', 'healthcare=urgent_care'] },
  ],
  urgent: [
    { type: 'node', tags: ['amenity=clinic', 'healthcare=urgent_care'] },
    { type: 'way', tags: ['amenity=clinic', 'healthcare=urgent_care'] },
  ],
  'walk-in': [
    { type: 'node', tags: ['amenity=clinic', 'healthcare=urgent_care'] },
    { type: 'way', tags: ['amenity=clinic', 'healthcare=urgent_care'] },
  ],
  'immediate care': [
    { type: 'node', tags: ['amenity=clinic', 'healthcare=urgent_care'] },
    { type: 'way', tags: ['amenity=clinic', 'healthcare=urgent_care'] },
  ],

  veterinary: [
    { type: 'node', tags: ['amenity=veterinary'] },
    { type: 'way', tags: ['amenity=veterinary'] },
    { type: 'node', tags: ['healthcare=veterinary'] },
    { type: 'way', tags: ['healthcare=veterinary'] },
  ],
  vet: [
    { type: 'node', tags: ['amenity=veterinary'] },
    { type: 'way', tags: ['amenity=veterinary'] },
    { type: 'node', tags: ['healthcare=veterinary'] },
    { type: 'way', tags: ['healthcare=veterinary'] },
  ],
  'animal hospital': [
    { type: 'node', tags: ['amenity=veterinary'] },
    { type: 'way', tags: ['amenity=veterinary'] },
    { type: 'node', tags: ['healthcare=veterinary'] },
    { type: 'way', tags: ['healthcare=veterinary'] },
  ],
  'pet clinic': [
    { type: 'node', tags: ['amenity=veterinary'] },
    { type: 'way', tags: ['amenity=veterinary'] },
  ],
  'animal care': [
    { type: 'node', tags: ['amenity=veterinary'] },
    { type: 'way', tags: ['amenity=veterinary'] },
  ],

  gym: [
    { type: 'node', tags: ['leisure=fitness_centre', 'sport=gym', 'amenity=gym'] },
    { type: 'way', tags: ['leisure=fitness_centre', 'sport=gym', 'amenity=gym'] },
  ],
  fitness: [
    { type: 'node', tags: ['leisure=fitness_centre'] },
    { type: 'way', tags: ['leisure=fitness_centre'] },
  ],
  training: [
    { type: 'node', tags: ['leisure=fitness_centre', 'sport=*'] },
    { type: 'way', tags: ['leisure=fitness_centre', 'sport=*'] },
  ],
  crossfit: [
    { type: 'node', tags: ['leisure=fitness_centre', 'sport=fitness', 'sport=exercise'] },
    { type: 'way', tags: ['leisure=fitness_centre', 'sport=fitness', 'sport=exercise'] },
  ],
  athletics: [
    { type: 'node', tags: ['leisure=sports_centre', 'leisure=fitness_centre'] },
    { type: 'way', tags: ['leisure=sports_centre', 'leisure=fitness_centre'] },
  ],
  performance: [
    { type: 'node', tags: ['leisure=fitness_centre', 'sport=*'] },
    { type: 'way', tags: ['leisure=fitness_centre', 'sport=*'] },
  ],

  doctor: [
    { type: 'node', tags: ['amenity=doctors', 'healthcare=doctor'] },
    { type: 'way', tags: ['amenity=doctors', 'healthcare=doctor'] },
  ],
  dr: [
    { type: 'node', tags: ['amenity=doctors', 'healthcare=doctor'] },
    { type: 'way', tags: ['amenity=doctors', 'healthcare=doctor'] },
  ],
  md: [
    { type: 'node', tags: ['amenity=doctors', 'healthcare=doctor'] },
    { type: 'way', tags: ['amenity=doctors', 'healthcare=doctor'] },
  ],
  'family medicine': [
    { type: 'node', tags: ['amenity=doctors', 'healthcare=doctor'] },
    { type: 'way', tags: ['amenity=doctors', 'healthcare=doctor'] },
  ],
  'internal medicine': [
    { type: 'node', tags: ['amenity=doctors', 'healthcare=doctor'] },
    { type: 'way', tags: ['amenity=doctors', 'healthcare=doctor'] },
  ],

  restaurant: [
    { type: 'node', tags: ['amenity=restaurant'] },
    { type: 'way', tags: ['amenity=restaurant'] },
  ],
  'fast food': [
    { type: 'node', tags: ['amenity=fast_food'] },
    { type: 'way', tags: ['amenity=fast_food'] },
  ],
  bar: [
    { type: 'node', tags: ['amenity=bar', 'amenity=pub'] },
    { type: 'way', tags: ['amenity=bar', 'amenity=pub'] },
  ],
  salon: [
    { type: 'node', tags: ['shop=hairdresser', 'shop=beauty'] },
    { type: 'way', tags: ['shop=hairdresser', 'shop=beauty'] },
  ],
  'car rental': [
    { type: 'node', tags: ['amenity=car_rental'] },
    { type: 'way', tags: ['amenity=car_rental'] },
  ],
  dentist: [
    { type: 'node', tags: ['amenity=dentist', 'healthcare=dentist'] },
    { type: 'way', tags: ['amenity=dentist', 'healthcare=dentist'] },
  ],
  pharmacy: [
    { type: 'node', tags: ['amenity=pharmacy'] },
    { type: 'way', tags: ['amenity=pharmacy'] },
  ],
  school: [
    { type: 'node', tags: ['amenity=school', 'amenity=college', 'amenity=university'] },
    { type: 'way', tags: ['amenity=school', 'amenity=college', 'amenity=university'] },
  ],
  church: [
    { type: 'node', tags: ['amenity=place_of_worship'] },
    { type: 'way', tags: ['amenity=place_of_worship'] },
  ],
  store: [
    { type: 'node', tags: ['shop=*'] },
    { type: 'way', tags: ['shop=*'] },
  ],
  park: [
    { type: 'node', tags: ['leisure=park'] },
    { type: 'way', tags: ['leisure=park'] },
  ],
};

export function expandBusinessTypeToOsmTags(businessType) {
  if (!businessType) return [];
  const keywords = [
    ...(businessType.requiredKeywords || []),
    ...(businessType.optionalKeywords || []),
  ];
  const deduped = [...new Set(keywords.map((k) => String(k || '').trim().toLowerCase()).filter(Boolean))];

  const tagStrings = new Set();
  for (const kw of deduped) {
    const direct = OSM_TAG_MAP[kw];
    if (direct && direct.length > 0) {
      for (const entry of direct) {
        for (const tag of entry.tags) {
          tagStrings.add(tag);
        }
      }
    } else {
      for (const [key, entries] of Object.entries(OSM_TAG_MAP)) {
        if (key.includes(kw) || kw.includes(key)) {
          for (const entry of entries) {
            for (const tag of entry.tags) {
              tagStrings.add(tag);
            }
          }
        }
      }
    }
  }
  return Array.from(tagStrings);
}
