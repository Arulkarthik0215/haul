import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { GoogleGenerativeAI } from "npm:@google/generative-ai@0.21.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Create a client using the user's JWT for auth verification
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

    if (userError) {
      throw new Error(`Auth failed: ${userError.message}`);
    }
    if (!user) {
      throw new Error("Auth failed: no user returned");
    }

    // Admin client — uses service role key to bypass RLS for DB writes
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // 2. Get the Google provider token and optional page_token from the request body
    const { provider_token, page_token } = await req.json();

    if (!provider_token) {
      throw new Error("Missing Google provider token");
    }

    // 3. Fetch emails from Gmail API
    const query = "subject:(order OR receipt OR invoice OR purchase OR shipped OR delivery)";

    let gmailUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=20`;
    if (page_token) {
      gmailUrl += `&pageToken=${page_token}`;
    }

    const gmailListResponse = await fetch(gmailUrl, {
      headers: { Authorization: `Bearer ${provider_token}` },
    });

    const gmailListData = await gmailListResponse.json();
    if (gmailListData.error) {
      throw new Error(`Gmail API error: ${gmailListData.error.message} (code: ${gmailListData.error.code})`);
    }

    const messages = gmailListData.messages || [];
    const nextPageToken = gmailListData.nextPageToken;
    const parsedOrders = [];

    // Initialize Gemini AI
    const geminiKey = Deno.env.get("GEMINI_API_KEY") || "";
    if (!geminiKey) {
      throw new Error("GEMINI_API_KEY secret is not set");
    }
    const genAI = new GoogleGenerativeAI(geminiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    // 4. Process each email
    for (const message of messages) {
      const emailResponse = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${message.id}?format=full`,
        {
          headers: { Authorization: `Bearer ${provider_token}` },
        }
      );
      const emailData = await emailResponse.json();

      // Extract text content from email body — handles nested multipart structures
      // and HTML-only emails (most order confirmations are HTML-only)
      function decodeBase64(data: string): string {
        return atob(data.replace(/-/g, "+").replace(/_/g, "/"));
      }

      function stripHtml(html: string): string {
        return html
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
          .replace(/<[^>]+>/g, " ")
          .replace(/&nbsp;/g, " ")
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&#?\w+;/g, " ")
          .replace(/\s+/g, " ")
          .trim();
      }

      function extractBody(payload: any): { text: string; html: string } {
        let text = "";
        let html = "";

        if (payload.parts) {
          for (const part of payload.parts) {
            if (part.mimeType === "text/plain" && part.body?.data) {
              text += decodeBase64(part.body.data);
            } else if (part.mimeType === "text/html" && part.body?.data) {
              html += decodeBase64(part.body.data);
            } else if (part.mimeType?.startsWith("multipart/")) {
              const nested = extractBody(part);
              if (nested.text) text += nested.text;
              if (nested.html) html += nested.html;
            }
          }
        } else if (payload.body?.data) {
          if (payload.mimeType === "text/plain") {
            text = decodeBase64(payload.body.data);
          } else if (payload.mimeType === "text/html") {
            html = decodeBase64(payload.body.data);
          }
        }

        return { text, html };
      }

      const { text: plainText, html: htmlBody } = extractBody(emailData.payload);
      const bodyText = plainText || stripHtml(htmlBody);

      if (!bodyText) {
        console.log("Skipping email with no extractable body:", message.id);
        continue;
      }

      // 5. Parse with Gemini AI
      const prompt = `
      Extract order information from this email. Return valid JSON only, no markdown formatting.
      {
        "platform": "Amazon|Flipkart|Swiggy|Zomato|Blinkit|Zepto|Myntra|Ajio|BookMyShow|Uber|IRCTC|Other",
        "merchant": "store name",
        "order_id": "order number",
        "status": "ordered|shipped|delivered|cancelled|refunded",
        "total_amount": number,
        "currency": "INR",
        "category": "shopping|food|grocery|entertainment|travel",
        "products": [{"name": "...", "quantity": 1, "price": number}],
        "tracking_number": "if available",
        "order_date": "ISO date",
        "expected_delivery": "ISO date if mentioned",
        "payment_method": "if mentioned"
      }
      
      If this email is NOT an order/receipt/invoice, return: {"skip": true}
      
      Email content:
      ${bodyText.substring(0, 3000)}
      `;

      try {
        const result = await model.generateContent(prompt);
        let text = result.response.text();

        // clean up markdown json blocks if returned
        text = text.replace(/```json/g, "").replace(/```/g, "").trim();
        const orderData = JSON.parse(text);

        // Skip non-order emails
        if (orderData.skip) {
          console.log("Skipping non-order email:", message.id);
          continue;
        }

        // 6. Insert into Supabase using admin client (bypasses RLS)
        const { data: insertedOrder, error: insertError } = await adminClient
          .from("orders")
          .insert({
            user_id: user.id,
            platform: orderData.platform,
            merchant: orderData.merchant,
            order_id: orderData.order_id,
            status: orderData.status,
            total_amount: orderData.total_amount,
            currency: orderData.currency || "INR",
            category: orderData.category,
            tracking_number: orderData.tracking_number,
            order_date: orderData.order_date || new Date().toISOString(),
            expected_delivery: orderData.expected_delivery,
            payment_method: orderData.payment_method,
            email_message_id: message.id,
          })
          .select()
          .single();

        if (insertError) {
          console.error("Insert error:", insertError);
          continue;
        }

        if (orderData.products && orderData.products.length > 0) {
          const productsToInsert = orderData.products.map((p: any) => ({
            order_id: insertedOrder.id,
            name: p.name,
            quantity: p.quantity,
            price: p.price,
          }));
          await adminClient.from("order_products").insert(productsToInsert);
        }

        parsedOrders.push(orderData);
      } catch (err) {
        console.error("Failed to parse email", message.id, err);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        processed: messages.length, 
        orders: parsedOrders,
        nextPageToken: nextPageToken
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Edge function error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
