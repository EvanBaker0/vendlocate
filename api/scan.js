import { createClient } from '@supabase/supabase-js';

export const config = {
  maxDuration: 300,
};

const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  'https://axawjnoxdlnbicnsxlwj.supabase.co';

const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF4YXdqbm94ZGxuYmljbnN4bHdqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAyNjkzMzEsImV4cCI6MjA5NTg0NTMzMX0.FVg-2ah8ZK5AQwFhoLAubrxDO-Rxk4FzEiBRgZ9hb_I';

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const MAILTO_REGEX = /mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi;
const OBFUSCATED_REGEX = /[a-zA-Z0-9._%+-]+\s*\[?at\]?\s*[a-zA-Z0-9.-]+\s*\[?dot\]?\s*[a-zA-Z]{2,}/gi;
const FAKE_EMAIL_DOMAINS = [
  'wixpress',
  'sentry',
  'cloudflare',
  'example.com',
  'sentry.io',
  'wix.com',
  'wordpress.com',
  'gravatar.com',
  'schema.org',
  'github.com',
  'googleapis.com',
  'gstatic.com',
];
const EMAIL_GUESS_PATTERNS = [
  'info',
  'contact',
  'office',
  'hello',
  'admin',
  'manager',
  'owner',
  'support',
  'sales',
  'service',
  'team',
  'leasing',
  'reception',
  'frontdesk',
];

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 6000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url, { ...options, signal: controller.signal });
    return resp;
  } finally {
    clearTimeout(timer);
  }
}

function isFakeEmail(email) {
  const lower = email.toLowerCase();
  return FAKE_EMAIL_DOMAINS.some((d) => lower.includes(d));
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function extractDomain(website) {
  if (!website) return null;
  try {
    const url = website.startsWith('http') ? new URL(website) : new URL('https://' + website);
    return url.hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return null;
  }
}

async function scrapeEmailFromWebsite(websiteUrl) {
  if (!websiteUrl) return null;
  let baseUrl = websiteUrl;
  if (!baseUrl.startsWith('http')) baseUrl = 'https://' + baseUrl;

  const headers = {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0 Safari/537.36',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
  };

  const visited = new Set();
  const queue = [baseUrl];
  const priorityPaths = [
    '/contact',
    '/contact-us',
    '/contactus',
    '/about',
    '/about-us',
    '/team',
    '/staff',
    '/support',
    '/location',
    '/find-us',
  ];
  for (const p of priorityPaths) {
    queue.push(baseUrl.replace(/\/$/, '') + p);
  }

  let hostname = '';
  try {
    hostname = new URL(baseUrl).hostname;
  } catch {
    return null;
  }

  const MAX_PAGES = 8;
  const MAX_QUEUE = 25;

  while (queue.length > 0 && visited.size < MAX_PAGES) {
    const url = queue.shift();
    if (visited.has(url)) continue;
    visited.add(url);

    try {
      const resp = await fetchWithTimeout(url, { headers }, 5500);
      if (!resp.ok) continue;
      const contentType = resp.headers.get('content-type') || '';
      if (!contentType.includes('text/html') && !contentType.includes('xml')) continue;
      const html = await resp.text();
      if (html.length > 2_000_000) continue;

      let m;
      MAILTO_REGEX.lastIndex = 0;
      while ((m = MAILTO_REGEX.exec(html)) !== null) {
        const email = normalizeEmail(m[1]);
        if (email && !isFakeEmail(email)) return email;
      }

      EMAIL_REGEX.lastIndex = 0;
      while ((m = EMAIL_REGEX.exec(html)) !== null) {
        const email = normalizeEmail(m[0]);
        if (email && !isFakeEmail(email) && email.length < 120) return email;
      }

      OBFUSCATED_REGEX.lastIndex = 0;
      while ((m = OBFUSCATED_REGEX.exec(html)) !== null) {
        const cleaned = m[0]
          .replace(/\s*\[at\]\s*/gi, '@')
          .replace(/\s*\[dot\]\s*/gi, '.')
          .replace(/\s+at\s+/gi, '@')
          .replace(/\s+dot\s+/gi, '.')
          .replace(/\s+/g, '')
          .toLowerCase();
        if (cleaned.includes('@') && cleaned.includes('.') && !isFakeEmail(cleaned)) {
          return cleaned;
        }
      }

      const linkRegex = /href="([^"]+)"/g;
      let lm;
      while ((lm = linkRegex.exec(html)) !== null) {
        let href = lm[1];
        if (!href) continue;
        if (href.startsWith('/') && !href.startsWith('//')) {
          href = baseUrl.replace(/\/$/, '') + href;
        }
        if (
          href.startsWith('http') &&
          href.includes(hostname) &&
          queue.length < MAX_QUEUE &&
          !visited.has(href)
        ) {
          queue.push(href);
        }
      }
    } catch {
      // ignore
    }
  }

  return null;
}

