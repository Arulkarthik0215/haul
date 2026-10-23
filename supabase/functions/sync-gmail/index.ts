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

// Models are configurable so they can be changed without a code change when providers retire them
const GEMINI_MODEL = Deno.env.get("GEMINI_MODEL") || "gemini-3.8-flash";
const GROQ_MODEL = Deno.env.get("GROQ_MODEL") || "openai/gpt-oss-120b";
// AI services tried in order; a provider is used only when its API key secret is set
const AI_PROVIDERS = (Deno.env.get("AI_PROVIDERS") || "gemini,groq")
  .split(",")
  .map((p) => p.trim().toLowerCase());

// Supabase limits each request to ~2s CPU / 250MB memory and 150s wall clock, so batches stay
// small, Gemini calls are capped, and no new email is started after the time budget.
const TIME_BUDGET_MS = 60_000;
const AI_TIMEOUT_MS = 25_000;
const GMAIL_CONCURRENCY = 3;
// Emails read per Gemini request — free-tier limits count requests, so batching stretches them
const AI_BATCH_SIZE = 5;
// Characters of each email sent to the AI (order details are near the top)
const AI_TEXT_CHARS = 3000;

class GmailAuthError extends Error {}
// Config-level failures (bad model, bad key) that would fail every email — abort the batch instead
class FatalSyncError extends Error {}
// An AI service is overloaded / rate limited / slow — try another, or leave the email for the next sync
class AiBusyError extends Error {
  constructor(
    message: string,
    public retryAfterSec = 20,
  ) {
    super(message);
  }
}

// An AI service can't be used for the rest of this request (daily limit hit, bad key, missing model)
class AiUnavailableError extends Error {}

// Reads Google's error details: which quota was hit, and how long it says to wait
function describeQuota(error: any): { daily: boolean; retryAfterSec: number | null } {
  const details: any[] = error?.details ?? [];
  const quotaIds = details
    .flatMap((d) => (d.violations ?? []).map((v: any) => `${v.quotaId ?? ""} ${v.quotaMetric ?? ""}`))
    .join(" ");
  const retry = details.find((d) => String(d["@type"] ?? "").includes("RetryInfo"))?.retryDelay;
  const retryAfterSec = retry ? Math.ceil(parseFloat(String(retry))) : null;
  const daily = /PerDay|per_day/i.test(quotaIds) || /per day|daily/i.test(error?.message ?? "");
  return { daily, retryAfterSec };
}

// Edge functions have a tight CPU budget, so bodies are decoded lazily and capped in size.
// Gemini only sees the first ~6000 chars of text anyway.
const MAX_ENCODED_TEXT = 16_000;
const MAX_ENCODED_HTML = 150_000;

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
  return parts.text.length > 0 ? decodeBase64(parts.text[0], MAX_ENCODED_TEXT).trim() : "";
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

interface EmailForAI {
  key: string;
  from: string;
  subject: string;
  date: string;
  text: string;
}

// Cheap, AI-free filter for emails that are obviously not orders (subject only, kept conservative)
const NOT_ORDER_SUBJECT =
  /\b(otp|one[- ]time password|verification code|security code|password reset|is about to expire|has expired|expired for|expiring soon|bill (is )?due|payment (is )?due|newsletter|webinar|sale ends|limited[- ]time offer|coupon code)\b|\d+% off/i;

/** The extraction instructions plus up to AI_BATCH_SIZE emails, for any provider. */
function buildBatchPrompt(emails: EmailForAI[]): string {
  return `You read emails and extract online order details. For EACH email below, return one entry, using this JSON shape:
{"results": [{
  "key": "the email's key, copied exactly",
  "is_order": true or false,
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
}]}

Set "is_order" to true for anything about something the reader bought or booked: order confirmations,
shipping / out-for-delivery / delivered updates, receipts, invoices, payment receipts, app-store or subscription
receipts, food or grocery orders, cancellations, refunds, and travel / movie / event bookings.
Set "is_order" to false only for marketing, newsletters, OTPs, plan-expiry or bill reminders, and other emails
with no purchase in them. When "is_order" is false, return only "key" and "is_order".
Reply with the JSON only.

${emails.map((e) => `=== EMAIL key: ${e.key}\nFrom: ${e.from}\nSubject: ${e.subject}\nDate: ${e.date}\n\n${e.text}`).join("\n\n")}`;
}

