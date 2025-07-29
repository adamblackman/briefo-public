import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { DeepResearchReport, ReportStatus, ResearchCriterion } from "../_shared/types.ts"; // Assuming types are shared

// Define the structure of the expected request payload
interface RequestPayload {
  // record: { id: string }; // Assuming triggered by Supabase webhook on insert
  reportId: string; // Expect reportId directly when invoked from frontend
}

// Define the structure expected by the Perplexity API (adjust if needed)
interface PerplexityRequest {
  model: string;
  messages: { role: "system" | "user" | "assistant"; content: string }[];
  temperature: number;
  web_search_options: {
    search_context_size: string;
  };
  // Add other parameters like temperature, max_tokens if desired
}

// Define the structure of the Perplexity API response (simplified)
interface PerplexityResponse {
  choices: { message: { content: string } }[];
  // Add error handling structure if needed
}

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 1. --- Get Report ID ---
    // Assuming the function is invoked directly from frontend
    const payload: RequestPayload = await req.json();
    const reportId = payload.reportId; 

    if (!reportId) {
      console.error("Report ID not found in payload:", payload);
      return new Response(JSON.stringify({ error: "Report ID is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Processing report request ID: ${reportId}`);

    // 2. --- Initialize Supabase Admin Client ---
    // Use ADMIN client for elevated privileges within Edge Functions
    const supabaseAdmin = createClient(
      Deno.env.get("MY_SUPABASE_URL") ?? "",
      Deno.env.get("MY_SUPABASE_SERVICE_ROLE_KEY") ?? "", // Use Service Role Key for admin actions
      {
        global: { headers: { Authorization: `Bearer ${Deno.env.get("MY_SUPABASE_SERVICE_ROLE_KEY")}` } },
      }
    );

    // 3. --- Fetch Report Details & Update Status to Generating ---
    console.log("Fetching report details and updating status to generating...");
    const { data: reportData, error: fetchError } = await supabaseAdmin
      .from("deep_research_reports")
      .update({ status: ReportStatus.GENERATING })
      .eq("id", reportId)
      .eq("status", ReportStatus.PENDING) // Only process if still pending
      .select()
      .single();

    if (fetchError || !reportData) {
      console.error("Error fetching report or report not found/not pending:", fetchError || "No data returned");
      // If status was already generating/completed, this might not be an error, just exit.
      if (fetchError?.code === 'PGRST116') { // Resource not found (likely already processed or non-existent)
         console.log(`Report ${reportId} not found or not in pending state. Exiting.`);
         return new Response(JSON.stringify({ message: "Report not found or not pending." }), {
           status: 200, // Not necessarily an error from the function's perspective
           headers: { ...corsHeaders, "Content-Type": "application/json" },
         });
      }
      // For other errors, return 500
      return new Response(JSON.stringify({ error: `Failed to fetch/update report: ${fetchError?.message}` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { ticker, criteria, additional_notes } = reportData as DeepResearchReport;
    console.log(`Fetched details for ticker: ${ticker}`);

    // 4. --- Prepare Prompts for Perplexity ---
    const systemPrompt = `You are an expert financial research assistant named DeepResearch. When the user provides a stock ticker and selects one or more criteria from the following list, produce a step-by-step, in-depth research report that addresses and analyzes each criterion fully. Use clear Markdown headings and subheadings. Do not omit any selected item.\n\nAvailable criteria values and required content:\n\n• management \n  – Profile the CEO, COO, and all relevant C-suite executives\n  – Describe their tenure, prior roles, backgrounds, and key accomplishments\n\n• competitors\n  – Identify the company’s main competitors\n  – Compare valuation multiples and stock performance over recent intervals\n  – Estimate each player’s market share in overlapping segments\n\n• outlook\n  – Summarize consensus growth and earnings estimates from reputable sources  – Review past growth rates by segment and project future expansion plans, products, or markets\n\n• risks\n  – List company‐specific, industry, macroeconomic, and regulatory risks\n  – Explain the impact of each risk on the company’s future growth\n\n• margins\n  – Analyze profit, gross, operating, and EBITDA margins over time\n  – Compare incremental margin trends to peers and industry norms\n\n• valuations\n  – Calculate relevant multiples (EV/Revenue, EV/EBIT, EV/EBITDA, P/E, PEG)\n  – Contextualize each multiple versus competitors and industry medians\n\n• capital_structure\n  – Detail debt-to-equity, interest coverage, cost of capital, beta, and dividend history/policy\n\n• research_development\n  – Report total R&D spend, allocation to key projects, and R&D-to-sales ratio\n  – Compare R&D intensity to peers; highlight flagship initiatives\n\n• revenue_breakdown\n  – Break out revenues by product, service, geography, or segment with percentages\n\n• productivity_metrics\n  – Present metrics such as revenue per employee, operating efficiency, inventory turnover, ARR, CAC, ARPU, etc., choosing the most relevant for the company\n\n• m&a_activity\n  – Summarize recent M&A deals: purchase price, synergies, transaction structure, and market reaction\n\n• supply_chain\n  – Map key suppliers, lead times, logistics risks, and ESG considerations in the supply chain\n\nBehavioral rules:\nCite only publicly available, reputable sources in passing (e.g. “According to FactSet…”), but do not include endnotes or bracketed citation markers.\nWrite in a professional, objective tone; limit each section to 3–6 concise paragraphs.`;

    const userPrompt = `
Company Name: ${ticker}
Criteria:
${criteria.join(', ')}

Additional Notes:
${additional_notes || 'None'}`;

    console.log("System Prompt:", systemPrompt);
    console.log("User Prompt:", userPrompt);

    // 5. --- Call Perplexity API ---
    const perplexityApiKey = Deno.env.get("PERPLEXITY_API_KEY");
    if (!perplexityApiKey) {
        throw new Error("PERPLEXITY_API_KEY environment variable not set.");
    }

    const perplexityPayload: PerplexityRequest = {
        model: "sonar-deep-research",
        messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
        web_search_options: {
          search_context_size: "high"
        }
    };

    console.log("Calling Perplexity API...");
    const perplexityResponse = await fetch("https://api.perplexity.ai/chat/completions", { // Ensure this is the correct endpoint
        method: "POST",
        headers: {
            "Authorization": `Bearer ${perplexityApiKey}`,
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        body: JSON.stringify(perplexityPayload),
    });

    if (!perplexityResponse.ok) {
        const errorBody = await perplexityResponse.text();
        console.error("Perplexity API Error:", perplexityResponse.status, errorBody);
        throw new Error(`Perplexity API request failed: ${perplexityResponse.status} ${errorBody}`);
    }

    const result: PerplexityResponse = await perplexityResponse.json();
    let generatedReport = result.choices?.[0]?.message?.content?.trim();

    // Clean the report: Remove the <think> block
    if (generatedReport) {
      generatedReport = generatedReport.replace(/<think>[\s\S]*?<\/think>/, '').trim();
    }

    if (!generatedReport) {
        console.error("No report content received from Perplexity or content was only the think block:", result);
        throw new Error("Perplexity response did not contain report content.");
    }
    console.log("Report generated successfully by Perplexity.");

    // 6. --- Update Report in Supabase ---
    console.log("Updating report in Supabase with generated content and completed status...");
    const { error: updateError } = await supabaseAdmin
        .from("deep_research_reports")
        .update({
            report: generatedReport,
            status: ReportStatus.COMPLETED,
        })
        .eq("id", reportId);

    if (updateError) {
        console.error("Error updating report:", updateError);
        // Attempt to set status to failed if final update fails
        await supabaseAdmin.from("deep_research_reports").update({ status: ReportStatus.FAILED }).eq("id", reportId);
        throw new Error(`Failed to store generated report: ${updateError.message}`);
    }

    console.log(`Report ${reportId} successfully completed.`);
    return new Response(JSON.stringify({ success: true, reportId: reportId }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
    });

  } catch (error) {
    console.error("Unhandled error in Edge Function:", error);
    // Attempt to update status to FAILED if possible
    // Try to get reportId from the original request payload if possible
    let reportIdToFail: string | undefined;
    try {
      // Re-parse or access payload if needed and possible within scope
      // This part is tricky as req might not be easily accessible here
      // A better approach is to pass reportId into the error if thrown earlier
      // For now, we rely on it potentially being attached to the error object
      reportIdToFail = (error as any)?.reportId;
      // If not attached, we might not know which report failed here.
    } catch (parseError) {
      console.warn("Could not retrieve reportId during error handling:", parseError);
    }

    if (reportIdToFail && Deno.env.get("SUPABASE_URL") && Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) {
       console.log(`Attempting to set report ${reportIdToFail} status to FAILED.`);
       try {
            // Create a specific client instance for this error handling
            const supabaseAdminForError = createClient(
                Deno.env.get("SUPABASE_URL") ?? "",
                Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
                {}
            );
            await supabaseAdminForError
                .from("deep_research_reports")
                .update({ status: ReportStatus.FAILED })
                .eq("id", reportIdToFail);
            console.log(`Successfully set report ${reportIdToFail} status to FAILED.`);
       } catch (failUpdateError) {
            console.error(`Failed to update report ${reportIdToFail} status to FAILED:`, failUpdateError);
       }
    } else {
        console.log("Could not determine report ID or missing Supabase config; cannot set status to FAILED.");
    }

    // Return error response
    return new Response(JSON.stringify({ error: error.message || 'Unknown error occurred' }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
    });
  }
});

// Helper function to ensure shared types are available if not using mono-repo setup
// You might need to copy the types/research.ts content into _shared/types.ts
// For now, this assumes the types exist in ../_shared/types.ts relative to the function
// --- Placeholder for _shared/types.ts content ---
// export enum ResearchCriterion { ... }
// export enum ReportStatus { ... }
// export interface DeepResearchReport { ... }
// --- End Placeholder --- 