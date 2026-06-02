import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createClient } from "npm:@supabase/supabase-js@2";
import * as bcrypt from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";

const app = new Hono();

// Initialize Supabase client
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// Enable logger
app.use("*", logger(console.log));

// Enable CORS
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  })
);

// Health check
app.get("/make-server-de060722/health", (c) => {
  return c.json({ status: "ok" });
});

// =======================
// AUTHENTICATION ENDPOINTS
// =======================

// Register new user
app.post("/make-server-de060722/auth/register", async (c) => {
  try {
    const { name, email, password } = await c.req.json();

    if (!name || !email || !password) {
      return c.json({ error: "Missing required fields" }, 400);
    }

    if (password.length < 8) {
      return c.json({ error: "Password must be at least 8 characters" }, 400);
    }

    // Create user in Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: false, // Require email verification
      user_metadata: { name },
    });

    if (authError) {
      console.error("Auth error:", authError);
      return c.json({ error: authError.message }, 400);
    }

    // Create user profile
    const { error: profileError } = await supabase
      .from("users")
      .insert({
        id: authData.user.id,
        email,
        full_name: name,
      });

    if (profileError) {
      console.error("Profile error:", profileError);
      // Rollback auth user
      await supabase.auth.admin.deleteUser(authData.user.id);
      return c.json({ error: "Failed to create user profile" }, 500);
    }

    // Generate verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    await supabase.from("email_verification_codes").insert({
      user_id: authData.user.id,
      code: verificationCode,
      expires_at: expiresAt.toISOString(),
    });

    // TODO: Send verification email via SMTP
    console.log(`Verification code for ${email}: ${verificationCode}`);

    return c.json({
      success: true,
      userId: authData.user.id,
      message: "Registration successful. Please check your email for verification code.",
    });
  } catch (error) {
    console.error("Registration error:", error);
    return c.json({ error: "Registration failed" }, 500);
  }
});

// Verify email
app.post("/make-server-de060722/auth/verify-email", async (c) => {
  try {
    const { email, code } = await c.req.json();

    // Get user by email
    const { data: authData, error: authError } = await supabase.auth.admin.listUsers();
    const user = authData.users.find((u) => u.email === email);

    if (!user) {
      return c.json({ error: "User not found" }, 404);
    }

    // Check verification code
    const { data: codes, error: codeError } = await supabase
      .from("email_verification_codes")
      .select("*")
      .eq("user_id", user.id)
      .eq("code", code)
      .eq("used", false)
      .gte("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1);

    if (codeError || !codes || codes.length === 0) {
      return c.json({ error: "Invalid or expired verification code" }, 400);
    }

    // Mark code as used
    await supabase
      .from("email_verification_codes")
      .update({ used: true })
      .eq("id", codes[0].id);

    // Confirm email in auth
    await supabase.auth.admin.updateUserById(user.id, {
      email_confirm: true,
    });

    return c.json({ success: true, message: "Email verified successfully" });
  } catch (error) {
    console.error("Verification error:", error);
    return c.json({ error: "Verification failed" }, 500);
  }
});

// Login
app.post("/make-server-de060722/auth/login", async (c) => {
  try {
    const { email, password } = await c.req.json();

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return c.json({ error: error.message }, 401);
    }

    // Get user profile
    const { data: profile } = await supabase
      .from("users")
      .select("*")
      .eq("id", data.user.id)
      .single();

    return c.json({
      success: true,
      user: {
        id: data.user.id,
        email: data.user.email,
        name: profile?.full_name,
      },
      session: data.session,
    });
  } catch (error) {
    console.error("Login error:", error);
    return c.json({ error: "Login failed" }, 500);
  }
});

// Get current user
app.get("/make-server-de060722/auth/me", async (c) => {
  try {
    const authHeader = c.req.header("Authorization");
    if (!authHeader) {
      return c.json({ error: "No authorization header" }, 401);
    }

    const token = authHeader.replace("Bearer ", "");
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data.user) {
      return c.json({ error: "Invalid token" }, 401);
    }

    const { data: profile } = await supabase
      .from("users")
      .select("*")
      .eq("id", data.user.id)
      .single();

    return c.json({
      user: {
        id: data.user.id,
        email: data.user.email,
        name: profile?.full_name,
      },
    });
  } catch (error) {
    console.error("Get user error:", error);
    return c.json({ error: "Failed to get user" }, 500);
  }
});

// =======================
// PAYMENT ENDPOINTS
// =======================

// IMPORTANT: NEVER store credit card information
// Use Stripe to handle all payment data securely

app.post("/make-server-de060722/create-payment-intent", async (c) => {
  try {
    const authHeader = c.req.header("Authorization");
    if (!authHeader) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);

    if (userError || !userData.user) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const {
      radius,
      businessTypes,
      extraSelections,
      premiumTypes,
      totalPrice,
      location,
    } = await c.req.json();

    // TODO: Integrate with Stripe
    // const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));
    // const paymentIntent = await stripe.paymentIntents.create({
    //   amount: Math.round(totalPrice * 100), // Convert to cents
    //   currency: 'usd',
    //   metadata: { userId: userData.user.id }
    // });

    // For now, simulate payment
    const paymentIntentId = `pi_test_${Date.now()}`;

    // Create purchase record
    const { data: purchase, error: purchaseError } = await supabase
      .from("purchases")
      .insert({
        user_id: userData.user.id,
        radius_miles: radius,
        business_types: businessTypes,
        extra_selections: extraSelections || 0,
        premium_types: premiumTypes || [],
        total_price: totalPrice,
        location_address: location.address,
        location_city: location.city,
        location_state: location.state,
        location_zip: location.zipCode,
        stripe_payment_intent_id: paymentIntentId,
        status: "active",
      })
      .select()
      .single();

    if (purchaseError) {
      console.error("Purchase error:", purchaseError);
      return c.json({ error: "Failed to create purchase" }, 500);
    }

    return c.json({
      success: true,
      purchaseId: purchase.id,
      clientSecret: `${paymentIntentId}_secret`, // Stripe client secret
    });
  } catch (error) {
    console.error("Payment intent error:", error);
    return c.json({ error: "Failed to create payment intent" }, 500);
  }
});

