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

    const systemPrompt = `You are a WooCommerce PHP expert. Generate CLEAN, MINIMAL PHP code for a webhook.

STRICT RULES:
1. Output ONLY valid PHP code. No markdown. No \`\`\`. No explanation text.
2. Keep the code SHORT and SIMPLE — under 80 lines total
3. Use woocommerce_thankyou hook
4. Function name: send_order_to_crm_${data_mode}
5. Include _crm_webhook_sent meta check (prevent double send)
6. JSON body MUST have exactly: customer_name, phone, address, extra_fields
7. ONLY capture fields that actually exist in the checkout form
8. Do NOT add massive exclusion/filter lists
9. Do NOT add hundreds of meta key exclusions
10. For custom meta: just loop get_meta_data() and skip keys starting with _ (internal WooCommerce keys)
11. Add short Bengali comments
12. Use wp_remote_post with x-webhook-secret header
13. address should be a single string, NOT an array

EXAMPLE of CLEAN code structure:
add_action('woocommerce_thankyou', 'send_order_to_crm_lead', 10, 1);
function send_order_to_crm_lead($order_id) {
    $order = wc_get_order($order_id);
    if (!$order) return;
    if ($order->get_meta('_crm_webhook_sent')) return;
    
    // Get billing data
    $billing = $order->get_data()['billing'];
    $customer_name = trim(($billing['first_name'] ?? '') . ' ' . ($billing['last_name'] ?? ''));
    $phone = $billing['phone'] ?? '';
    $address = implode(', ', array_filter([$billing['address_1'] ?? '', $billing['city'] ?? '']));
    
    // Products
    $products = []; $qty = 0;
    foreach ($order->get_items() as $item) { $products[] = $item->get_name(); $qty += $item->get_quantity(); }
    
    $body = ['customer_name'=>$customer_name, 'phone'=>$phone, 'address'=>$address, 'extra_fields'=>[
        'order_id'=>$order_id, 'product'=>implode(', ',$products), 'quantity'=>$qty, 'total'=>$order->get_total()
    ]];
    
    wp_remote_post($url, ['headers'=>['Content-Type'=>'application/json','x-webhook-secret'=>$secret], 'body'=>wp_json_encode($body)]);
    $order->update_meta_data('_crm_webhook_sent','yes'); $order->save();
}

Keep it THIS simple. Match field names to what the form actually has.`;

    const userPrompt = formContext
      ? `Analyze this checkout form HTML. Generate CLEAN PHP code that captures ONLY the fields in this form.

Website: ${site_name} (${site_url})
Data Mode: ${data_mode === "lead" ? "Lead" : "Processing"}
Webhook URL: ${webhook_url}
Secret Key: ${webhook_secret}

FORM HTML (analyze the input/select fields):
${formContext}

IMPORTANT: 
- Look at the input names, placeholders, and labels to identify what fields exist
- Map ONLY those fields to WooCommerce order getters
- If the form has just name/address/phone, the code should be very simple
- Do NOT add complex meta filtering or hundreds of exclusion keys
- Keep it under 60 lines`
      : `Generate a simple universal PHP webhook code.

Website: ${site_name} (${site_url})
Data Mode: ${data_mode === "lead" ? "Lead" : "Processing"}
Webhook URL: ${webhook_url}
Secret Key: ${webhook_secret}

Could not fetch the checkout page. Generate clean universal code that:
1. Gets name, phone, address from billing data
2. Gets product names and quantities
3. Gets order total and payment method
4. Sends to webhook
Keep it simple and under 50 lines.`;


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
