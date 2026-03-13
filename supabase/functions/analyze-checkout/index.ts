const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { site_url, site_name, data_mode, webhook_secret, webhook_url } = await req.json();

    if (!site_url) {
      return new Response(
        JSON.stringify({ error: "site_url is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 1: Try to fetch the checkout page
    let checkoutHtml = "";
    let fetchError = "";
    const checkoutUrls = [
      site_url.replace(/\/$/, "") + "/checkout/",
      site_url.replace(/\/$/, "") + "/checkout",
      site_url.replace(/\/$/, ""),
    ];

    for (const url of checkoutUrls) {
      try {
        const resp = await fetch(url, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Accept": "text/html,application/xhtml+xml",
            "Accept-Language": "bn-BD,bn;q=0.9,en;q=0.8",
          },
          redirect: "follow",
        });
        if (resp.ok) {
          checkoutHtml = await resp.text();
          // Only use if it looks like it has form elements
          if (checkoutHtml.includes("<form") || checkoutHtml.includes("<input") || checkoutHtml.includes("checkout")) {
            break;
          }
        }
      } catch (e) {
        fetchError = String(e);
      }
    }

    // Extract relevant form HTML (reduce token usage)
    let formContext = "";
    if (checkoutHtml) {
      // Extract form elements, inputs, labels, selects
      const formMatch = checkoutHtml.match(/<form[\s\S]*?<\/form>/gi);
      if (formMatch) {
        formContext = formMatch.join("\n").slice(0, 15000);
      } else {
        // Try to find input/select elements
        const inputMatches = checkoutHtml.match(/<(input|select|textarea|label)[^>]*>/gi);
        formContext = inputMatches ? inputMatches.join("\n").slice(0, 10000) : "";
      }
    }

    // Step 2: Use AI to analyze and generate PHP
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "AI API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const systemPrompt = `You are a WooCommerce/WordPress PHP expert. Your job is to analyze a checkout form and generate the perfect PHP webhook code.

CRITICAL RULES:
1. Output ONLY valid PHP code, no markdown, no explanation
2. The function must use woocommerce_thankyou hook
3. Must send data via wp_remote_post to the given webhook URL
4. Must include x-webhook-secret header
5. Must include _crm_webhook_sent meta check to prevent double-sending
6. Must capture ALL form fields found in the checkout
7. The JSON body MUST have: customer_name, phone, address, extra_fields
8. Use $order->get_data()['billing'] for standard fields
9. Use $order->get_meta('field_name') for custom fields
10. All custom/extra fields go inside extra_fields array
11. Add Bengali comments explaining each section
12. Function name must be: send_order_to_crm_${data_mode}`;

    const userPrompt = formContext
      ? `Analyze this checkout form HTML and generate PHP code.

Website: ${site_name} (${site_url})
Data Mode: ${data_mode === "lead" ? "Lead" : "Processing"}
Webhook URL: ${webhook_url}
Secret Key: ${webhook_secret}

CHECKOUT FORM HTML:
${formContext}

Generate a complete PHP function that captures ALL the fields found in this form. Map each form field to the appropriate WooCommerce order getter. Include comments in Bengali explaining what each field is.`
      : `Generate a universal PHP webhook code for a WooCommerce site.

Website: ${site_name} (${site_url})
Data Mode: ${data_mode === "lead" ? "Lead" : "Processing"}
Webhook URL: ${webhook_url}
Secret Key: ${webhook_secret}

I could not fetch the checkout page HTML, so generate a universal code that:
1. Captures ALL billing data dynamically from $order->get_data()['billing']
2. Captures ALL custom meta fields from $order->get_meta_data()
3. Captures product names and quantities
4. Sends everything to the webhook

Add Bengali comments explaining the code. Note: The checkout page could not be fetched (possibly requires cart items or blocks direct access), so the code should be as universal as possible.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.2,
        max_tokens: 4000,
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI API error:", errText);
      return new Response(
        JSON.stringify({ error: "AI analysis failed", details: errText }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await aiResponse.json();
    let generatedCode = aiData.choices?.[0]?.message?.content || "";

    // Clean up: remove markdown code blocks if present
    generatedCode = generatedCode
      .replace(/^```php\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    // Also extract detected fields for UI display
    const detectedFields: string[] = [];
    const fieldPatterns = [
      /get_billing_(\w+)/g,
      /get_meta\(['"]([^'"]+)['"]\)/g,
      /\$billing_data\['(\w+)'\]/g,
    ];
    for (const pattern of fieldPatterns) {
      let match;
      while ((match = pattern.exec(generatedCode)) !== null) {
        const field = match[1];
        if (!detectedFields.includes(field) && !field.startsWith("_crm")) {
          detectedFields.push(field);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        generated_code: generatedCode,
        detected_fields: detectedFields,
        form_found: !!formContext,
        site_analyzed: site_url,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
