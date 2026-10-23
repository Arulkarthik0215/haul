import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PLATFORMS = [
  "Amazon", "Flipkart", "Swiggy", "Zomato", "Blinkit", "Zepto",
  "Myntra", "Ajio", "BookMyShow", "Uber", "IRCTC",
];
const STATUSES = ["ordered", "packed", "shipped", "out_for_delivery", "delivered", "cancelled", "refunded"];
const CATEGORIES = ["shopping", "food", "grocery", "entertainment", "travel"];

// Gmail's own Purchases / Reservations groupings, plus a subject match for order emails Gmail
// files elsewhere (e.g. Updates or Primary). In Gmail search, { a b c } means "any of".
const GMAIL_QUERY =
  "{category:purchases category:reservations subject:(order OR receipt OR invoice OR purchase OR shipped OR delivery OR booking)}";

// Gemini model is configurable so it can be bumped without a code change when Google retires models
const GEMINI_MODEL = Deno.env.get("GEMINI_MODEL") || "gemini-3.8-flash";

// Supabase limits each request to ~2s CPU / 250MB memory and 150s wall clock, so batches stay
// small, Gemini calls are capped, and no new email is started after the time budget.
const TIME_BUDGET_MS = 60_000;
const GEMINI_TIMEOUT_MS = 25_000;
const CONCURRENCY = 2;

class GmailAuthError extends Error {}
// Config-level failures (bad model, bad key) that would fail every email — abort the batch instead
class FatalSyncError extends Error {}
// Gemini overloaded / rate limited / slow — the email is left for the next sync
class GeminiBusyError extends Error {}

// Edge functions have a tight CPU budget, so bodies are decoded lazily and capped in size.
// Gemini only sees the first ~6000 chars of text anyway.
const MAX_ENCODED_TEXT = 16_000;
const MAX_ENCODED_HTML = 200_000;

function decodeBase64(data: string, maxLength: number): string {
  const trimmed = data.length > maxLength ? data.slice(0, maxLength - (maxLength % 4)) : data;
  const binary = atob(trimmed.replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

function stripHtml(html: string): string {
  return html
    .replace(/<(style|script|head)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#?\w+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Collects the still-encoded text/html parts, walking nested multipart structures
function collectParts(payload: any, out: { text: string[]; html: string[] }) {
  if (payload?.parts) {
    for (const part of payload.parts) collectParts(part, out);
  } else if (payload?.body?.data) {
    if (payload.mimeType === "text/plain") out.text.push(payload.body.data);
    else if (payload.mimeType === "text/html") out.html.push(payload.body.data);
  }
}

// Prefers the plain-text part; only decodes HTML for HTML-only emails (most order confirmations)
function extractBodyText(payload: any): string {
  const parts = { text: [] as string[], html: [] as string[] };
  collectParts(payload, parts);
  if (parts.text.length > 0) {
    const text = decodeBase64(parts.text[0], MAX_ENCODED_TEXT).trim();
    if (text.length > 200) return text;
  }
  if (parts.html.length > 0) {
    return stripHtml(decodeBase64(parts.html[0], MAX_ENCODED_HTML));
  }
  return "";
}

function getHeader(payload: any, name: string): string {
  const header = payload?.headers?.find((h: any) => h.name?.toLowerCase() === name.toLowerCase());
  return header?.value ?? "";
}

function toIsoOrNull(value: unknown): string | null {
  if (!value) return null;
  const d = new Date(String(value));
  return isNaN(d.getTime()) ? null : d.toISOString();
}

function toNumber(value: unknown): number {
  if (typeof value === "number") return isFinite(value) ? value : 0;
  const n = parseFloat(String(value ?? "").replace(/[^0-9.\-]/g, ""));
  return isFinite(n) ? n : 0;
}

function pick<T extends string>(value: unknown, allowed: T[], fallback: T): T {
  const v = String(value ?? "");
  return (allowed.find((a) => a.toLowerCase() === v.toLowerCase()) ?? fallback) as T;
}

async function refreshGoogleAccessToken(refreshToken: string): Promise<string> {
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
  if (!clientId || !clientSecret) {
    throw new GmailAuthError("GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET secrets are not set");
  }

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json();
  if (!res.ok || !data.access_token) {
    throw new GmailAuthError(`Google token refresh failed: ${data.error_description || data.error || res.status}`);
  }
  return data.access_token;
}

async function gmailGet(url: string, accessToken: string): Promise<any> {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (res.status === 401) {
    throw new GmailAuthError("Gmail access token is invalid or expired");
  }
  const data = await res.json();
  if (res.status === 403 && /insufficient.*scope/i.test(data.error?.message ?? "")) {
    throw new GmailAuthError(
      "Gmail read permission was not granted. Remove the app at myaccount.google.com/permissions, then sign in again and tick \"Read your email messages\".",
    );
  }
  if (data.error) {
    throw new Error(`Gmail API error: ${data.error.message} (code: ${data.error.code})`);
  }
  return data;
}

async function parseWithGemini(apiKey: string, emailText: string): Promise<any> {
  const prompt = `Extract order information from this email and return JSON matching this shape:
{
  "platform": one of ${JSON.stringify([...PLATFORMS, "Other"])},
  "merchant": "store name",
  "order_id": "order number",
  "status": one of ${JSON.stringify(STATUSES)},
  "total_amount": number,
  "currency": "ISO currency code, e.g. INR",
  "category": one of ${JSON.stringify(CATEGORIES)},
  "products": [{"name": "...", "quantity": 1, "price": number}],
  "tracking_number": "if available, else null",
  "order_date": "ISO date",
  "expected_delivery": "ISO date if mentioned, else null",
  "payment_method": "if mentioned, else null"
}

If this email is NOT about a purchase/order/receipt/invoice/delivery (e.g. marketing, newsletters, OTPs), return {"skip": true}.

${emailText}`;

  let res: Response | null = null;
  let data: any = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 2000 * attempt));
    try {
      res = await callGemini(apiKey, prompt);
    } catch (err: any) {
      if (err?.name === "TimeoutError") throw new GeminiBusyError(`Gemini timed out after ${GEMINI_TIMEOUT_MS}ms`);
      throw err;
    }
    data = await res.json();
    if (![429, 500, 503].includes(res.status)) break;
  }
  if (!res!.ok) {
    const msg = `Gemini API error (${GEMINI_MODEL}): ${data.error?.message || res!.status}`;
    if ([429, 500, 503].includes(res!.status)) throw new GeminiBusyError(msg);
    if ([400, 401, 403, 404].includes(res!.status) && /model|api key|permission|thinking/i.test(data.error?.message ?? "")) {
      throw new FatalSyncError(msg);
    }
    throw new Error(msg);
  }

  const text: string = data.candidates?.[0]?.content?.parts?.map((p: any) => p.text ?? "").join("") ?? "";
  return JSON.parse(text.replace(/```json/g, "").replace(/```/g, "").trim());
}

function callGemini(apiKey: string, prompt: string): Promise<Response> {
  return fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
    {
      method: "POST",
      signal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          // Extraction doesn't need deep reasoning; low thinking keeps each call fast
          thinkingConfig: { thinkingLevel: "low" },
        },
      }),
    },
  );
}