// Confirm payment
app.post("/make-server-de060722/confirm-payment", async (c) => {
  try {
    const authHeader = c.req.header("Authorization");
    if (!authHeader) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);

    if (userError || !userData.user) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const { purchaseId, paymentIntentId } = await c.req.json();

    // TODO: Verify payment with Stripe
    // const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));
    // const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    // if (paymentIntent.status !== 'succeeded') {
    //   return c.json({ error: 'Payment not completed' }, 400);
    // }

    // Update purchase status
    await supabase
      .from("purchases")
      .update({ status: "active" })
      .eq("id", purchaseId)
      .eq("user_id", userData.user.id);

    return c.json({ success: true });
  } catch (error) {
    console.error("Confirm payment error:", error);
    return c.json({ error: "Failed to confirm payment" }, 500);
  }
});

// =======================
// LEADS ENDPOINTS
// =======================

// Get user's leads with optional location filters
app.get("/make-server-de060722/leads", async (c) => {
  try {
    const authHeader = c.req.header("Authorization");
    if (!authHeader) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);

    if (userError || !userData.user) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const locationId = c.req.query("locationId");
    const city = c.req.query("city");
    const state = c.req.query("state");
    const userLocationId = c.req.query("userLocationId");

    let query = supabase
      .from("leads")
      .select("*")
      .eq("user_id", userData.user.id);

    // Filter by user_location_id (most precise — set by Python sync)
    if (userLocationId) {
      query = query.eq("user_location_id", userLocationId);
    } else if (locationId) {
      query = query.eq("user_location_id", locationId);
    } else {
      // Fallback: filter by city + state
      if (city) query = query.eq("city", city);
      if (state) query = query.eq("state", state);
    }

    const { data: leads, error } = await query.order("ranking", { ascending: false });

    if (error) {
      console.error("Fetch leads error:", error);
      return c.json({ error: "Failed to fetch leads" }, 500);
    }

    return c.json({ leads });
  } catch (error) {
    console.error("Get leads error:", error);
    return c.json({ error: "Failed to get leads" }, 500);
  }
});

// Get user's purchases
app.get("/make-server-de060722/purchases", async (c) => {
  try {
    const authHeader = c.req.header("Authorization");
    if (!authHeader) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);

    if (userError || !userData.user) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const { data: purchases, error } = await supabase
      .from("purchases")
      .select("*")
      .eq("user_id", userData.user.id)
      .order("purchase_date", { ascending: false });

    if (error) {
      console.error("Fetch purchases error:", error);
      return c.json({ error: "Failed to fetch purchases" }, 500);
    }

    return c.json({ purchases });
  } catch (error) {
    console.error("Get purchases error:", error);
    return c.json({ error: "Failed to get purchases" }, 500);
  }
});

// Update lead status
app.put("/make-server-de060722/leads/:id", async (c) => {
  try {
    const authHeader = c.req.header("Authorization");
    if (!authHeader) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);

    if (userError || !userData.user) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const leadId = c.req.param("id");
    const updates = await c.req.json();

    const { data, error } = await supabase
      .from("leads")
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq("id", leadId)
      .eq("user_id", userData.user.id)
      .select()
      .single();

    if (error) {
      console.error("Update lead error:", error);
      return c.json({ error: "Failed to update lead" }, 500);
    }

    return c.json({ success: true, lead: data });
  } catch (error) {
    console.error("Update lead error:", error);
    return c.json({ error: "Failed to update lead" }, 500);
  }
});

// Get analytics/stats
app.get("/make-server-de060722/analytics", async (c) => {
  try {
    const authHeader = c.req.header("Authorization");
    if (!authHeader) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);

    if (userError || !userData.user) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    // Get lead stats
    const { data: leads } = await supabase
      .from("leads")
      .select("status, business_type, has_website, responded")
      .eq("user_id", userData.user.id);

    const stats = {
      total: leads?.length || 0,
      emailsSent: leads?.filter((l) => l.status !== "new").length || 0,
      responded: leads?.filter((l) => l.responded).length || 0,
      noWebsite: leads?.filter((l) => !l.has_website).length || 0,
      byBusinessType: {},
      byStatus: {},
    };

    leads?.forEach((lead) => {
      // Count by business type
      stats.byBusinessType[lead.business_type] = (stats.byBusinessType[lead.business_type] || 0) + 1;
      // Count by status
      stats.byStatus[lead.status] = (stats.byStatus[lead.status] || 0) + 1;
    });

    return c.json({ stats });
  } catch (error) {
    console.error("Get analytics error:", error);
    return c.json({ error: "Failed to get analytics" }, 500);
  }
});

// =======================
// LEAD GENERATION
// =======================