async function guessEmail(website) {
  const domain = extractDomain(website);
  if (!domain) return null;
  if (
    domain.includes('facebook') ||
    domain.includes('yelp') ||
    domain.includes('google') ||
    domain.includes('instagram') ||
    domain.includes('twitter') ||
    domain.includes('youtube') ||
    domain.includes('tiktok')
  ) {
    return null;
  }

  const url = website.startsWith('http') ? website : 'https://' + website;
  let html = '';
  try {
    const resp = await fetchWithTimeout(url, {}, 4500);
    if (resp.ok) {
      const contentType = resp.headers.get('content-type') || '';
      if (contentType.includes('text/html')) {
        html = await resp.text();
      }
    }
  } catch {
    return null;
  }
  if (!html) return null;

  const lower = html.toLowerCase();

  for (const pattern of EMAIL_GUESS_PATTERNS) {
    const guess = `${pattern}@${domain}`;
    if (lower.includes(guess.toLowerCase()) && !isFakeEmail(guess)) {
      return guess;
    }
  }

  EMAIL_REGEX.lastIndex = 0;
  let m;
  while ((m = EMAIL_REGEX.exec(html)) !== null) {
    const email = normalizeEmail(m[0]);
    if (email && email.endsWith('@' + domain) && !isFakeEmail(email)) {
      return email;
    }
  }

  return null;
}

function estimateProfitScore(name, businessType) {
  const lower = ((name || '') + ' ' + (businessType || '')).toLowerCase();
  if (/gym|fitness|apartment|hotel|urgent|clinic|senior/.test(lower)) {
    return Math.floor(Math.random() * 10) + 90;
  }
  if (/veterinary|vet|pet|animal/.test(lower)) {
    return Math.floor(Math.random() * 15) + 75;
  }
  if (/auto|repair|tire|hospital|medical/.test(lower)) {
    return Math.floor(Math.random() * 15) + 70;
  }
  if (/laundromat|laundry|wash/.test(lower)) {
    return Math.floor(Math.random() * 15) + 65;
  }
  return Math.floor(Math.random() * 30) + 50;
}