/** Maps the model's JSON reply back to each email by key. */
function parseBatchResults(text: string, emails: EmailForAI[]): Map<string, any> {
  const parsed = JSON.parse(text.replace(/```json/g, "").replace(/```/g, "").trim());
  const results: any[] = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.results) ? parsed.results : [parsed];
  const byKey = new Map<string, any>();
  results.forEach((r, i) => byKey.set(String(r?.key ?? emails[i]?.key), r ?? {}));
  return byKey;
}

async function askGemini(prompt: string): Promise<string> {
  const apiKey = Deno.env.get("GEMINI_API_KEY") ?? "";
  let res: Response | null = null;
  let data: any = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 2000));
    try {
      res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`, {
        method: "POST",
        signal: AbortSignal.timeout(AI_TIMEOUT_MS),
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: "application/json",
            // Extraction doesn't need deep reasoning; low thinking keeps each call fast and cheap
            thinkingConfig: { thinkingLevel: "low" },
          },
        }),
      });
    } catch (err: any) {
      if (err?.name === "TimeoutError") throw new AiBusyError(`Gemini timed out after ${AI_TIMEOUT_MS}ms`);
      throw err;
    }
    data = await res.json().catch(() => ({}));
    // Overloaded servers are worth one quick retry; rate limits are handled by waiting / falling back
    if (![500, 503].includes(res.status)) break;
  }
  if (!res!.ok) {
    const message = data.error?.message || `HTTP ${res!.status}`;
    if (res!.status === 429) {
      const { daily, retryAfterSec } = describeQuota(data.error);
      if (daily) throw new AiUnavailableError(`Gemini: daily free limit used up (resets around 12:30–1:30 pm IST)`);
      throw new AiBusyError(`Gemini is rate limited: ${message}`, retryAfterSec ?? 30);
    }
    if ([500, 503].includes(res!.status)) throw new AiBusyError(`Gemini is overloaded: ${message}`, 15);
    if ([400, 401, 403, 404].includes(res!.status) && /model|api key|permission|thinking/i.test(message)) {
      throw new AiUnavailableError(`Gemini (${GEMINI_MODEL}): ${message}`);
    }
    throw new Error(`Gemini error: ${message}`);
  }
  return data.candidates?.[0]?.content?.parts?.map((p: any) => p.text ?? "").join("") ?? "";
}

async function askGroq(prompt: string): Promise<string> {
  let res: Response;
  try {
    res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      signal: AbortSignal.timeout(AI_TIMEOUT_MS),
      headers: { Authorization: `Bearer ${Deno.env.get("GROQ_API_KEY") ?? ""}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0,
        // gpt-oss models think before answering; keep it short
        ...(GROQ_MODEL.startsWith("openai/gpt-oss") ? { reasoning_effort: "low" } : {}),
      }),
    });
  } catch (err: any) {
    if (err?.name === "TimeoutError") throw new AiBusyError(`Groq timed out after ${AI_TIMEOUT_MS}ms`);
    throw err;
  }
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = data.error?.message || `HTTP ${res.status}`;
    if (res.status === 429) {
      if (/per day|\(TPD\)|\(RPD\)/i.test(message)) throw new AiUnavailableError(`Groq: daily free limit used up`);
      throw new AiBusyError(`Groq is rate limited: ${message}`, Number(res.headers.get("retry-after")) || 20);
    }
    if (res.status >= 500) throw new AiBusyError(`Groq is overloaded: ${message}`, 15);
    if ([401, 403, 404].includes(res.status) || /model/i.test(data.error?.code ?? "")) {
      throw new AiUnavailableError(`Groq (${GROQ_MODEL}): ${message}`);
    }
    throw new Error(`Groq error: ${message}`);
  }
  return data.choices?.[0]?.message?.content ?? "";
}

const AI_CLIENTS: Record<string, { key: string; ask: (prompt: string) => Promise<string> }> = {
  gemini: { key: "GEMINI_API_KEY", ask: askGemini },
  groq: { key: "GROQ_API_KEY", ask: askGroq },
};

/**
 * Reads email batches with the configured AI services in order. A service that is out for the
 * day (or misconfigured) is skipped for the rest of the request; a busy one hands over to the next.
 */