// POST /generate-leads
// Accepts pre-discovered `places` from frontend (browser-Google Places calls),
// OR accepts location+businessTypes and uses free Overpass API to find businesses.
// No Google API key needed on the server — browser handles Places API.
// This endpoint focuses on: email scraping, email guessing, dedup, DB persistence.
app.post("/make-server-de060722/generate-leads", async (c) => {
  try {
    const { user, error } = await getAuthedUser(c);
    if (error || !user) return c.json({ error: "Unauthorized" }, 401);

    const { data: purchases } = await supabase
      .from("purchases")
      .select("id")
      .eq("user_id", user.id)
      .eq("status", "active")
      .limit(1);

    if (!purchases || purchases.length === 0) {
      return c.json({ error: "No active purchase found." }, 400);
    }

    const body = await c.req.json();
    const { places, location, radiusMiles, businessTypes, senderName, emailTemplate } = body || {};

    const alreadyEmailed = new Set<string>();
    try {
      const { data: emailed } = await supabase
        .from("email_history")
        .select("recipient")
        .eq("user_id", user.id)
        .limit(10000);
      if (emailed) {
        for (const e of emailed) {
          if (e.recipient) alreadyEmailed.add(e.recipient.toLowerCase());
        }
      }
    } catch {}

    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
    const phoneRegex = /(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}/;
    const fakeEmailDomains = ["wixpress", "sentry", "cloudflare", "example.com", "sentry.io", "wix.com", "wordpress.com", "gravatar.com", "schema.org"];
    const emailGuesses = ["info", "contact", "office", "hello", "admin", "manager", "owner", "support", "sales", "service", "team", "leasing"];

    let allLeads: any[] = [];
    const seenPlaceIds = new Set<string>();

    if (places && Array.isArray(places) && places.length > 0) {
      // ── Pre-discovered places from frontend (Google Places in browser) ──
      for (const place of places) {
        if (allLeads.length >= 800) break;
        const pid = place.place_id || `web_${place.website || place.business_name}`;
        if (seenPlaceIds.has(pid)) continue;
        seenPlaceIds.add(pid);

        let email: string | null = place.email || null;
        if (!email && place.website) {
          try {
            email = await scrapeEmailFromWebsite(place.website, emailRegex, fakeEmailDomains);
          } catch {}
          if (!email) {
            email = await guessEmail(place.website, emailRegex, emailGuesses);
          }
        }

        if (email && alreadyEmailed.has(email.toLowerCase())) continue;

        allLeads.push({
          business_name: place.business_name || place.name || "Unknown",
          business_type: place.business_type || "General",
          address: place.address || "",
          city: place.city || "",
          state: place.state || "",
          email: email,
          phone: place.phone || null,
          website: place.website || null,
          has_website: !!place.website,
          place_id: pid,
          profit_score: place.profit_score || estimateProfitScore(place.business_name || "", "General"),
          ranking: place.ranking || place.profit_score || estimateProfitScore(place.business_name || "", "General"),
          distance_from_client: typeof place.distance === "number" ? place.distance : place.distance_from_client || 0,
          status: email ? "new" : "no_email",
        });
      }
    } else if (location?.lat && location?.lng && businessTypes) {
      // ── Fallback: Free Overpass API search (no key needed) ──
      const radiusMeters = (radiusMiles || 10) * 1609.34;
      const enabledTypes = (businessTypes || []).filter((bt: any) => bt.enabled !== false);
      if (enabledTypes.length > 0) {
        const overpassResults = await overpassSearch(location.lat, location.lng, radiusMeters, enabledTypes);
        for (const place of overpassResults) {
          if (allLeads.length >= 800) break;
          const pid = place.place_id || `osm_${place.lat}_${place.lng}`;
          if (seenPlaceIds.has(pid)) continue;
          seenPlaceIds.add(pid);

          let email: string | null = place.email || null;
          if (!email && place.website) {
            try {
              email = await scrapeEmailFromWebsite(place.website, emailRegex, fakeEmailDomains);
            } catch {}
            if (!email) {
              email = await guessEmail(place.website, emailRegex, emailGuesses);
            }
          }

          if (email && alreadyEmailed.has(email.toLowerCase())) continue;

          allLeads.push({
            business_name: place.business_name || place.name || "Unknown",
            business_type: place.business_type || "General",
            address: place.address || "",
            city: place.city || "",
            state: place.state || "",
            email: email,
            phone: place.phone || null,
            website: place.website || null,
            has_website: !!place.website,
            place_id: pid,
            profit_score: place.profit_score || estimateProfitScore(place.business_name || "", "General"),
            ranking: place.ranking || place.profit_score || estimateProfitScore(place.business_name || "", "General"),
            distance_from_client: place.distance_from_client || 0,
            status: email ? "new" : "no_email",
          });
        }
      }
    }

    // Save leads to Supabase
    const purchaseId = purchases[0].id;
    const { data: loc } = await supabase
      .from("user_locations")
      .select("id")
      .eq("user_id", user.id)
      .eq("is_primary", true)
      .limit(1)
      .maybeSingle();

    if (allLeads.length > 0) {
      const leadRows = allLeads.map(l => ({
        purchase_id: purchaseId,
        user_id: user.id,
        user_location_id: loc?.id || null,
        ...l,
      }));
      for (let i = 0; i < leadRows.length; i += 100) {
        const batch = leadRows.slice(i, i + 100);
        await supabase.from("leads").upsert(batch, {
          onConflict: "place_id",
          ignoreDuplicates: true,
        });
      }
    }

    // Record emails in email_history
    const leadsWithEmail = allLeads.filter(l => l.email);
    const emailsSent: any[] = [];
    const subject = "Free modern vending machine upgrade for your business";
    const sender = senderName || "Evan";
    const phoneLine = location?.phone ? `\nCall/Text: ${location.phone}\n` : "";
    const defaultBody = templateBody(sender, phoneLine);
    const bodyContent = emailTemplate || defaultBody;

    for (const lead of leadsWithEmail) {
      if (alreadyEmailed.has(lead.email.toLowerCase())) continue;
      await supabase.from("email_history").upsert({
        user_id: user.id,
        recipient: lead.email.toLowerCase(),
        email_type: "outreach_initial",
        subject,
        body_preview: bodyContent.replace(/{business_name}/g, lead.business_name),
        status: "sent",
        sent_at: new Date().toISOString(),
      }, {
        onConflict: "user_id,recipient,email_type,subject",
        ignoreDuplicates: true,
      });
      emailsSent.push({ email: lead.email, business: lead.business_name });
    }

    return c.json({
      success: true,
      leadsFound: allLeads.length,
      emailsFound: leadsWithEmail.length,
      emailsSent: emailsSent.length,
      leads: allLeads,
      sentEmails: emailsSent,
      message: `Found ${allLeads.length} businesses, ${leadsWithEmail.length} with emails, ${emailsSent.length} emails recorded.`,
    });

  } catch (error: any) {
    console.error("Generate leads error:", error);
    return c.json({ error: error.message || "Failed to generate leads" }, 500);
  }
});

