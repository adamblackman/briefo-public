import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

console.log("--- Edge function script starting to load ---");

// --- Environment Variables ---
// Ensure these are set in your Supabase project's Edge Function settings
const PERPLEXITY_API_KEY = Deno.env.get("PERPLEXITY_API_KEY");
const SUPABASE_URL = Deno.env.get("MY_SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("MY_SUPABASE_SERVICE_ROLE_KEY");
const LINKPREVIEW_API_KEY = Deno.env.get("LINKPREVIEW_API_KEY");

console.log(`PERPLEXITY_API_KEY loaded: ${!!PERPLEXITY_API_KEY}`);
console.log(`SUPABASE_URL loaded: ${!!SUPABASE_URL}`);
console.log(`SUPABASE_SERVICE_ROLE_KEY loaded: ${!!SUPABASE_SERVICE_ROLE_KEY}`);
console.log(`LINKPREVIEW_API_KEY loaded: ${!!LINKPREVIEW_API_KEY}`);

const PERPLEXITY_MODEL = "sonar"; 
const NUM_ARTICLES_TO_GENERATE = 10;

// NEW Interface for API call options
interface PerplexityAPICallOptions {
  jsonSchema?: Record<string, any>;
  temperature?: number;
  web_search_options?: {
    search_domain_filter?: string[];
    search_context_size?: "low" | "medium" | "high";
    search_recency_filter?: "day" | "week" | "month" | "year";
  };
  model?: string;
}

// --- Helper: Perplexity API Call ---
// MODIFIED function signature and body to accept an options object
async function callPerplexityAPI(
  messages: Array<{role: string, content: string}>,
  options?: PerplexityAPICallOptions // Changed from jsonSchema?: Record<string, any>
) {
  if (!PERPLEXITY_API_KEY) {
    console.error("PERPLEXITY_API_KEY is not set inside callPerplexityAPI.");
    throw new Error("PERPLEXITY_API_KEY is not set in environment variables.");
  }

  const body: Record<string, any> = {
    model: options?.model ?? PERPLEXITY_MODEL,
    messages: messages,
    temperature: options?.temperature ?? 0.2, // Use temperature from options or default to 0.2
  };
  
  // Add response_format for JSON Schema if provided in options
  if (options?.jsonSchema) {
    body.response_format = {
      type: "json_schema",
      json_schema: { schema: options.jsonSchema }
    };
  }

  // Add web_search_options if provided in options
  if (options?.web_search_options) {
    body.web_search_options = options.web_search_options;
  }


  const response = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${PERPLEXITY_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error(`(callPerplexityAPI) Perplexity API Error: ${response.status} ${response.statusText}`, errorBody);
    throw new Error(`Perplexity API request failed: ${response.status} ${errorBody}`);
  }

  const data = await response.json();
  // console.log("Perplexity API raw response:", JSON.stringify(data, null, 2));
  const content = data.choices[0]?.message?.content;
  if (!content) {
    console.error("(callPerplexityAPI) No content in Perplexity API response.");
    throw new Error("No content in Perplexity API response.");
  }
  return content;
}

// --- Helper: LinkPreview API Call (New) ---
async function callLinkPreviewAPI(targetUrl: string): Promise<{ title: string; description: string; image: string; url: string } | null> {
  if (!LINKPREVIEW_API_KEY) {
    console.warn("(callLinkPreviewAPI) LINKPREVIEW_API_KEY is not set. Skipping link preview.");
    return null;
  }
  if (!targetUrl) {
    console.warn("(callLinkPreviewAPI) Target URL for LinkPreview is empty. Skipping.");
    return null;
  }

  const encodedUrl = encodeURIComponent(targetUrl);
  const apiUrl = `https://api.linkpreview.net/?q=${encodedUrl}`;
  // console.log(`Calling LinkPreview API for: ${targetUrl}`);

  try {
    const response = await fetch(apiUrl, {
      method: "GET",
      headers: {
        "X-Linkpreview-Api-Key": LINKPREVIEW_API_KEY,
      },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`(callLinkPreviewAPI) LinkPreview API Error: ${response.status} ${response.statusText} for URL ${targetUrl}. Body: ${errorBody}`);
      // Try to parse error JSON if possible
      try {
        const errorJson = JSON.parse(errorBody);
        if (errorJson.error) {
           // Specific LinkPreview error codes (e.g., 423 for robots.txt, 426 for domain rate limit)
           console.error(`(callLinkPreviewAPI) LinkPreview specific error code: ${errorJson.error} for URL ${targetUrl}`);
        }
      } catch {}
      return null; // Don't throw, just return null so the main process can continue
    }

    const data = await response.json();
    // console.log(`LinkPreview API success for ${targetUrl}:`, data);
    return data as { title: string; description: string; image: string; url: string };
  } catch (e: any) {
    console.error(`(callLinkPreviewAPI) Exception during LinkPreview API call for ${targetUrl}: ${e.message}`);
    return null;
  }
}

// --- Helper: Parse JSON from Perplexity (attempts to be robust) ---
function parseJsonFromText<T>(text: string, context: string = ""): T | null {
  try {
    // Attempt to find JSON block if the model wraps it with backticks and type (e.g., ```json ... ```)
    const match = text.match(/```(?:json)?\n([\s\S]*?)\n```/); // Corrected regex for Deno/JS
    if (match && match[1]) {
      console.log(`(${context}) Extracted JSON from markdown block.`);
      return JSON.parse(match[1]) as T;
    }
    // Attempt to parse directly if no markdown block
    console.log(`(${context}) Attempting direct JSON parse.`);
    return JSON.parse(text) as T;
  } catch (e: any) { // Typed 'e' as any to resolve linter warning
    console.warn(`(${context}) Failed to parse JSON. Raw text: "${text}". Error: ${e.message}`);
    // Fallback: very basic extraction for simple arrays/objects if not strictly JSON
    // This is a simplified fallback and might not cover all non-standard outputs.
    if (text.trim().startsWith("[") && text.trim().endsWith("]")) {
        try { return JSON.parse(text.trim()) as T; } catch {}
    }
    if (text.trim().startsWith("{") && text.trim().endsWith("}")) {
        try { return JSON.parse(text.trim()) as T; } catch {}
    }
    console.error(`(${context}) Robust JSON parsing failed.`);
    return null;
  }
}

// --- Main Edge Function ---
serve(async (req: Request) => {
  console.log(`--- SERVE HANDLER ENTRY POINT --- Request Method: ${req.method}, URL: ${req.url}`);

  // Log all headers for debugging incoming request
  // console.log("Incoming Request Headers:");
  // req.headers.forEach((value, key) => {
  //   console.log(`  ${key}: ${value}`);
  // });
  
  // Environment variable check
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !PERPLEXITY_API_KEY /* !LINKPREVIEW_API_KEY is checked in helper */) {
    console.error("CRITICAL ENV VARS MISSING: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or PERPLEXITY_API_KEY. Check function settings.");
    return new Response(JSON.stringify({ error: "Server configuration error: Missing critical environment variables." }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }
  if (!LINKPREVIEW_API_KEY) {
     console.warn("LINKPREVIEW_API_KEY is not set. Link previews will be skipped.");
  }

  // Initialize Supabase client with service_role key
  const supabaseAdmin: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
        persistSession: false, // Disable session persistence for server-side use
        autoRefreshToken: false,
    }
  });
  console.log("Supabase admin client initialized.");

  // Handle CORS preflight request
  if (req.method === "OPTIONS") {
    console.log("Handling OPTIONS preflight request.");
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*", // Adjust to specific origins in production
        "Access-Control-Allow-Methods": "POST, GET, OPTIONS", // Ensure POST is allowed if you intend to call it via POST
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  console.log("Proceeding past OPTIONS check.");
  const processLog: string[] = [];
  try {
    processLog.push("News generation process initiated via HTTP request...");
    console.log("TRY BLOCK ENTERED - News generation process initiated...");

    // --- Fetch Valid Categories (Moved Earlier) ---
    processLog.push("Fetching valid categories from Supabase enum...");
    console.log("Fetching valid categories...");
    const { data: enumCategoriesData, error: enumError } = await supabaseAdmin.rpc('get_enum_values', { enum_name: 'categories' });
    if (enumError || !enumCategoriesData || !Array.isArray(enumCategoriesData) || enumCategoriesData.length === 0) {
      console.error("Error fetching enum categories or enum is empty:", enumError);
      throw new Error(`Failed to fetch enum categories from database: ${enumError?.message || 'No data returned or enum is empty'}. Ensure 'get_enum_values' PostgreSQL function exists and your 'categories' enum has values.`);
    }
    const validCategories: string[] = enumCategoriesData;
    processLog.push(`Fetched ${validCategories.length} valid categories: ${validCategories.join(', ')}`);
    console.log(`Fetched ${validCategories.length} valid categories.`);

    // --- Stage 1: Generate News Titles ---
    processLog.push(`Stage 1: Generating ${NUM_ARTICLES_TO_GENERATE} news titles...`);
    console.log("Stage 1: Generating titles...");
    const titlesPrompt = `List ${NUM_ARTICLES_TO_GENERATE} real, concise (≤12 words) and engaging news titles, each describing a distinct event that occurred between one week ago and today.Use specific names of companies, people, or places—avoid generic placeholders. To ensure breadth, ask:\n• "Which new technologies have been developed or landmarks achieved?"\n• "What key political developments unfolded this week?"\n• "Which major business deals or market moves closed?"\n• "What notable cultural, scientific, or human-interest stories emerged?"\nSelect titles across a diverse set of categories, covering a variety of: [${validCategories.join(', ')}]. Do not repeat the same event, and limit to no more than 3 titles per category.\nOutput only a JSON array of strings (no extra commentary).`;
    
    // Define JSON schema for titles
    const titlesSchema = {
      type: "array",
      items: { type: "string" },
      minItems: NUM_ARTICLES_TO_GENERATE,
      maxItems: NUM_ARTICLES_TO_GENERATE * 2 // Allow some flexibility but not too much
    };
    
    // MODIFIED: Create options object for titles call and pass it
    const titlesCallOptions: PerplexityAPICallOptions = {
      jsonSchema: titlesSchema,
      temperature: 0.5,
      web_search_options: {
        search_domain_filter: [
          "reuters.com", "apnews.com", "bbc.com", "techcrunch.com",
          "npr.org", "theguardian.com", "cnbc.com",
          "technologyreview.com", "computerworld.com", "yahoo.com"
        ],
        search_context_size: "high",
        search_recency_filter: "week"
      }
    };
    const titlesResponseText = await callPerplexityAPI([{ role: "user", content: titlesPrompt }], titlesCallOptions);
    processLog.push(`Raw titles response from Perplexity: "${titlesResponseText}"`);
    console.log("Got titles response from Perplexity.");
    
    // Since we're using JSON Schema, the response should already be valid JSON
    let titles: string[];
    try {
      titles = JSON.parse(titlesResponseText);
      if (!Array.isArray(titles)) {
        throw new Error("Parsed response is not an array");
      }
    } catch (e: any) {
      processLog.push(`JSON parsing failed despite schema: ${e.message}. Falling back to regular parsing.`);
      console.warn("Titles JSON parsing failed despite schema, falling back.");
      const parsedTitles = parseJsonFromText<string[]>(titlesResponseText, "TitlesParsing");
      if (!parsedTitles || !Array.isArray(parsedTitles) || parsedTitles.length === 0) {
        console.error("Failed to parse titles from Perplexity after fallback.");
        throw new Error(`Failed to parse titles from Perplexity, or no titles returned. Check logs for raw response.`);
      }
      titles = parsedTitles;
    }
    
    processLog.push(`Successfully parsed ${titles.length} titles: ${titles.join(" | ")}`);
    console.log(`Successfully parsed ${titles.length} titles.`);

    const newsArticleInserts: Array<{id: number; title: string}> = [];
    for (const title of titles) {
      if (typeof title !== 'string' || title.trim() === '') {
        processLog.push(`Skipping invalid title entry: ${title}`);
        continue;
      }
      const trimmedTitle = title.trim();
      processLog.push(`Attempting to insert title: "${trimmedTitle}"`);
      const { data, error } = await supabaseAdmin
        .from("news")
        .insert({ title: trimmedTitle })
        .select("id, title") // Select title back to confirm
        .single();
      
      if (error) {
        console.error(`DB Insert Error for title "${trimmedTitle}":`, error);
        throw new Error(`Failed to insert title "${trimmedTitle}": ${error.message}`);
      }
      if (data && data.id) {
        newsArticleInserts.push({id: data.id, title: data.title});
        processLog.push(`Inserted title: "${data.title}" with ID: ${data.id}`);
      } else {
        processLog.push(`DB Insert for title "${trimmedTitle}" did not return expected data.`);
      }
    }
    if (newsArticleInserts.length === 0) {
      console.error("No titles were successfully inserted into the database.");
      throw new Error("No titles were successfully inserted into the database.");
    }
    console.log(`Inserted ${newsArticleInserts.length} title stubs.`);

    // --- Stage 2: Generate Summaries, Links, AND GET PREVIEW IMAGE ---
    processLog.push("Stage 2: Generating summaries, links, and fetching preview images...");
    console.log("Stage 2: Processing stubs for summaries, links, images...");
    for (const articleStub of newsArticleInserts) {
      const currentTitle = articleStub.title;
      const articleId = articleStub.id;

      processLog.push(`Processing article ID ${articleId}, Title: "${currentTitle}" for summary...`);
      console.log(`Stage 2 - Processing ID ${articleId}`);
      const summaryPrompt = `For the news titled "${currentTitle}" perform the following steps:\n\n1. Identify Key Actors: Who is involved? (companies, people, organizations)\n2. Describe the Event: What happened? • When and where did it occur?\n3. Explain Context & Sequence: Why did it happen? • How did events unfold, step by step?\n4. Assess Impact: What are the immediate and potential longer-term consequences?\n\n5. Conclude with Relevance: Why does this matter to the reader today?\n\n– Write in an engaging yet factual tone.\n– Ensure the text is 4 to 10 paragraphs long (no more, no fewer).\n– Cover every relevant aspect of the event.\n– Collect all primary-source URLs you used and list them in "links".\nOutput in JSON format with the specified schema.`;
      
      // Define the JSON schema for summary response
      const summarySchema = {
        type: "object",
        properties: {
          summary: {
            type: "string",
            description: "A four to ten paragraph summary of the news event"
          },
          links: { // Renamed from link to links
            type: "array",
            items: { type: "string" }, // Expecting an array of strings
            description: "Array of URLs to relevant primary sources"
          }
        },
        required: ["summary", "links"] // Updated required field
      };
      
      // MODIFIED: Create options object for summary call and pass it
      const summaryCallOptions: PerplexityAPICallOptions = {
        jsonSchema: summarySchema,
        model: "sonar-pro",
        temperature: 0.5,
        web_search_options: {
          search_domain_filter: [
            "reuters.com", "apnews.com", "bbc.com", "techcrunch.com",
            "npr.org", "theguardian.com", "cnbc.com",
            "technologyreview.com", "computerworld.com", "yahoo.com"
          ],
          search_context_size: "high",
          search_recency_filter: "week"
        }
      };
      const summaryResponseText = await callPerplexityAPI([{ role: "user", content: summaryPrompt }], summaryCallOptions);
      processLog.push(`Raw summary response for "${currentTitle}": "${summaryResponseText}"`);
      console.log(`Stage 2 - Got summary response for ID ${articleId}`);
      
      // Define the expected type for summaryData
      type SummaryData = { summary: string; links: string[] };
      
      // Parse the JSON response, expecting an array of links
      let summaryData: SummaryData | null = null;
      try {
        const parsed = JSON.parse(summaryResponseText);
        // Validate the structure
        if (typeof parsed === 'object' && parsed !== null && 
            typeof parsed.summary === 'string' && 
            Array.isArray(parsed.links) && 
            parsed.links.every((link: any) => typeof link === 'string')) { 
          summaryData = parsed as SummaryData;
        } else {
          throw new Error("Parsed JSON does not match the expected schema (summary: string, links: string[])");
        }
      } catch (e: any) { // Keep existing fallback logic
        processLog.push(`JSON parsing failed despite schema: ${e.message}. Falling back to regular parsing.`);
        console.warn(`Summary JSON parsing for ID ${articleId} failed despite schema, falling back.`);
        const parsedSummary = parseJsonFromText<SummaryData>(summaryResponseText, `SummaryParsing-${articleId}`);
        // Validate fallback structure
        if (parsedSummary && typeof parsedSummary.summary === 'string' && Array.isArray(parsedSummary.links)) {
          summaryData = parsedSummary;
        } else {
          processLog.push(`Failed to parse complete summary data for title "${currentTitle}". Skipping update for this item. Check logs for raw response.`);
          console.error(`Failed to parse summary for ID ${articleId} after fallback.`);
          continue; // Skip to the next articleStub
        }
      }
      
      // Ensure summaryData is not null after parsing attempts
      if (!summaryData) {
           processLog.push(`Could not obtain valid summary data for title "${currentTitle}". Skipping.`);
           console.error(`Could not obtain valid summary data for ID ${articleId}`);
           continue;
      }

      processLog.push(`Got summary and ${summaryData.links.length} links for "${currentTitle}". Links: ${summaryData.links.join(", ")}`);
      console.log(`Stage 2 - Parsed summary for ID ${articleId}. Links: ${summaryData.links.join(", ")}`);

      // --- Call LinkPreview API using the FIRST link --- 
      let coverImageUrl: string | null = null;
      if (summaryData.links.length > 0 && summaryData.links[0]) {
        const firstLink = summaryData.links[0];
        processLog.push(`Attempting to fetch preview for the first link: ${firstLink}`);
        console.log(`Stage 2 - Fetching preview for first link: ${firstLink}`);
        const previewData = await callLinkPreviewAPI(firstLink);
        if (previewData && previewData.image) {
          coverImageUrl = previewData.image;
          processLog.push(`Got preview image for "${currentTitle}" from first link: ${coverImageUrl}`);
          console.log(`Stage 2 - Got preview image for ID ${articleId}: ${coverImageUrl}`);
        } else {
          processLog.push(`No preview image found via LinkPreview for the first link of "${currentTitle}".`);
          console.warn(`Stage 2 - No preview image via LinkPreview for ID ${articleId}.`);
        }
      } else {
         processLog.push(`No links provided for "${currentTitle}", cannot fetch preview image.`);
         console.warn(`Stage 2 - No links provided for ID ${articleId}.`);
      }

      // --- Update Supabase with summary, LINKS array, and cover_image_url ---
      // Note: Assumes the database column is now named 'links' and is of type TEXT[]
      const updatePayload: { summary: string; links: string[]; cover_image_url?: string } = {
        summary: summaryData.summary,
        links: summaryData.links, // Pass the whole array
      };
      if (coverImageUrl) {
        updatePayload.cover_image_url = coverImageUrl;
      }

      const { error: updateError } = await supabaseAdmin
        .from("news")
        .update(updatePayload)
        .eq("id", articleId);

      if (updateError) {
        processLog.push(`Failed to update article "${currentTitle}" (ID: ${articleId}) with details: ${updateError.message}`);
        console.error(`DB Update Error for details (ID ${articleId}):`, updateError);
      } else {
        processLog.push(`Updated article "${currentTitle}" (ID: ${articleId}) with summary, ${summaryData.links.length} links${coverImageUrl ? ", and image" : ""}.`);
        console.log(`Stage 2 - Updated article ID ${articleId} with details.`);
      }
    }

    // --- Stage 3: Generate Categories ---
    processLog.push("Stage 3: Generating categories...");
    processLog.push(`Using the ${validCategories.length} pre-fetched valid categories for generation: ${validCategories.join(', ')}`);

    for (const articleStub of newsArticleInserts) {
      const articleId = articleStub.id;
      // Fetch the item again to get title and summary (summary might have been just added)
      const { data: newsItem, error: fetchError } = await supabaseAdmin
        .from("news")
        .select("id, title, summary")
        .eq("id", articleId)
        .single();

      if (fetchError || !newsItem || !newsItem.summary) {
        processLog.push(`Skipping category generation for article ID ${articleId}: ${fetchError?.message || 'Not found or no summary'}`);
        console.warn(`Stage 3 - Skipping category gen for ID ${articleId}: No item or summary.`);
        continue;
      }
      const { title: currentTitle, summary: currentSummary } = newsItem;
      processLog.push(`Processing article ID ${articleId}, Title: "${currentTitle}" for categories...`);
      console.log(`Stage 3 - Processing ID ${articleId} for categories.`);

      const categoriesPrompt = `You are a focused news–categorization assistant. Given the news article with title "${currentTitle}" and summary: "${currentSummary}”, select 1 to 3 most relevant categories ONLY from the following list: [${validCategories.join(', ')}]. Use “Breaking News” sparingly—only when an event is truly urgent and time-sensitive. Output in JSON format as an array of strings. Do not add any other text or explanations.`;
      
      // Define JSON schema for categories
      const categoriesSchema = {
        type: "array",
        items: { 
          type: "string",
          enum: validCategories // Ensure only valid categories are returned
        },
        minItems: 1,
        maxItems: 5
      };
      
      // MODIFIED: Create options object for categories call and pass it
      const categoriesCallOptions: PerplexityAPICallOptions = {
        jsonSchema: categoriesSchema,
        model: "sonar", // Specific model for categories
        temperature: 0.1, // Specific temperature for categories
        web_search_options: { // Specific web search options for categories
          search_context_size: "low"
        }
      };
      const categoriesResponseText = await callPerplexityAPI([{ role: "user", content: categoriesPrompt }], categoriesCallOptions);
      processLog.push(`Raw categories response for "${currentTitle}": "${categoriesResponseText}"`);
      console.log(`Stage 3 - Got categories response for ID ${articleId}`);
      
      // Since we're using JSON Schema, the response should already be valid JSON with only enum values
      let articleCategories: string[];
      try {
        articleCategories = JSON.parse(categoriesResponseText);
        if (!Array.isArray(articleCategories)) {
          throw new Error("Parsed response is not an array");
        }
      } catch (e: any) {
        processLog.push(`JSON parsing failed despite schema: ${e.message}. Falling back to regular parsing.`);
        console.warn(`Categories JSON parsing for ID ${articleId} failed, falling back.`);
        const parsedCategories = parseJsonFromText<string[]>(categoriesResponseText, `CategoriesParsing-${articleId}`);
        if (!parsedCategories || !Array.isArray(parsedCategories) || parsedCategories.length === 0) {
          processLog.push(`No valid categories from Perplexity for "${currentTitle}".`);
          console.error(`No valid categories from Perplexity for ID ${articleId} after fallback.`);
          continue;
        }
        // Even with fallback parsing, ensure only valid enum values
        articleCategories = parsedCategories.filter(cat => validCategories.includes(cat));
      }
      
      if (articleCategories.length === 0) {
        processLog.push(`No valid categories selected by AI (or after filtering) for title "${currentTitle}". Original response did not yield valid categories.`);
        console.warn(`No valid categories after filtering for ID ${articleId}.`);
        continue;
      }

      const { error: updateCategoriesError } = await supabaseAdmin
        .from("news")
        .update({ categories: articleCategories })
        .eq("id", articleId);

      if (updateCategoriesError) {
        processLog.push(`Failed to update "${currentTitle}" with categories: ${updateCategoriesError.message}`);
        console.error(`DB Update Error for categories (ID ${articleId}):`, updateCategoriesError);
      } else {
        processLog.push(`Updated "${currentTitle}" with categories: ${articleCategories.join(", ")}.`);
        console.log(`Stage 3 - Updated article ID ${articleId} with categories.`);
      }
    }

    processLog.push("News generation process completed successfully.");
    console.log("TRY BLOCK COMPLETED - News generation process finished successfully.");
    return new Response(JSON.stringify({ success: true, log: processLog }), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred during news generation.";
    console.error("CRITICAL ERROR in main try/catch block:", error);
    processLog.push(`CRITICAL ERROR: ${errorMessage}`);
    // Log stack if available
    if (error instanceof Error && error.stack) {
        processLog.push(`Stack: ${error.stack}`);
    }
    console.log("CATCH BLOCK EXECUTED - Returning 500 error.");
    return new Response(JSON.stringify({ success: false, error: errorMessage, log: processLog }), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      status: 500, // Internal Server Error
    });
  }
});

console.log("--- Edge function script loaded ---");

// To test locally:
// 1. Make sure you have the Supabase CLI installed and are logged in.
// 2. Set the PERPLEXITY_API_KEY environment variable: export PERPLEXITY_API_KEY='your_key_here'
// 3. Navigate to your Supabase project root in the terminal.
// 4. Run: supabase functions serve --no-verify-jwt --env-file ./supabase/.env.local perplexity-news
//    (Ensure .env.local has PERPLEXITY_API_KEY)
// 5. Send a POST request to http://localhost:54321/functions/v1/perplexity-news
//    (or GET, if you modify the function to not expect a body for the initial version)
//    using a tool like curl or Postman.