function createAiReader() {
  const providers = AI_PROVIDERS.filter((p) => AI_CLIENTS[p] && Deno.env.get(AI_CLIENTS[p].key));
  if (providers.length === 0) {
    throw new FatalSyncError("No AI service is configured — set the GEMINI_API_KEY and/or GROQ_API_KEY secret.");
  }
  const unavailable = new Map<string, string>();
  const usage: Record<string, number> = {};

  return {
    usage,
    async read(emails: EmailForAI[]): Promise<Map<string, any>> {
      const prompt = buildBatchPrompt(emails);
      let busy: AiBusyError | null = null;
      for (const provider of providers) {
        if (unavailable.has(provider)) continue;
        try {
          const results = parseBatchResults(await AI_CLIENTS[provider].ask(prompt), emails);
          usage[provider] = (usage[provider] ?? 0) + emails.length;
          return results;
        } catch (err) {
          if (err instanceof AiUnavailableError) {
            console.warn(`AI service unavailable — ${err.message}`);
            unavailable.set(provider, err.message);
            continue;
          }
          if (err instanceof AiBusyError) {
            console.warn(`AI service busy — ${err.message}`);
            busy ??= err;
            continue;
          }
          throw err;
        }
      }
      if (busy) throw busy;
      throw new FatalSyncError(
        `No AI service can read emails right now, so the sync stopped. Your synced orders are safe — try again later. (${[...unavailable.values()].join("; ")})`,
      );
    },
  };
}