Deno.serve(async (req) => {
  const requestStartedAt = Date.now();
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing Authorization header");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    // Auth client — used only to verify the user's JWT
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // 1. Get the user from the authorization header
    const {
      data: { user },
      error: userError,
    } = await authClient.auth.getUser();

    if (userError || !user) {
      throw new Error(`Auth failed: ${userError?.message || "no user returned"}`);
    }

    // Admin client — uses service role key to bypass RLS for DB writes
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const geminiKey = Deno.env.get("GEMINI_API_KEY") || "";
    if (!geminiKey) {
      throw new Error("GEMINI_API_KEY secret is not set");
    }

    // 2. Resolve a Google access token: use the one from the client if it still works,
    //    otherwise mint a fresh one from the stored refresh token.
    const { provider_token, provider_refresh_token, page_token, page_size } = await req.json().catch(() => ({}));

    if (provider_refresh_token) {
      await adminClient
        .from("gmail_sync_state")
        .upsert({ user_id: user.id, google_refresh_token: provider_refresh_token });
    }

    const { data: syncState } = await adminClient
      .from("gmail_sync_state")
      .select("google_refresh_token, total_emails_processed")
      .eq("user_id", user.id)
      .maybeSingle();
    const refreshToken: string | null = provider_refresh_token || syncState?.google_refresh_token || null;

    let accessToken: string | null = provider_token || null;
    const ensureFreshToken = async () => {
      if (!refreshToken) {
        throw new GmailAuthError("Google access expired and no refresh token is stored. Please sign out and sign in again.");
      }
      accessToken = await refreshGoogleAccessToken(refreshToken);
    };
    if (!accessToken) await ensureFreshToken();

    // 3. Fetch emails from Gmail API
    let gmailUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(GMAIL_QUERY)}&maxResults=${Math.min(Math.max(Number(page_size) || 8, 1), 20)}`;
    if (page_token) {
      gmailUrl += `&pageToken=${encodeURIComponent(page_token)}`;
    }

    let gmailListData;
    try {
      gmailListData = await gmailGet(gmailUrl, accessToken!);
    } catch (err) {
      if (!(err instanceof GmailAuthError) || !provider_token) throw err;
      // The client-provided token expired — retry once with a refreshed token
      await ensureFreshToken();
      gmailListData = await gmailGet(gmailUrl, accessToken!);
    }

    const messages: { id: string }[] = gmailListData.messages || [];
    const nextPageToken = gmailListData.nextPageToken;

    // Skip emails we've already turned into orders (saves Gemini calls on re-sync)
    const { data: existing } = await adminClient
      .from("orders")
      .select("email_message_id")
      .eq("user_id", user.id)
      .in("email_message_id", messages.map((m) => m.id));
    const alreadySynced = new Set((existing ?? []).map((r: any) => r.email_message_id));

    const parsedOrders: any[] = [];
    const errors: string[] = [];
    let skipped = 0;

    // 4. Process emails a few at a time; stop starting new ones near the function's time limit.
    //    Emails not reached aren't saved, so the next sync picks them up again.
    const deadline = requestStartedAt + TIME_BUDGET_MS;
    let deferred = 0;
    const processMessage = async (message: { id: string }) => {
      if (alreadySynced.has(message.id)) {
        skipped++;
        return;
      }

      if (Date.now() > deadline) {
        deferred++;
        return;
      }

      const startedAt = Date.now();
      try {
        const emailData = await gmailGet(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${message.id}?format=full`,
          accessToken!,
        );

        const bodyText = extractBodyText(emailData.payload);
        if (!bodyText) {
          skipped++;
          return;
        }

        const from = getHeader(emailData.payload, "From");
        const subject = getHeader(emailData.payload, "Subject");
        const receivedAt = emailData.internalDate
          ? new Date(Number(emailData.internalDate)).toISOString()
          : new Date().toISOString();

        // 5. Parse with Gemini AI
        const orderData = await parseWithGemini(
          geminiKey,
          `From: ${from}\nSubject: ${subject}\nDate: ${receivedAt}\n\nEmail content:\n${bodyText.substring(0, 6000)}`,
        );

        if (orderData.skip) {
          skipped++;
          return;
        }

        const platform = pick(orderData.platform, [...PLATFORMS, "Other"], "Other");
        const senderName = from.replace(/<.*>/, "").replace(/"/g, "").trim();

        // 6. Upsert into Supabase using admin client (bypasses RLS).
        //    NOT NULL columns get safe fallbacks so a partial AI extraction doesn't drop the order.
        const { data: savedOrder, error: saveError } = await adminClient
          .from("orders")
          .upsert(
            {
              user_id: user.id,
              platform,
              merchant: orderData.merchant || (platform !== "Other" ? platform : senderName) || "Unknown",
              order_id: orderData.order_id || null,
              status: pick(orderData.status, STATUSES, "ordered"),
              total_amount: toNumber(orderData.total_amount),
              currency: /^[A-Z]{3}$/.test(orderData.currency ?? "") ? orderData.currency : "INR",
              category: pick(orderData.category, CATEGORIES, "shopping"),
              tracking_number: orderData.tracking_number || null,
              order_date: toIsoOrNull(orderData.order_date) || receivedAt,
              expected_delivery: toIsoOrNull(orderData.expected_delivery),
              payment_method: orderData.payment_method || null,
              email_message_id: message.id,
              raw_email_snippet: `${subject}\n${bodyText.substring(0, 500)}`,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "email_message_id" },
          )
          .select()
          .single();

        if (saveError) {
          throw new Error(`DB save failed: ${saveError.message}`);
        }

        const products = Array.isArray(orderData.products) ? orderData.products.filter((p: any) => p?.name) : [];
        await adminClient.from("order_products").delete().eq("order_id", savedOrder.id);
        if (products.length > 0) {
          const { error: productsError } = await adminClient.from("order_products").insert(
            products.map((p: any) => ({
              order_id: savedOrder.id,
              name: String(p.name),
              quantity: Math.max(1, Math.round(toNumber(p.quantity)) || 1),
              price: toNumber(p.price),
            })),
          );
          if (productsError) console.error("Products insert error:", message.id, productsError);
        }

        parsedOrders.push(orderData);
        console.log(`Saved order from ${message.id} in ${Date.now() - startedAt}ms`);
      } catch (err: any) {
        if (err instanceof GmailAuthError || err instanceof FatalSyncError) throw err;
        if (err instanceof GeminiBusyError) {
          console.warn("Deferring email", message.id, err.message);
          deferred++;
          return;
        }
        console.error("Failed to process email", message.id, err);
        errors.push(`${message.id}: ${err.message}`);
      }
    };

    const queue = [...messages];
    await Promise.all(
      Array.from({ length: CONCURRENCY }, async () => {
        for (let message = queue.shift(); message; message = queue.shift()) {
          await processMessage(message);
        }
      }),
    );
    console.log(
      `Batch done in ${Date.now() - requestStartedAt}ms: ${parsedOrders.length} saved, ${skipped} skipped, ${errors.length} failed, ${deferred} deferred`,
    );

    await adminClient.from("gmail_sync_state").upsert({
      user_id: user.id,
      last_synced_at: new Date().toISOString(),
      total_emails_processed: (syncState?.total_emails_processed ?? 0) + messages.length,
    });

    return new Response(
      JSON.stringify({
        success: true,
        processed: messages.length,
        skipped,
        deferred,
        orders: parsedOrders,
        errors,
        nextPageToken,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error: any) {
    console.error("Edge function error:", error);
    return new Response(
      JSON.stringify({ error: error.message, reauth: error instanceof GmailAuthError }),
      {
        status: error instanceof GmailAuthError ? 401 : 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