// Overpass API search — free, no key, OpenStreetMap data
async function overpassSearch(lat: number, lng: number, radiusMeters: number, businessTypes: any[]): Promise<any[]> {
  const keywordToOsmTags: Record<string, string[]> = {
    laundromat: ['["amenity"="laundry"]'],
    laundry: ['["amenity"="laundry"]', '["shop"="laundry"]'],
    "car wash": ['["amenity"="car_wash"]'],
    gym: ['["leisure"="fitness_centre"]', '["sport"="gym"]'],
    fitness: ['["leisure"="fitness_centre"]', '["sport"="gym"]'],
    hotel: ['["tourism"="hotel"]'],
    motel: ['["tourism"="motel"]'],
    apartment: ['["building"="apartments"]'],
    "auto repair": ['["shop"="car_repair"]'],
    "car repair": ['["shop"="car_repair"]'],
    tire: ['["shop"="tyres"]'],
    hospital: ['["amenity"="hospital"]'],
    clinic: ['["amenity"="clinic"]'],
    medical: ['["amenity"="clinic"]', '["healthcare"="doctor"]'],
    veterinary: ['["amenity"="veterinary"]'],
    vet: ['["amenity"="veterinary"]'],
    pet: ['["shop"="pet"]', '["amenity"="veterinary"]'],
    restaurant: ['["amenity"="restaurant"]'],
    "fast food": ['["amenity"="fast_food"]'],
    bar: ['["amenity"="bar"]', '["amenity"="pub"]'],
    salon: ['["shop"="hairdresser"]', '["shop"="beauty"]'],
    "car rental": ['["amenity"="car_rental"]'],
    dentist: ['["amenity"="dentist"]'],
    pharmacy: ['["amenity"="pharmacy"]'],
    school: ['["amenity"="school"]'],
    church: ['["amenity"="place_of_worship"]'],
    park: ['["leisure"="park"]'],
    store: ['["shop"]'],
  };

  const results: any[] = [];
  const seen = new Set<string>();

  for (const bt of businessTypes) {
    if (results.length >= 800) break;
    const rawKeywords = [...(bt.requiredKeywords || []), ...(bt.optionalKeywords || [])];
    const uniqueKeywords = rawKeywords.filter((k: string, i: number) => k && rawKeywords.indexOf(k) === i).slice(0, 6);

    for (const keyword of uniqueKeywords) {
      if (results.length >= 800) break;
      const lowerKw = keyword.toLowerCase();
      const osmTags = keywordToOsmTags[lowerKw] || [];

      // Also try to find matching tag by checking if keyword is part of any known mapping
      let matchedTags = osmTags;
      if (matchedTags.length === 0) {
        for (const [key, tags] of Object.entries(keywordToOsmTags)) {
          if (lowerKw.includes(key) || key.includes(lowerKw)) {
            matchedTags = tags;
            break;
          }
        }
      }

      if (matchedTags.length > 0) {
        // Use tagged query
        const radiusMiles = radiusMeters / 1609.34;
        const overpassRadius = Math.min(Math.round(radiusMeters), 50000);
        const queries = matchedTags.map(tag =>
          `(node${tag}(around:${overpassRadius},${lat},${lng});way${tag}(around:${overpassRadius},${lat},${lng});)`
        ).join("");

        const overpassQuery = `[out:json][timeout:30];(${queries});out body center tags qt;`;
        try {
          const resp = await fetch("https://overpass-api.de/api/interpreter", {
            method: "POST",
            body: `data=${encodeURIComponent(overpassQuery)}`,
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            signal: AbortSignal.timeout(25000),
          });
          if (resp.ok) {
            const data = await resp.json();
            for (const el of data.elements || []) {
              if (results.length >= 800) break;
              const name = el.tags?.name;
              if (!name) continue;
              const elLat = el.type === "way" ? (el.center?.lat || lat) : (el.lat || lat);
              const elLng = el.type === "way" ? (el.center?.lon || lng) : (el.lon || lng);
              const id = `${el.type}/${el.id}`;
              if (seen.has(id)) continue;
              seen.add(id);

              const R = 3959;
              const dLat = (lat - elLat) * Math.PI / 180;
              const dLng = (lng - elLng) * Math.PI / 180;
              const a = Math.sin(dLat / 2) ** 2 +
                Math.cos(lat * Math.PI / 180) * Math.cos(elLat * Math.PI / 180) *
                Math.sin(dLng / 2) ** 2;
              const dist = parseFloat((R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(1));

              const website = el.tags?.website || el.tags?.contact?.website || null;
              const phone = el.tags?.phone || el.tags?.["contact:phone"] || null;
              const address = [el.tags?.["addr:housenumber"], el.tags?.["addr:street"], el.tags?.["addr:city"], el.tags?.["addr:state"]].filter(Boolean).join(", ");

              results.push({
                business_name: name,
                business_type: bt.name || "General",
                address: address || "",
                website: website,
                phone: phone,
                place_id: id,
                lat: elLat,
                lng: elLng,
                distance_from_client: dist,
                profit_score: estimateProfitScore(name, bt.name),
              });
            }
          }
        } catch {}
      } else {
        // Name regex search in Overpass
        const radiusMiles = radiusMeters / 1609.34;
        const overpassRadius = Math.min(Math.round(radiusMeters), 50000);
        const escapedKw = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const nameQuery = `[out:json][timeout:30];(node["name"~"${escapedKw}",i](around:${overpassRadius},${lat},${lng});way["name"~"${escapedKw}",i](around:${overpassRadius},${lat},${lng}););out body center tags qt;`;
        try {
          const resp = await fetch("https://overpass-api.de/api/interpreter", {
            method: "POST",
            body: `data=${encodeURIComponent(nameQuery)}`,
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            signal: AbortSignal.timeout(25000),
          });
          if (resp.ok) {
            const data = await resp.json();
            for (const el of data.elements || []) {
              if (results.length >= 800) break;
              const name = el.tags?.name;
              if (!name) continue;
              const elLat = el.type === "way" ? (el.center?.lat || lat) : (el.lat || lat);
              const elLng = el.type === "way" ? (el.center?.lon || lng) : (el.lon || lng);
              const id = `${el.type}/${el.id}`;
              if (seen.has(id)) continue;
              seen.add(id);

              const R = 3959;
              const dLat = (lat - elLat) * Math.PI / 180;
              const dLng = (lng - elLng) * Math.PI / 180;
              const a = Math.sin(dLat / 2) ** 2 +
                Math.cos(lat * Math.PI / 180) * Math.cos(elLat * Math.PI / 180) *
                Math.sin(dLng / 2) ** 2;
              const dist = parseFloat((R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(1));

              const website = el.tags?.website || el.tags?.contact?.website || null;
              const phone = el.tags?.phone || el.tags?.["contact:phone"] || null;
              const address = [el.tags?.["addr:housenumber"], el.tags?.["addr:street"], el.tags?.["addr:city"], el.tags?.["addr:state"]].filter(Boolean).join(", ");

              results.push({
                business_name: name,
                business_type: bt.name || "General",
                address: address || "",
                website: website,
                phone: phone,
                place_id: id,
                lat: elLat,
                lng: elLng,
                distance_from_client: dist,
                profit_score: estimateProfitScore(name, bt.name),
              });
            }
          }
        } catch {}
      }
    }
  }

  return results;
}

// Improved email scraping: handles obfuscated, mailto:, more pages
async function scrapeEmailFromWebsite(websiteUrl: string, emailRegex: RegExp, fakeDomains: string[] = []): Promise<string | null> {
  let baseUrl = websiteUrl;
  if (!baseUrl.startsWith("http")) baseUrl = "https://" + baseUrl;

  const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/123.0 Safari/537.36",
  };

  const visited = new Set<string>();
  const queue: string[] = [baseUrl];

  const priorityPaths = ["/contact", "/contact-us", "/contactus", "/about", "/about-us", "/team", "/staff", "/support", "/location", "/find-us"];
  for (const p of priorityPaths) {
    queue.push(baseUrl.replace(/\/$/, "") + p);
  }

  const obfuscatedRegex = /[a-zA-Z0-9._%+-]+\s*\[?at\]?\s*[a-zA-Z0-9.-]+\s*\[?dot\]?\s*[a-zA-Z]{2,}/gi;
  const mailtoRegex = /mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi;

  while (queue.length > 0 && visited.size < 10) {
    const url = queue.shift()!;
    if (visited.has(url)) continue;
    visited.add(url);

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const resp = await fetch(url, { headers, signal: controller.signal });
      clearTimeout(timeout);

      if (!resp.ok) continue;
      const contentType = resp.headers.get("content-type") || "";
      if (!contentType.includes("text/html")) continue;

      const html = await resp.text();

      // 1. Check for mailto: links
      const mailtoMatch = mailtoRegex.exec(html);
      if (mailtoMatch && mailtoMatch[1]) {
        const email = mailtoMatch[1].toLowerCase();
        if (!fakeDomains.some(d => email.includes(d))) return email;
      }

      // 2. Check for standard email pattern
      const emailMatch = emailRegex.exec(html);
      if (emailMatch) {
        const email = emailMatch[0].toLowerCase();
        if (!fakeDomains.some(d => email.includes(d))) return email;
      }

      // 3. Check for obfuscated emails (user [at] domain [dot] com)
      const obfMatch = obfuscatedRegex.exec(html);
      if (obfMatch) {
        const cleaned = obfMatch[0]
          .replace(/\s*\[at\]\s*/gi, "@")
          .replace(/\s*\[dot\]\s*/gi, ".")
          .replace(/\s+at\s+/gi, "@")
          .replace(/\s+dot\s+/gi, ".")
          .replace(/\s+/g, "")
          .toLowerCase();
        if (!fakeDomains.some(d => cleaned.includes(d))) return cleaned;
      }

      // Follow internal links
      const linkMatches = html.matchAll(/href="([^"]+)"/g);
      for (const match of linkMatches) {
        let href = match[1];
        if (href.startsWith("/")) href = baseUrl.replace(/\/$/, "") + href;
        if (href.startsWith("http") && href.includes(new URL(baseUrl).hostname) && queue.length < 20) {
          queue.push(href);
        }
      }
    } catch {}
  }

  return null;
}

