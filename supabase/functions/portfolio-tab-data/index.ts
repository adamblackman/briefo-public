import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Alpaca from "npm:@alpacahq/alpaca-trade-api@^3.1.3"; // Corrected version

// Helper for CORS
const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // Adjust to your specific origin in production
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

console.log("Edge function 'portfolio-tab-data' initializing.");

serve(async (req: Request) => {
  console.log(`Request received: ${req.method}`);

  if (req.method === 'OPTIONS') {
    console.log("Handling OPTIONS preflight request.");
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { symbols } = body;

    console.log("Request body parsed, symbols:", symbols);

    if (!symbols || !Array.isArray(symbols) || symbols.length === 0) {
      console.log("Invalid symbols received.");
      return new Response(JSON.stringify({ error: 'Missing or invalid "symbols" array in request body' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const alpacaApiKey = Deno.env.get("ALPACA_API_KEY");
    const alpacaApiSecret = Deno.env.get("ALPACA_SECRET_KEY");

    if (!alpacaApiKey || !alpacaApiSecret) {
      console.error("Alpaca API keys are not set as environment variables.");
      return new Response(JSON.stringify({ error: 'Server configuration error: Alpaca API keys missing' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    console.log("Alpaca API keys found.");

    const alpaca = new Alpaca({
      keyId: alpacaApiKey,
      secretKey: alpacaApiSecret,
      paper: false, // Set to true if using paper trading account
      // The SDK handles the data URL (https://data.alpaca.markets) for market data requests
    });
    console.log("Alpaca client initialized.");

    const rawSnapshotsArray = await alpaca.getSnapshots(symbols);
    console.log("Raw snapshots fetched from Alpaca. Type:", typeof rawSnapshotsArray);
    // console.log("Raw snapshots value:", JSON.stringify(rawSnapshotsArray, null, 2));

    // Convert the array to a Map for easier lookup
    let snapshotsMap: Map<string, any>; // Define type for clarity, 'any' for snapshot structure
    if (Array.isArray(rawSnapshotsArray)) {
        snapshotsMap = new Map(rawSnapshotsArray.map(snapshot => [snapshot.symbol, snapshot]));
        console.log("Converted rawSnapshotsArray to Map. Keys:", Array.from(snapshotsMap.keys()));
    } else {
        // This case should ideally not happen based on new logs, but as a fallback:
        console.error("rawSnapshotsArray is not an array as expected. It is:", rawSnapshotsArray);
        // Attempt to use it as a Map if it somehow is one, otherwise create an empty map
        snapshotsMap = (rawSnapshotsArray instanceof Map) ? rawSnapshotsArray : new Map();
        if (!(rawSnapshotsArray instanceof Map)) {
             // If it's not an array AND not a map, all symbols will result in N/A (Internal Error)
             console.error("Cannot process snapshot data; it's neither an array nor a Map.");
        }
    }

    // Remove the previous debug logs for snapshotsMap type as we now handle conversion
    // console.log("Type of snapshotsMap:", typeof snapshotsMap);
    // console.log("snapshotsMap value:", JSON.stringify(snapshotsMap, null, 2));
    // if (snapshotsMap instanceof Map) {
    //     console.log("snapshotsMap is indeed a Map. Keys:", Array.from(snapshotsMap.keys()));
    // } else {
    //     console.log("snapshotsMap is NOT a Map. It is:", snapshotsMap);
    // }

    const results: { [key: string]: number | string } = {};

    for (const symbol of symbols) {
      if (!(snapshotsMap instanceof Map) || !snapshotsMap.has(symbol)) { // Check if map has the symbol
        console.warn(`No data found for symbol ${symbol} in snapshotsMap, or snapshotsMap is not a valid Map.`);
        results[symbol] = 'N/A (Data Missing)'; // More specific error
        continue;
      }
      const snapshot = snapshotsMap.get(symbol);
      console.log(`Processing symbol: ${symbol}, Snapshot object:`, JSON.stringify(snapshot, null, 2)); // DEBUG: Log individual snapshot object

      if (snapshot) {
        // Check for a direct percentage change field first (adjust if Alpaca provides one, e.g. snapshot.TodaysChangePerc)
        // Based on logs, 'todaysChangePerc' is not directly available at the root or with that exact casing.
        // We will rely on the calculation from latest trade and previous day's close.

        if (snapshot.LatestTrade && snapshot.PrevDailyBar &&
            typeof snapshot.LatestTrade.Price === 'number' &&
            typeof snapshot.PrevDailyBar.ClosePrice === 'number' &&
            snapshot.PrevDailyBar.ClosePrice !== 0) {
          const latestPrice = snapshot.LatestTrade.Price;
          const prevClose = snapshot.PrevDailyBar.ClosePrice;
          const percentChange = ((latestPrice / prevClose) - 1) * 100;
          results[symbol] = parseFloat(percentChange.toFixed(2));
        } else if (typeof snapshot.todaysChangePerc === 'number') { // Keep as a fallback if it ever appears
          results[symbol] = parseFloat((snapshot.todaysChangePerc * 100).toFixed(2));
        }
        else {
          console.warn(`Incomplete or invalid data for ${symbol}: snapshot.LatestTrade.Price=${snapshot.LatestTrade?.Price}, snapshot.PrevDailyBar.ClosePrice=${snapshot.PrevDailyBar?.ClosePrice}`);
          results[symbol] = 'N/A';
        }
      } else {
        console.warn(`No snapshot data found for symbol: ${symbol}`);
        results[symbol] = 'N/A';
      }
    }
    console.log("Calculated results:", results);

    return new Response(JSON.stringify({ data: results }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error("Error processing portfolio-tab-data request:", error);
    let errorMessage = 'Internal server error';
    let errorDetails = '';

    if (error instanceof Error) {
        errorMessage = error.message;
        errorDetails = error.stack || error.toString(); // Get stack if available

        // Attempt to get a more specific message from Alpaca SDK error structure
        // The Alpaca SDK might throw errors that have a 'response' property
        const anyError = error as any; // Use 'as any' carefully for specific known structures
        if (anyError.response && anyError.response.data && typeof anyError.response.data.message === 'string') {
            errorMessage = anyError.response.data.message;
        } else if (anyError.response && typeof anyError.response.body === 'string') { // Sometimes errors are in response.body
          try {
            const parsedBody = JSON.parse(anyError.response.body);
            if (parsedBody && typeof parsedBody.message === 'string') {
              errorMessage = parsedBody.message;
            }
          } catch (e) {
            // Ignore parsing error, stick to original message
          }
        } else if (error.message.toLowerCase().includes('forbidden')) {
            errorMessage = 'Alpaca API Error: Access forbidden. Check API key permissions and that your account is properly set up for data access.';
        }
    } else {
        errorDetails = String(error);
    }

    return new Response(JSON.stringify({ error: errorMessage, details: errorDetails }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}); 