/** Runs fn over items with at most `size` running at once. */
async function runPool<T>(items: T[], size: number, fn: (item: T) => Promise<void>) {
  const queue = [...items];
  await Promise.all(
    Array.from({ length: Math.min(size, queue.length) }, async () => {
      for (let item = queue.shift(); item !== undefined; item = queue.shift()) await fn(item);
    }),
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

    const ai = createAiReader();

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

    // ...and emails an earlier sync already judged "not an order", so the AI never reads them twice
    const { data: skippedBefore } = await adminClient
      .from("skipped_emails")
      .select("email_message_id")
      .eq("user_id", user.id)
      .in("email_message_id", messages.map((m) => m.id));
    const previouslySkipped = new Set((skippedBefore ?? []).map((r: any) => r.email_message_id));

    const parsedOrders: any[] = [];
    const errors: string[] = [];
    let skipped = 0;
    // Why emails were skipped — reported back so "0 found" is explainable
    const skipReasons = { already_synced: 0, previously_skipped: 0, not_an_order: 0, no_text: 0 };
    // Non-orders found in this request, remembered at the end
    const toRemember: { email_message_id: string; reason: string; subject: string }[] = [];
    const notOrderSubjects: string[] = [];

    // 4. Download the new emails (a few at a time) and drop obvious non-orders without the AI.
    //    Emails not reached before the time budget aren't saved, so the next sync picks them up.
    const deadline = requestStartedAt + TIME_BUDGET_MS;
    let deferred = 0;
    // Once Gemini says "slow down", stop calling it for the rest of this request
    let busyReason: string | null = null;
    let retryAfterSec = 0;

    type Candidate = EmailForAI & { id: string; bodyText: string };
    const candidates: Candidate[] = [];

    const pending = messages.filter((m) => {
      if (alreadySynced.has(m.id)) {
        skipped++;
        skipReasons.already_synced++;
        return false;
      }
      if (previouslySkipped.has(m.id)) {
        skipped++;
        skipReasons.previously_skipped++;
        return false;
      }
      return true;
    });

    await runPool(pending, GMAIL_CONCURRENCY, async (message) => {
      if (Date.now() > deadline) {
        deferred++;
        return;
      }
      try {
        const emailData = await gmailGet(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${message.id}?format=full`,
          accessToken!,
        );
        const from = getHeader(emailData.payload, "From");
        const subject = getHeader(emailData.payload, "Subject");
        // Fall back to Gmail's preview snippet when the body can't be decoded
        const bodyText = extractBodyText(emailData.payload) || emailData.snippet || "";
        if (!bodyText && !subject) {
          skipped++;
          skipReasons.no_text++;
          toRemember.push({ email_message_id: message.id, reason: "no_text", subject });
          console.log(`Skipped ${message.id} (no text)`);
          return;
        }
        if (NOT_ORDER_SUBJECT.test(subject)) {
          skipped++;
          skipReasons.not_an_order++;
          if (notOrderSubjects.length < 8) notOrderSubjects.push(subject);
          toRemember.push({ email_message_id: message.id, reason: "filtered", subject });
          console.log(`Filtered ${message.id} (not an order, no AI): ${subject}`);
          return;
        }
        const date = emailData.internalDate
          ? new Date(Number(emailData.internalDate)).toISOString()
          : new Date().toISOString();
        candidates.push({
          id: message.id,
          key: `e${candidates.length + 1}`,
          from,
          subject,
          date,
          text: bodyText.substring(0, AI_TEXT_CHARS),
          bodyText,
        });
      } catch (err: any) {
        if (err instanceof GmailAuthError) throw err;
        console.error("Failed to fetch email", message.id, err);
        errors.push(`${message.id}: ${err.message}`);
      }
    });

    // 5. Read the remaining emails with the AI, several per request
    const saveOrder = async (email: Candidate, orderData: any) => {
      const platform = pick(orderData.platform, [...PLATFORMS, "Other"], "Other");
      const senderName = email.from.replace(/<.*>/, "").replace(/"/g, "").trim();

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
            order_date: toIsoOrNull(orderData.order_date) || email.date,
            expected_delivery: toIsoOrNull(orderData.expected_delivery),
            payment_method: orderData.payment_method || null,
            email_message_id: email.id,
            raw_email_snippet: `${email.subject}\n${email.bodyText.substring(0, 500)}`,
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
        if (productsError) console.error("Products insert error:", email.id, productsError);
      }
      parsedOrders.push(orderData);
    };

    for (let i = 0; i < candidates.length; i += AI_BATCH_SIZE) {
      const group = candidates.slice(i, i + AI_BATCH_SIZE);
      if (busyReason || Date.now() > deadline) {
        deferred += group.length;
        continue;
      }

      let results: Map<string, any>;
      try {
        results = await ai.read(group);
      } catch (err: any) {
        if (err instanceof FatalSyncError) throw err;
        if (err instanceof AiBusyError) {
          console.warn(`Deferring ${group.length} emails:`, err.message);
          deferred += group.length;
          busyReason ??= err.message;
          retryAfterSec = Math.max(retryAfterSec, err.retryAfterSec);
          continue;
        }
        console.error("Gemini batch failed", err);
        group.forEach((e) => errors.push(`${e.id}: ${err.message}`));
        continue;
      }

      for (const email of group) {
        const orderData = results.get(email.key);
        if (!orderData) {
          errors.push(`${email.id}: the AI returned no answer for this email`);
          continue;
        }
        if (orderData.skip || orderData.is_order === false) {
          skipped++;
          skipReasons.not_an_order++;
          if (notOrderSubjects.length < 8) notOrderSubjects.push(email.subject);
          toRemember.push({ email_message_id: email.id, reason: "not_an_order", subject: email.subject });
          console.log(`Skipped ${email.id} (not an order): ${email.subject}`);
          continue;
        }
        try {
          await saveOrder(email, orderData);
          console.log(`Saved order from ${email.id}: ${email.subject}`);
        } catch (err: any) {
          console.error("Failed to save order", email.id, err);
          errors.push(`${email.id}: ${err.message}`);
        }
      }
    }
    console.log(
      `Batch done in ${Date.now() - requestStartedAt}ms: ${parsedOrders.length} saved, ${skipped} skipped, ${errors.length} failed, ${deferred} deferred, AI usage ${JSON.stringify(ai.usage)}`,
    );

    if (toRemember.length > 0) {
      const { error: rememberError } = await adminClient
        .from("skipped_emails")
        .upsert(
          toRemember.map((r) => ({ ...r, user_id: user.id })),
          { onConflict: "user_id,email_message_id" },
        );
      if (rememberError) console.error("Failed to remember skipped emails:", rememberError);
    }

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
        skip_reasons: skipReasons,
        not_order_subjects: notOrderSubjects,
        deferred,
        deferred_reason: busyReason,
        ai_usage: ai.usage,
        retry_after: deferred > 0 ? retryAfterSec || 15 : 0,
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