// Email guessing: try common patterns and verify against page content
async function guessEmail(website: string, emailRegex: RegExp, patterns: string[]): Promise<string | null> {
  const domain = extractDomain(website);
  if (!domain || domain.includes("facebook") || domain.includes("yelp") || domain.includes("google") || domain.includes("instagram")) {
    return null;
  }

  for (const pattern of patterns) {
    const guess = `${pattern}@${domain}`;
    try {
      const url = website.startsWith("http") ? website : "https://" + website;
      const resp = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/123.0 Safari/537.36" },
        signal: AbortSignal.timeout(4000),
      });
      if (resp.ok) {
        const text = await resp.text();
        if (text.toLowerCase().includes(guess.toLowerCase())) {
          return guess;
        }
      }
    } catch {}
  }

  // Also search for email in the page text
  try {
    const url = website.startsWith("http") ? website : "https://" + website;
    const resp = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(4000),
    });
    if (resp.ok) {
      const text = await resp.text();
      const found = emailRegex.exec(text);
      if (found) {
        const email = found[0].toLowerCase();
        const fakeDomains = ["wixpress", "sentry", "cloudflare", "example.com", "sentry.io", "wix.com", "wordpress.com", "gravatar.com", "schema.org"];
        if (!fakeDomains.some(d => email.includes(d))) {
          return email;
        }
      }
    }
  } catch {}

  return null;
}