function normalizePlaceId(place) {
  if (place.place_id && place.place_id.length > 4) return place.place_id;
  const website = (place.website || '').toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');
  const name = (place.business_name || place.name || '').toLowerCase().trim();
  const city = (place.city || '').toLowerCase().trim();
  if (website) return `web_${website}`;
  if (name && city) return `nm_${name}_${city}`;
  if (name) return `nm_${name}`;
  return `un_${Math.random().toString(36).slice(2, 10)}`;
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const startedAt = Date.now();
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'Missing Authorization header' });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const body = req.body || {};
    const { places, location, radiusMiles, businessTypes, senderName, emailTemplate } = body;

    const { data: purchases, error: purchasesError } = await supabase
      .from('purchases')
      .select('id')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('purchase_date', { ascending: false })
      .limit(1);

    if (purchasesError) {
      return res.status(500).json({ error: 'Failed to verify purchase' });
    }
    if (!purchases || purchases.length === 0) {
      return res.status(400).json({ error: 'No active purchase found.' });
    }

    const inputPlaces = Array.isArray(places) ? places : [];
    const useServerDiscovery =
      inputPlaces.length === 0 && location?.lat && location?.lng && businessTypes;

    let discovered = inputPlaces;
    if (useServerDiscovery) {
      // Discovery is normally done in the browser. This branch is a safety net
      // for clients that arrive here with no pre-discovered places.
      discovered = [];
    }

    const alreadyEmailed = new Set();
    try {
      const { data: emailed } = await supabase
        .from('email_history')
        .select('recipient')
        .eq('user_id', user.id)
        .limit(10000);
      if (emailed) {
        for (const e of emailed) {
          if (e.recipient) alreadyEmailed.add(e.recipient.toLowerCase());
        }
      }
    } catch {
      // ignore
    }

    const processedLeads = [];
    const seenPlaceIds = new Set();

    for (const place of discovered) {
      if (processedLeads.length >= 5000) break;

      const pid = normalizePlaceId(place);
      if (seenPlaceIds.has(pid)) continue;
      seenPlaceIds.add(pid);

      let email = place.email ? normalizeEmail(place.email) : null;
      if (email && alreadyEmailed.has(email)) {
        email = null;
      }

      if (!email && place.website) {
        try {
          const scraped = await scrapeEmailFromWebsite(place.website);
          if (scraped && !alreadyEmailed.has(scraped)) {
            email = scraped;
          }
        } catch {
          // ignore
        }
        if (!email) {
          try {
            const guessed = await guessEmail(place.website);
            if (guessed && !alreadyEmailed.has(guessed)) {
              email = guessed;
            }
          } catch {
            // ignore
          }
        }
      }

      const businessName = place.business_name || place.name || 'Unknown';
      const businessType = place.business_type || 'General';
      const profitScore = place.profit_score || estimateProfitScore(businessName, businessType);
      const distance =
        typeof place.distance === 'number'
          ? place.distance
          : typeof place.distance_from_client === 'number'
          ? place.distance_from_client
          : 0;

      processedLeads.push({
        business_name: businessName,
        business_type: businessType,
        address: place.address || '',
        city: place.city || '',
        state: place.state || '',
        email: email,
        phone: place.phone || null,
        website: place.website || null,
        has_website: !!place.website,
        place_id: pid,
        profit_score: profitScore,
        ranking: profitScore,
        distance_from_client: distance,
        status: email ? 'new' : 'no_email',
      });
    }

    const { data: loc } = await supabase
      .from('user_locations')
      .select('id')
      .eq('user_id', user.id)
      .eq('is_primary', true)
      .limit(1)
      .maybeSingle();

    if (processedLeads.length > 0) {
      const purchaseId = purchases[0].id;
      const leadRows = processedLeads.map((l) => ({
        purchase_id: purchaseId,
        user_id: user.id,
        user_location_id: loc?.id || null,
        ...l,
      }));

      for (let i = 0; i < leadRows.length; i += 100) {
        const batch = leadRows.slice(i, i + 100);
        const { error: upsertError } = await supabase
          .from('leads')
          .upsert(batch, {
            onConflict: 'place_id',
            ignoreDuplicates: true,
          });
        if (upsertError && upsertError.code !== '23505') {
          console.error('Lead upsert error:', upsertError);
        }
      }
    }

    const leadsWithEmail = processedLeads.filter((l) => l.email);
    const subject = 'Free modern vending machine upgrade for your business';
    const sender = senderName || 'Evan';
    const phoneLine = location?.phone ? `\nCall/Text: ${location.phone}\n` : '';
    const defaultBody = `Hi {business_name} Team,\n\nI run a small vending service that installs and maintains modern smart vending machines at NO COST to your business.\n\nWe handle installation, restocking, repairs, and maintenance.\n\nIf you already have vending machines, we can replace them with newer, more reliable smart machines.\n\nWould you be open to a quick conversation?\n\nBest,\n${sender}${phoneLine}`;

    let bodyTemplate = emailTemplate || defaultBody;
    bodyTemplate = bodyTemplate.replace(/\{\{BUSINESS_NAME\}\}/g, '{business_name}');
    bodyTemplate = bodyTemplate.replace(/\{\{YOUR_NAME\}\}/g, sender);
    bodyTemplate = bodyTemplate.replace(/\{\{YOUR_PHONE\}\}/g, location?.phone || '');

    const emailsSent = [];
    for (const lead of leadsWithEmail) {
      if (alreadyEmailed.has(lead.email.toLowerCase())) continue;
      const renderedBody = bodyTemplate.replace(/\{business_name\}/g, lead.business_name);
      const { error: historyError } = await supabase
        .from('email_history')
        .upsert(
          {
            user_id: user.id,
            recipient: lead.email.toLowerCase(),
            email_type: 'outreach_initial',
            subject,
            body_preview: renderedBody.slice(0, 500),
            status: 'discovered',
            sent_at: new Date().toISOString(),
          },
          {
            onConflict: 'user_id,recipient,email_type,subject',
            ignoreDuplicates: true,
          }
        );
      if (!historyError) {
        emailsSent.push({ email: lead.email, business: lead.business_name });
      } else if (historyError.code !== '23505') {
        console.error('Email history insert error:', historyError);
      }
    }

    const elapsedMs = Date.now() - startedAt;

    return res.status(200).json({
      success: true,
      leadsFound: processedLeads.length,
      emailsFound: leadsWithEmail.length,
      emailsSent: emailsSent.length,
      leads: processedLeads,
      sentEmails: emailsSent,
      elapsedMs,
      message: `Found ${processedLeads.length} businesses, ${leadsWithEmail.length} with emails, ${emailsSent.length} emails recorded.`,
    });
  } catch (err) {
    console.error('Scan handler error:', err);
    return res
      .status(500)
      .json({ error: err?.message || 'Failed to generate leads' });
  }
}