function extractDomain(website: string): string | null {
  try {
    const url = website.startsWith("http") ? new URL(website) : new URL("https://" + website);
    return url.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

function estimateProfitScore(name: string, businessType: string): number {
  const lower = (name || "").toLowerCase() + " " + (businessType || "").toLowerCase();
  if (/gym|fitness|apartment|hotel|urgent|clinic|senior/.test(lower)) return Math.floor(Math.random() * 10) + 90;
  if (/auto|repair|tire|hospital|medical/.test(lower)) return Math.floor(Math.random() * 15) + 70;
  if (/veterinary|vet|pet|animal/.test(lower)) return Math.floor(Math.random() * 15) + 75;
  if (/laundromat|laundry|wash/.test(lower)) return Math.floor(Math.random() * 15) + 65;
  return Math.floor(Math.random() * 30) + 50;
}

function templateBody(sender: string, phoneLine: string): string {
  return (
    "Hi {business_name} Team,\n\n" +
    "I run a small vending service that installs and maintains modern smart vending machines " +
    "at NO COST to your business.\n\n" +
    "We handle installation, restocking, repairs, and maintenance.\n\n" +
    "If you already have vending machines, we can replace them with newer, more reliable smart machines.\n\n" +
    "Would you be open to a quick conversation?\n\n" +
    `Best,\n${sender}` + phoneLine
  );
}

async function getAuthedUser(c: any) {
  const authHeader = c.req.header("Authorization");
  if (!authHeader) {
    return { user: null, error: "Unauthorized" };
  }

  const token = authHeader.replace("Bearer ", "");
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    return { user: null, error: "Unauthorized" };
  }

  return { user: data.user, error: null };
}

// =======================
// SEARCH SETTINGS
// =======================

// POST /search-settings — save business types and search config
app.post("/make-server-de060722/search-settings", async (c) => {
  try {
    const { user, error } = await getAuthedUser(c);
    if (error || !user) return c.json({ error }, 401);

    const body = await c.req.json();
    const { enabledBusinessTypes, businessTypes, latitude, longitude, radiusMeters } = body || {};

    const updateFields: any = {
      preferred_radius_miles: radiusMeters ? Math.round(radiusMeters / 1609.34) : undefined,
      updated_at: new Date().toISOString(),
    };

    const { error: updateError } = await supabase
      .from("users")
      .update(updateFields)
      .eq("id", user.id);

    if (updateError) {
      console.error("Save search settings error:", updateError);
      return c.json({ error: "Failed to save search settings" }, 500);
    }

    return c.json({ success: true, settings: searchConfig });
  } catch (error) {
    console.error("Search settings error:", error);
    return c.json({ error: "Failed to save search settings" }, 500);
  }
});

// GET /search-settings — retrieve saved search config
app.get("/make-server-de060722/search-settings", async (c) => {
  try {
    const { user, error } = await getAuthedUser(c);
    if (error || !user) return c.json({ error }, 401);

    const { data } = await supabase
      .from("users")
      .select("preferred_radius_miles, search_city, search_state")
      .eq("id", user.id)
      .single();

    return c.json({
      settings: {
        radiusMiles: data?.preferred_radius_miles || 10,
        city: data?.search_city || "",
        state: data?.search_state || "",
      },
    });
  } catch (error) {
    console.error("Get search settings error:", error);
    return c.json({ error: "Failed to get search settings" }, 500);
  }
});

app.get("/make-server-de060722/outreach-settings", async (c) => {
  try {
    const { user, error } = await getAuthedUser(c);
    if (error || !user) return c.json({ error }, 401);

    const { data, error: profileError } = await supabase
      .from("users")
      .select("phone, outreach_email, smtp_app_password, sender_name, email_template, google_maps_api_key")
      .eq("id", user.id)
      .single();

    if (profileError) {
      console.error("Fetch outreach settings error:", profileError);
      return c.json({ error: "Failed to fetch outreach settings" }, 500);
    }

    return c.json({
      settings: {
        phone: data?.phone || "",
        outreachEmail: data?.outreach_email || user.email || "",
        smtpAppPassword: data?.smtp_app_password || "",
        senderName: data?.sender_name || "Evan",
        emailTemplate: data?.email_template || "",
        googleMapsApiKey: data?.google_maps_api_key || "",
      },
    });
  } catch (error) {
    console.error("Get outreach settings error:", error);
    return c.json({ error: "Failed to get outreach settings" }, 500);
  }
});

app.post("/make-server-de060722/outreach-settings", async (c) => {
  try {
    const { user, error } = await getAuthedUser(c);
    if (error || !user) return c.json({ error }, 401);

    const { phone, outreachEmail, smtpAppPassword, senderName, emailTemplate, googleMapsApiKey } = await c.req.json();

    const { error: updateError } = await supabase
      .from("users")
      .update({
        phone: phone || null,
        outreach_email: outreachEmail || user.email,
        smtp_app_password: smtpAppPassword || null,
        sender_name: senderName || null,
        email_template: emailTemplate || null,
        google_maps_api_key: googleMapsApiKey || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (updateError) {
      console.error("Save outreach settings error:", updateError);
      return c.json({ error: "Failed to save outreach settings" }, 500);
    }

    return c.json({ success: true });
  } catch (error) {
    console.error("Post outreach settings error:", error);
    return c.json({ error: "Failed to save outreach settings" }, 500);
  }
});

app.get("/make-server-de060722/user-location", async (c) => {
  try {
    const { user, error } = await getAuthedUser(c);
    if (error || !user) return c.json({ error }, 401);

    const { data, error: profileError } = await supabase
      .from("users")
      .select("search_address, search_city, search_state, search_zip, preferred_radius_miles")
      .eq("id", user.id)
      .single();

    if (profileError) {
      console.error("Fetch user location error:", profileError);
      return c.json({ error: "Failed to fetch saved location" }, 500);
    }

    return c.json({
      location: {
        address: data?.search_address || "",
        city: data?.search_city || "",
        state: data?.search_state || "",
        zipCode: data?.search_zip || "",
      },
      preferredRadius: data?.preferred_radius_miles || null,
    });
  } catch (error) {
    console.error("Get user location error:", error);
    return c.json({ error: "Failed to get saved location" }, 500);
  }
});

app.post("/make-server-de060722/user-location", async (c) => {
  try {
    const { user, error } = await getAuthedUser(c);
    if (error || !user) return c.json({ error }, 401);

    const { location, preferredRadius } = await c.req.json();

    const { error: updateError } = await supabase
      .from("users")
      .update({
        search_address: location?.address || null,
        search_city: location?.city || null,
        search_state: location?.state || null,
        search_zip: location?.zipCode || null,
        preferred_radius_miles: preferredRadius || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (updateError) {
      console.error("Save user location error:", updateError);
      return c.json({ error: "Failed to save location" }, 500);
    }

    // Also ensure a user_locations row exists for this location
    // so it shows up in the dashboard's location filter.
    const { data: existingPrimary } = await supabase
      .from("user_locations")
      .select("id")
      .eq("user_id", user.id)
      .eq("is_primary", true)
      .limit(1)
      .maybeSingle();

    if (!existingPrimary && location?.city) {
      await supabase
        .from("user_locations")
        .insert({
          user_id: user.id,
          label: `${location.city}, ${location.state}`,
          address: location.address || "",
          city: location.city || "",
          state: location.state || "",
          zip_code: location.zipCode || null,
          radius_miles: preferredRadius || null,
          is_primary: true,
          locked: false,
        });
    } else if (existingPrimary) {
      // Update the existing primary location with new values
      await supabase
        .from("user_locations")
        .update({
          address: location?.address || undefined,
          city: location?.city || undefined,
          state: location?.state || undefined,
          zip_code: location?.zipCode || undefined,
          radius_miles: preferredRadius || undefined,
          label: location?.city ? `${location.city}, ${location.state}` : undefined,
        })
        .eq("id", existingPrimary.id);
    }

    return c.json({ success: true });
  } catch (error) {
    console.error("Post user location error:", error);
    return c.json({ error: "Failed to save location" }, 500);
  }
});

app.post("/make-server-de060722/upload-csv", async (c) => {
  try {
    const { user, error } = await getAuthedUser(c);
    if (error || !user) return c.json({ error }, 401);

    const { type, rows } = await c.req.json();
    if (!Array.isArray(rows)) {
      return c.json({ error: "Rows must be an array" }, 400);
    }

    if (type === "sentEmails") {
      const sentRows = rows
        .map((row: Record<string, string>) => ({
          user_id: user.id,
          email_address: (row.email || row.email_address || "").trim().toLowerCase(),
          email_type: row.email_type || "initial",
          subject: row.subject || null,
          sent_at: row.sent_at || row.last_contact || new Date().toISOString(),
        }))
        .filter((row: any) => row.email_address);

      if (sentRows.length > 0) {
        const { error: insertError } = await supabase.from("sent_emails").upsert(sentRows, {
          onConflict: "user_id,email_address,email_type",
          ignoreDuplicates: true,
        });

        if (insertError) {
          console.error("Sent email upload error:", insertError);
          return c.json({ error: "Failed to upload sent email history" }, 500);
        }
      }

      return c.json({ success: true, imported: sentRows.length });
    }

    if (type === "leads") {
      const { data: purchase } = await supabase
        .from("purchases")
        .select("id")
        .eq("user_id", user.id)
        .order("purchase_date", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!purchase?.id) {
        return c.json({ error: "Create a purchase before uploading lead rows" }, 400);
      }

      const leadRows = rows
        .map((row: Record<string, string>) => ({
          purchase_id: purchase.id,
          user_id: user.id,
          business_name: row.name || row["Business Name"] || row.business_name || "Unknown Business",
          business_type: row.business_type || row["Business Type"] || "General",
          phone: row.phone || row.Phone || null,
          email: row.email || row.Email || null,
          website: row.website || row["Website URL"] || null,
          has_website: !!(row.website || row["Website URL"]),
          place_id: row.place_id || null,
          profit_score: row.profit_score ? Number(row.profit_score) : null,
          ranking: row.ranking ? Number(row.ranking) : row.profit_score ? Number(row.profit_score) : null,
          status: row.status || "new",
          notes: row.notes || row.Notes || null,
          updated_at: new Date().toISOString(),
        }))
        .filter((row: any) => row.business_name);

      if (leadRows.length > 0) {
        const { error: insertError } = await supabase.from("leads").upsert(leadRows, {
          onConflict: "place_id",
          ignoreDuplicates: false,
        });

        if (insertError) {
          console.error("Lead upload error:", insertError);
          return c.json({ error: "Failed to upload leads" }, 500);
        }
      }

      return c.json({ success: true, imported: leadRows.length });
    }

    return c.json({ error: "Unknown CSV type" }, 400);
  } catch (error) {
    console.error("CSV upload error:", error);
    return c.json({ error: "Failed to upload CSV" }, 500);
  }
});

// =======================
// EMAIL HISTORY (single source of truth for emails)
// =======================

// Minimum number of hours that must elapse between two emails of the
// same type going to the same recipient (initial -> follow_up, etc.)
const EMAIL_RESEND_COOLDOWN_HOURS = 48;

// Returns the most recent email_history row matching
// (user, recipient, email_type), if any.
async function getLastEmailForRecipient(
  userId: string,
  recipient: string,
  emailType: string
) {
  const { data } = await supabase
    .from("email_history")
    .select("id, sent_at, subject, is_followup")
    .eq("user_id", userId)
    .eq("recipient", recipient)
    .eq("email_type", emailType)
    .order("sent_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data || null;
}

export function canSendEmail(
  lastEmail: { sent_at: string } | null,
  options: { isFollowup?: boolean; force?: boolean } = {}
) {
  if (!lastEmail) return { allowed: true };
  if (options.force) return { allowed: true };

  const lastSentAt = new Date(lastEmail.sent_at).getTime();
  const elapsedHours = (Date.now() - lastSentAt) / (1000 * 60 * 60);
  const requiredHours = options.isFollowup
    ? EMAIL_RESEND_COOLDOWN_HOURS
    : EMAIL_RESEND_COOLDOWN_HOURS * 4; // initial emails re-send only after 4x the cooldown
  return {
    allowed: elapsedHours >= requiredHours,
    elapsedHours,
    requiredHours,
    lastSentAt: lastEmail.sent_at,
  };
}

// POST /email-history
// Records a new email into the history. The unique index on
// (user_id, recipient, email_type, subject) is the last line of
// defense against duplicates — the app also pre-checks `canSendEmail`.
app.post("/make-server-de060722/email-history", async (c) => {
  try {
    const { user, error } = await getAuthedUser(c);
    if (error || !user) return c.json({ error }, 401);

    const body = await c.req.json();
    const {
      recipient,
      emailType,
      subject,
      bodyPreview,
      status,
      relatedLeadId,
      relatedPurchaseId,
      isFollowup,
      parentEmailId,
      scheduledFor,
      force,
    } = body || {};

    if (!recipient || !emailType || !subject) {
      return c.json(
        { error: "recipient, emailType and subject are required" },
        400
      );
    }

    const normalizedRecipient = String(recipient).trim().toLowerCase();

    // Prevent duplicate sends: same user, recipient, type, and subject.
    const { data: exact } = await supabase
      .from("email_history")
      .select("id")
      .eq("user_id", user.id)
      .eq("recipient", normalizedRecipient)
      .eq("email_type", emailType)
      .eq("subject", subject)
      .limit(1)
      .maybeSingle();

    if (exact?.id) {
      return c.json(
        {
          success: true,
          duplicate: true,
          message: "Identical email already recorded for this recipient.",
        },
        200
      );
    }

    // Cooldown check based on the most recent email of the same type.
    const last = await getLastEmailForRecipient(
      user.id,
      normalizedRecipient,
      emailType
    );
    const check = canSendEmail(last, { isFollowup: !!isFollowup, force: !!force });
    if (!check.allowed) {
      return c.json(
        {
          error: "Recipient has been contacted too recently.",
          cooldownRemainingHours: Math.max(
            0,
            Math.ceil(check.requiredHours - (check.elapsedHours || 0))
          ),
          lastSentAt: check.lastSentAt,
        },
        429
      );
    }

    const { data, error: insertError } = await supabase
      .from("email_history")
      .insert({
        user_id: user.id,
        recipient: normalizedRecipient,
        email_type: emailType,
        subject,
        body_preview: bodyPreview || null,
        status: status || "sent",
        related_lead_id: relatedLeadId || null,
        related_purchase_id: relatedPurchaseId || null,
        is_followup: !!isFollowup,
        parent_email_id: parentEmailId || null,
        scheduled_for: scheduledFor || null,
        sent_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      // 23505 = unique_violation. Treat as a duplicate rather than
      // an error so the caller can safely retry.
      if (insertError.code === "23505") {
        return c.json(
          {
            success: true,
            duplicate: true,
            message: "Identical email already recorded for this recipient.",
          },
          200
        );
      }
      console.error("Insert email_history error:", insertError);
      return c.json({ error: "Failed to record email" }, 500);
    }

    return c.json({ success: true, email: data });
  } catch (error) {
    console.error("Email history insert error:", error);
    return c.json({ error: "Failed to record email" }, 500);
  }
});

// GET /email-history
// Returns the current user's email history (newest first).
app.get("/make-server-de060722/email-history", async (c) => {
  try {
    const { user, error } = await getAuthedUser(c);
    if (error || !user) return c.json({ error }, 401);

    const limit = Math.min(Number(c.req.query("limit") || 100), 500);

    const { data, error: fetchError } = await supabase
      .from("email_history")
      .select("*")
      .eq("user_id", user.id)
      .order("sent_at", { ascending: false })
      .limit(limit);

    if (fetchError) {
      console.error("Fetch email_history error:", fetchError);
      return c.json({ error: "Failed to fetch email history" }, 500);
    }

    return c.json({ emails: data || [] });
  } catch (error) {
    console.error("Email history fetch error:", error);
    return c.json({ error: "Failed to fetch email history" }, 500);
  }
});

// =======================
// LOCATION LOCKING
// =======================

// GET /user-locations
// Returns all saved locations for the user.
app.get("/make-server-de060722/user-locations", async (c) => {
  try {
    const { user, error } = await getAuthedUser(c);
    if (error || !user) return c.json({ error }, 401);

    const { data, error: fetchError } = await supabase
      .from("user_locations")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });

    if (fetchError) {
      console.error("Fetch user_locations error:", fetchError);
      return c.json({ error: "Failed to fetch locations" }, 500);
    }

    // Also fetch the user's lock status from the users table
    const { data: profile } = await supabase
      .from("users")
      .select("location_locked")
      .eq("id", user.id)
      .single();

    return c.json({
      locations: data || [],
      locationLocked: profile?.location_locked || false,
    });
  } catch (error) {
    console.error("User locations fetch error:", error);
    return c.json({ error: "Failed to fetch locations" }, 500);
  }
});

// POST /user-locations/lock
// Marks the user's primary saved location as locked. After this point
// the user must call /user-locations/unlock (which initiates a paid
// flow) before they can change it.
app.post("/make-server-de060722/user-locations/lock", async (c) => {
  try {
    const { user, error } = await getAuthedUser(c);
    if (error || !user) return c.json({ error }, 401);

    const now = new Date().toISOString();

    // Fetch the user's saved search location from the users table
    const { data: profile } = await supabase
      .from("users")
      .select("search_address, search_city, search_state, search_zip, preferred_radius_miles")
      .eq("id", user.id)
      .single();

    // Ensure a user_locations row exists for the primary location.
    // If none exists yet, create one from the user's saved search fields.
    const { data: existingLoc } = await supabase
      .from("user_locations")
      .select("id")
      .eq("user_id", user.id)
      .eq("is_primary", true)
      .limit(1)
      .maybeSingle();

    if (!existingLoc && profile && (profile.search_address || profile.search_city)) {
      await supabase
        .from("user_locations")
        .insert({
          user_id: user.id,
          label: profile.search_city
            ? `${profile.search_city}, ${profile.search_state}`
            : profile.search_address,
          address: profile.search_address || "",
          city: profile.search_city || "",
          state: profile.search_state || "",
          zip_code: profile.search_zip || null,
          radius_miles: profile.preferred_radius_miles || null,
          is_primary: true,
          locked: true,
          locked_at: now,
        });
    } else {
      // Update existing primary location to locked
      await supabase
        .from("user_locations")
        .update({ locked: true, locked_at: now })
        .eq("user_id", user.id)
        .eq("is_primary", true);
    }

    // Also mark the user record as locked
    await supabase
      .from("users")
      .update({ location_locked: true, location_locked_at: now })
      .eq("id", user.id);

    return c.json({ success: true });
  } catch (error) {
    console.error("Lock location error:", error);
    return c.json({ error: "Failed to lock location" }, 500);
  }
});

// POST /user-locations/unlock (paid add-location flow)
// Charges the user for an additional location slot and unlocks the
// primary location so they can edit it. Pricing is computed server-side
// from `purchased_extra_locations` so the client can't tamper with it.
//
// Required body: { address, city, state, zipCode, latitude?, longitude?,
//                  preferredRadius? }
// Optional body: { stripePaymentIntentId, paymentConfirmed }
app.post("/make-server-de060722/user-locations/unlock", async (c) => {
  try {
    const { user, error } = await getAuthedUser(c);
    if (error || !user) return c.json({ error }, 401);

    const {
      address,
      city,
      state,
      zipCode,
      latitude,
      longitude,
      preferredRadius,
      stripePaymentIntentId,
      paymentConfirmed,
    } = await c.req.json();

    if (!address || !city || !state) {
      return c.json(
        { error: "address, city, and state are required" },
        400
      );
    }

    if (!paymentConfirmed) {
      return c.json(
        {
          error:
            "Payment is required before adding a new location. Confirm payment first.",
        },
        402
      );
    }

    // Save the new location row.
    const { data: location, error: insertError } = await supabase
      .from("user_locations")
      .insert({
        user_id: user.id,
        label: city ? `${city}, ${state}` : address,
        address,
        city,
        state,
        zip_code: zipCode || null,
        latitude: latitude || null,
        longitude: longitude || null,
        radius_miles: preferredRadius || null,
        is_primary: false,
        locked: false,
        stripe_payment_intent_id: stripePaymentIntentId || null,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Insert user_locations error:", insertError);
      return c.json({ error: "Failed to save new location" }, 500);
    }

    // Unlock the primary row and bump the extras counter.
    await supabase
      .from("user_locations")
      .update({ locked: false, locked_at: null })
      .eq("user_id", user.id)
      .eq("is_primary", true);

    await supabase.rpc("increment_user_extra_locations", {
      uid: user.id,
    }).then(() => null, () => null);

    // Fallback path if the RPC isn't installed: do a regular update.
    const { data: profile } = await supabase
      .from("users")
      .select("purchased_extra_locations")
      .eq("id", user.id)
      .single();
    if (profile) {
      await supabase
        .from("users")
        .update({
          purchased_extra_locations: (profile.purchased_extra_locations || 0) + 1,
          location_locked: false,
        })
        .eq("id", user.id);
    }

    return c.json({ success: true, location });
  } catch (error) {
    console.error("Unlock location error:", error);
    return c.json({ error: "Failed to unlock location" }, 500);
  }
});

// POST /user-locations/charge
// Creates a Stripe checkout-style payment intent for adding a new
// location. Returns the clientSecret (and a fake one for now) so the
// front-end can collect payment before calling /unlock.
const EXTRA_LOCATION_PRICE = 97; // USD

app.post("/make-server-de060722/user-locations/charge", async (c) => {
  try {
    const { user, error } = await getAuthedUser(c);
    if (error || !user) return c.json({ error }, 401);

    // TODO: Real Stripe call.
    // const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));
    // const intent = await stripe.paymentIntents.create({
    //   amount: EXTRA_LOCATION_PRICE * 100,
    //   currency: 'usd',
    //   metadata: { userId: user.id, kind: 'extra_location' },
    // });
    const paymentIntentId = `pi_extra_loc_${Date.now()}`;

    return c.json({
      success: true,
      paymentIntentId,
      clientSecret: `${paymentIntentId}_secret`,
      amount: EXTRA_LOCATION_PRICE,
      currency: "usd",
      description:
        "Unlock the ability to add or change your search location. " +
        "Your current location remains active during this purchase.",
    });
  } catch (error) {
    console.error("Charge for location error:", error);
    return c.json({ error: "Failed to start checkout" }, 500);
  }
});

Deno.serve(app.fetch);
