import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import Alpaca from 'npm:@alpacahq/alpaca-trade-api@^3.1.3'; // Align with working function
import { corsHeaders } from '../_shared/cors.ts';

console.log('Stock Detail Edge Function initializing...');

const alpacaApiKeyId = Deno.env.get('ALPACA_API_KEY');
const alpacaSecretKey = Deno.env.get('ALPACA_SECRET_KEY');
const alphaVantageApiKey = Deno.env.get('ALPHA_VANTAGE_API_KEY');

console.log(`ALPACA_API_KEY loaded: ${alpacaApiKeyId ? 'Yes, ID: ' + alpacaApiKeyId.substring(0, 4) + '...' : 'No'}`);
console.log(`ALPACA_SECRET_KEY loaded: ${alpacaSecretKey ? 'Yes, Length: ' + alpacaSecretKey.length : 'No'}`);
console.log(`ALPHA_VANTAGE_API_KEY loaded: ${alphaVantageApiKey ? 'Yes' : 'No'}`);

const AV_BASE_URL = 'https://www.alphavantage.co/query';

const alpaca = new Alpaca({
  keyId: alpacaApiKeyId,
  secretKey: alpacaSecretKey,
  paper: false,
  // usePolygon: false // Alpaca defaults to SIP for Polygon data if key has access
});

// Helper to make Alpha Vantage API calls
async function fetchAlphaVantage(params: URLSearchParams) {
  if (!alphaVantageApiKey) {
    console.warn('Alpha Vantage API key is not set. Skipping AV call.');
    return null;
  }
  params.append('apikey', alphaVantageApiKey);
  const url = `${AV_BASE_URL}?${params.toString()}`;
  console.log(`Fetching from Alpha Vantage: ${url.replace(alphaVantageApiKey, 'REDACTED')}`);
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`Alpha Vantage API error: ${response.status} ${response.statusText}`, await response.text());
      return null;
    }
    const data = await response.json();
    if (data['Note'] || data['Information']) { // Check for rate limit messages or other info messages
      console.warn('Alpha Vantage API returned a note (possibly rate limit):', JSON.stringify(data));
      // Potentially treat as an error or partial success depending on the note
      if (Object.keys(data).length === 1) return null; // If only 'Note' or 'Information', it's likely a blocking error
    }
    if (data['Error Message']) {
      console.error('Alpha Vantage API error message:', data['Error Message']);
      return null;
    }
    return data;
  } catch (e) {
    console.error('Error fetching or parsing Alpha Vantage data:', JSON.stringify(e, Object.getOwnPropertyNames(e)));
    return null;
  }
}

// Helper to parse Alpha Vantage Time Series data
function parseAVTimeSeries(data: any, seriesKey: string, intervalName: string): { x: number; y: number }[] {
  const timeSeries = data?.[seriesKey];
  if (!timeSeries) {
    console.warn(`Time series key '${seriesKey}' not found in Alpha Vantage ${intervalName} data.`);
    return [];
  }
  const points: { x: number; y: number }[] = [];
  for (const dateStr in timeSeries) {
    const point = timeSeries[dateStr];
    // For intraday, the key is the datetime; for daily/weekly/monthly, it's the date
    // The close price is typically '4. close' or '4b. close (USD)' for crypto, adjust if needed for stocks
    const closePrice = parseFloat(point['4. close']);
    if (!isNaN(closePrice)) {
      points.push({ x: new Date(dateStr).getTime(), y: closePrice });
    }
  }
  // AV data is typically reverse chronological (newest first), so sort by date ascending for charts
  return points.sort((a, b) => a.x - b.x);
}

// Helper to get start date for Alpaca API (YYYY-MM-DD)
function getISODateString(date: Date): string {
  return date.toISOString().split('T')[0];
}

function calculatePercentageChange(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

// Helper to ensure data extends to current time (for all timeframes)
function ensureCurrentTimeDataPoint(points: Array<{x: number, y: number}>, currentPrice: number | null, maxAgeMs = 1000 * 60 * 60 * 12): Array<{x: number, y: number}> {
  if (points.length === 0 || currentPrice === null) return points;
  
  // Create a new array to avoid mutating the input
  const result = [...points];
  
  const lastPointTime = points[points.length - 1].x;
  const now = new Date().getTime();
  
  // If last point is older than maxAgeMs, add current price at current time
  if (now - lastPointTime > maxAgeMs) {
    result.push({ x: now, y: currentPrice });
  }
  
  return result;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { symbol } = await req.json();

    if (!symbol) {
      return new Response(JSON.stringify({ error: 'Symbol is required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    let currentPrice: number | null = null;
    let marketValue: number | null = null; // Likely null with free tier
    let peRatio: string | null = "N/A"; // Default P/E before fetching
    
    const percentageChanges: { [key: string]: number | null } = {
      '1D': null, '1W': null, '1M': null, '3M': null, 'YTD': null, '1Y': null, '2Y': null,
    };
    const chartData: { [key: string]: { x: number; y: number }[] } = {
      '1D': [], '1W': [], '1M': [], '3M': [], 'YTD': [], '1Y': [], '2Y': [],
    };
    let fiftyTwoWeekHigh: number | null = null;
    let fiftyTwoWeekLow: number | null = null;
    
    const now = new Date();

    // 1. Get Snapshot Data from Alpaca (Primary for real-time elements)
    try {
      const snapshot = await alpaca.getSnapshot(symbol);
      if (snapshot) {
        console.log(`Raw Snapshot data for ${symbol}:`, JSON.stringify(snapshot));
        
        currentPrice = snapshot.LatestTrade?.Price || snapshot.DailyBar?.ClosePrice || null;
        marketValue = snapshot.MarketCap || null; 
        
        // Calculate 1D change directly from available snapshot prices
        if (snapshot.LatestTrade?.Price && snapshot.PrevDailyBar?.ClosePrice && snapshot.PrevDailyBar.ClosePrice !== 0) {
          percentageChanges['1D'] = calculatePercentageChange(snapshot.LatestTrade.Price, snapshot.PrevDailyBar.ClosePrice);
        } else if (snapshot.DailyBar?.ClosePrice && snapshot.PrevDailyBar?.ClosePrice && snapshot.PrevDailyBar.ClosePrice !== 0) {
          percentageChanges['1D'] = calculatePercentageChange(snapshot.DailyBar.ClosePrice, snapshot.PrevDailyBar.ClosePrice);
        }
        // The previous check for snapshot.TodaysChangePerc (PascalCase) is removed to rely on the above calculation.

        console.log(`Processed Snapshot for ${symbol}: Price=${currentPrice}, MarketCap=${marketValue}, TodayChange%=${percentageChanges['1D']}`);
      }
    } catch (e) {
      console.error(`Error fetching snapshot for ${symbol}:`, JSON.stringify(e, Object.getOwnPropertyNames(e)));
      // If snapshot fails, we might not have a currentPrice for further calculations
    }

    // 1.b. Get Company Overview from Alpha Vantage (for fundamentals)
    let avOverviewData: any = null;
    try {
      const overviewParams = new URLSearchParams({ function: 'OVERVIEW', symbol: symbol });
      avOverviewData = await fetchAlphaVantage(overviewParams);

      if (avOverviewData) {
        console.log(`Raw AV Overview data for ${symbol}:`, JSON.stringify(avOverviewData).substring(0, 200) + '...');
        marketValue = parseFloat(avOverviewData.MarketCapitalization) || marketValue; // Use existing if AV fails
        peRatio = avOverviewData.PERatio !== "None" && avOverviewData.PERatio !== "0" && avOverviewData.PERatio ? avOverviewData.PERatio : peRatio;
        fiftyTwoWeekHigh = parseFloat(avOverviewData['52WeekHigh']) || fiftyTwoWeekHigh;
        fiftyTwoWeekLow = parseFloat(avOverviewData['52WeekLow']) || fiftyTwoWeekLow;
        
        // If currentPrice is still null, try to get it from overview (though not directly available)
        // For now, we'll rely on Alpaca snapshot or later time series for currentPrice.
        console.log(`Processed AV Overview for ${symbol}: MarketCap=${marketValue}, PERatio=${peRatio}, 52W_H=${fiftyTwoWeekHigh}, 52W_L=${fiftyTwoWeekLow}`);
      }
    } catch (e) {
      console.error(`Error processing Alpha Vantage Overview for ${symbol}:`, JSON.stringify(e, Object.getOwnPropertyNames(e)));
    }

    // Fallback for currentPrice if Alpaca snapshot failed
    if (currentPrice === null && avOverviewData?.PERatio !== "None" && avOverviewData?.MarketCapitalization !== "0") {
      // Attempt to get latest price from GLOBAL_QUOTE if snapshot failed.
      // This adds another API call, use judiciously or combine with other calls if possible.
      console.log(`Alpaca snapshot failed for currentPrice, trying AV GLOBAL_QUOTE for ${symbol}`);
      try {
        const quoteParams = new URLSearchParams({ function: 'GLOBAL_QUOTE', symbol: symbol });
        const avQuoteData = await fetchAlphaVantage(quoteParams);
        if (avQuoteData && avQuoteData['Global Quote'] && avQuoteData['Global Quote']['05. price']) {
          currentPrice = parseFloat(avQuoteData['Global Quote']['05. price']);
          console.log(`Fallback currentPrice from AV GLOBAL_QUOTE for ${symbol}: ${currentPrice}`);
          // If we got current price here, and 1D% is still null, try to get prev close for 1D calc
          if (percentageChanges['1D'] === null && avQuoteData['Global Quote']['08. previous close']){
            const prevClose = parseFloat(avQuoteData['Global Quote']['08. previous close']);
            if (currentPrice && prevClose) {
                 percentageChanges['1D'] = calculatePercentageChange(currentPrice, prevClose);
                 console.log(`Fallback 1D change from AV GLOBAL_QUOTE for ${symbol}: ${percentageChanges['1D']}`);
            }
          }
        }
      } catch (e) {
        console.warn(`Failed to fetch or parse AV GLOBAL_QUOTE for ${symbol} as currentPrice fallback.`);
      }
    }

    const handleErrorForBars = (e: any, period: string, source: 'Alpaca' | 'AlphaVantage' = 'Alpaca') => {
      const errorMessage = (e as Error).message || JSON.stringify(e, Object.getOwnPropertyNames(e));
      if (typeof errorMessage === 'string' && errorMessage.includes("subscription does not permit")) {
        console.warn(`Warning: Bar data for ${period} for ${symbol} is unavailable due to data subscription limits. ${errorMessage}`);
      } else {
        console.error(`Error fetching ${period} bars for ${symbol}:`, errorMessage);
      }
      chartData[period as keyof typeof chartData] = []; // Ensure it's an empty array on error
      percentageChanges[period as keyof typeof percentageChanges] = null; // Ensure no stale calc
    };

    // 2. Alpha Vantage: Intraday Time Series for 1D Chart (e.g., 60min)
    let avIntradayDataFor1D: any = null; // Store data from TIME_SERIES_INTRADAY for 1D, potentially for 1W too
    try {
      const intradayParams = new URLSearchParams({
        function: 'TIME_SERIES_INTRADAY',
        symbol: symbol,
        interval: '60min',
        outputsize: 'full', // Changed from 'compact' to 'full' for more data points
      });
      avIntradayDataFor1D = await fetchAlphaVantage(intradayParams);
      if (avIntradayDataFor1D) {
        // Key is like "Time Series (60min)"
        const seriesKey = Object.keys(avIntradayDataFor1D).find(k => k.startsWith('Time Series'));
        if (seriesKey) {
            chartData['1D'] = parseAVTimeSeries(avIntradayDataFor1D, seriesKey, 'Intraday 60min').slice(-48); 
            
            // Add current timestamp with most recent price if not already included
            if (chartData['1D'].length > 0 && currentPrice !== null) {
                const lastPointTime = chartData['1D'][chartData['1D'].length - 1].x;
                const now = new Date().getTime();
                // If the last data point is not recent, add current price as a point at "now"
                if (now - lastPointTime > 1000 * 60 * 60) { // If more than 1 hour old
                    chartData['1D'].push({ 
                        x: now, 
                        y: currentPrice 
                    });
                }
            }
            
            console.log(`Processed AV Intraday (60min) for 1D chart for ${symbol}: ${chartData['1D'].length} points.`);
            if (currentPrice === null && chartData['1D'].length > 0) {
                 currentPrice = chartData['1D'][chartData['1D'].length - 1].y;
                 console.log(`Current price updated from AV Intraday data for ${symbol}: ${currentPrice}`);
            }
            // 1D percentage can be calculated if not already set from Alpaca/GlobalQuote
            if (percentageChanges['1D'] === null && chartData['1D'].length > 1 && currentPrice !== null) {
                // Find a point roughly 24h ago or the earliest point if less than 24h of data
                // This is a rough approximation for 1D change from intraday series
                const prevDayPoint = chartData['1D'].length > 23 ? chartData['1D'][0] : null; // if we have 24 points, the first is 24h ago
                if (prevDayPoint) {
                    percentageChanges['1D'] = calculatePercentageChange(currentPrice, prevDayPoint.y);
                } else if (chartData['1D'].length > 0) {
                    // Fallback: if less than 24 points, use the earliest point from the compact series
                    // This might not be a true 24h change but change over available compact data
                    percentageChanges['1D'] = calculatePercentageChange(currentPrice, chartData['1D'][0].y);
                }
                if (percentageChanges['1D'] !== null) console.log(`1D Change from AV Intraday for ${symbol}: ${percentageChanges['1D']}`);
            }
        } else {
             console.warn('No time series key found in AV Intraday data for 1D chart for '+symbol);
        }
      }
    } catch (e) {
      handleErrorForBars(e, '1D', 'AlphaVantage');
    }

    // 3. Alpha Vantage: Data for 1W, 1M, 3M, YTD, 1Y charts and changes
    try {
      // Attempt 1 for 1W: Use high-resolution intraday data from the 1D call if available
      if (avIntradayDataFor1D && chartData['1W'].length === 0) {
        const seriesKey = Object.keys(avIntradayDataFor1D).find(k => k.startsWith('Time Series (60min)'));
        if (seriesKey) {
          const allIntradayPoints = parseAVTimeSeries(avIntradayDataFor1D, seriesKey, 'Intraday 60min for 1W');
          const nowMs = new Date().getTime();
          const oneWeekAgoMs = nowMs - (7 * 24 * 60 * 60 * 1000);
          const weekIntradayPoints = allIntradayPoints.filter(p => p.x >= oneWeekAgoMs);

          if (weekIntradayPoints.length >= 30) { 
            chartData['1W'] = ensureCurrentTimeDataPoint(weekIntradayPoints, currentPrice);
            console.log(`Using Intraday (from 1D call) for 1W chart: ${chartData['1W'].length} points`);
            if (currentPrice !== null && weekIntradayPoints.length > 0 && weekIntradayPoints[0].y) {
              percentageChanges['1W'] = calculatePercentageChange(currentPrice, weekIntradayPoints[0].y);
            }
          } else {
            console.log(`Intraday (from 1D call) insufficient for 1W (${weekIntradayPoints.length} points), will try other sources.`);
          }
        }
      }
      
      // Attempt 1 for 1M: Use high-resolution intraday data from the 1D call if available
      if (avIntradayDataFor1D && chartData['1M'].length === 0) {
        const seriesKey = Object.keys(avIntradayDataFor1D).find(k => k.startsWith('Time Series (60min)'));
        if (seriesKey) {
          const allIntradayPoints = parseAVTimeSeries(avIntradayDataFor1D, seriesKey, 'Intraday 60min for 1M');
          const nowMs = new Date().getTime();
          const oneMonthAgoMs = nowMs - (30 * 24 * 60 * 60 * 1000); 
          const monthIntradayPoints = allIntradayPoints.filter(p => p.x >= oneMonthAgoMs);

          // Check if we have a reasonable number of points for a month (e.g., >= 100 for 60min interval)
          if (monthIntradayPoints.length >= 100) { 
            chartData['1M'] = ensureCurrentTimeDataPoint(monthIntradayPoints, currentPrice);
            console.log(`Using Intraday (from 1D call) for 1M chart: ${chartData['1M'].length} points`);
            if (currentPrice !== null && monthIntradayPoints.length > 0 && monthIntradayPoints[0].y) {
              percentageChanges['1M'] = calculatePercentageChange(currentPrice, monthIntradayPoints[0].y);
            }
          } else {
            console.log(`Intraday (from 1D call) insufficient for 1M (${monthIntradayPoints.length} points), will try other sources.`);
          }
        }
      }

      // Attempt 2 for 1W, 1M, 3M: Use TIME_SERIES_INTRADAY_EXTENDED (CSV)
      if (chartData['1W'].length === 0 || chartData['1M'].length === 0 || chartData['3M'].length === 0) {
        try {
          const intradayExtendedParams = new URLSearchParams({
            function: 'TIME_SERIES_INTRADAY_EXTENDED',
            symbol: symbol,
            interval: '60min',
            slice: 'year1month1', // Most recent month of data
          });
          const avIntradayExtData = await fetchAlphaVantage(intradayExtendedParams);

          if (avIntradayExtData && typeof avIntradayExtData === 'string') {
            // Extended intraday comes as CSV format, not JSON
            console.log('Processing intraday extended CSV data for more detailed 1W/1M');
            const rows = avIntradayExtData.trim().split('\n');
            
            if (rows.length > 1) { // First row is header
              const header = rows[0].split(',');
              const timeIndex = header.indexOf('time');
              const closeIndex = header.indexOf('close');
              
              if (timeIndex >= 0 && closeIndex >= 0) {
                const nowMs = new Date().getTime(); // Renamed to avoid conflict with global `now`
                const oneWeekAgoMs = nowMs - (7 * 24 * 60 * 60 * 1000);
                const oneMonthAgoMs = nowMs - (30 * 24 * 60 * 60 * 1000);
                const threeMonthsAgoMs = nowMs - (90 * 24 * 60 * 60 * 1000); 
                
                const detailedPoints: { x: number; y: number }[] = [];
                
                // Process rows (skip header)
                for (let i = 1; i < rows.length; i++) {
                  const cols = rows[i].split(',');
                  if (cols.length > Math.max(timeIndex, closeIndex)) {
                    const timestamp = new Date(cols[timeIndex]).getTime();
                    const price = parseFloat(cols[closeIndex]);
                    
                    if (!isNaN(timestamp) && !isNaN(price)) {
                      detailedPoints.push({ x: timestamp, y: price });
                    }
                  }
                }
                
                // Sort ascending by time
                detailedPoints.sort((a, b) => a.x - b.x);
                
                if (detailedPoints.length > 0) {
                  // Populate 1W from CSV if still empty
                  if (chartData['1W'].length === 0) {
                    const weekPointsCSV = detailedPoints.filter(p => p.x >= oneWeekAgoMs);
                    if (weekPointsCSV.length > 0) {
                      chartData['1W'] = ensureCurrentTimeDataPoint(weekPointsCSV, currentPrice);
                      console.log(`Using high-resolution INTRADAY_EXTENDED for 1W chart: ${chartData['1W'].length} points`);
                      if (currentPrice !== null && weekPointsCSV.length > 0 && weekPointsCSV[0].y) {
                        percentageChanges['1W'] = calculatePercentageChange(currentPrice, weekPointsCSV[0].y);
                      }
                    }
                  }
                  
                  // Populate 1M from CSV if still empty
                  if (chartData['1M'].length === 0) {
                    const monthPointsCSV = detailedPoints.filter(p => p.x >= oneMonthAgoMs);
                    if (monthPointsCSV.length > 0) {
                      chartData['1M'] = ensureCurrentTimeDataPoint(monthPointsCSV, currentPrice);
                      console.log(`Using high-resolution INTRADAY_EXTENDED for 1M chart: ${chartData['1M'].length} points`);
                      if (currentPrice !== null && monthPointsCSV.length > 0 && monthPointsCSV[0].y) {
                        percentageChanges['1M'] = calculatePercentageChange(currentPrice, monthPointsCSV[0].y);
                      }
                    }
                  }

                  // Populate 3M from CSV if still empty
                  if (chartData['3M'].length === 0) {
                    const threeMonthPointsCSV = detailedPoints.filter(p => p.x >= threeMonthsAgoMs);
                    if (threeMonthPointsCSV.length > 0) {
                      chartData['3M'] = ensureCurrentTimeDataPoint(threeMonthPointsCSV, currentPrice);
                      console.log(`Using high-resolution INTRADAY_EXTENDED for 3M chart: ${chartData['3M'].length} points`);
                      if (currentPrice !== null && threeMonthPointsCSV.length > 0 && threeMonthPointsCSV[0].y) {
                        percentageChanges['3M'] = calculatePercentageChange(currentPrice, threeMonthPointsCSV[0].y);
                      }
                    }
                  }
                }
              }
            }
          }
        } catch (e) {
          console.warn(`Failed to fetch/parse INTRADAY_EXTENDED CSV data: ${(e as Error).message}`);
        }
      }

      // Fallback: Use daily data for timeframes if they are still empty
      if (chartData['1W'].length === 0 || chartData['1M'].length === 0 || chartData['3M'].length === 0 ||
          chartData['YTD'].length === 0 || chartData['1Y'].length === 0) {
        const dailyParams = new URLSearchParams({
          function: 'TIME_SERIES_DAILY',
          symbol: symbol,
          outputsize: 'full', // Full series for longer calculations
        });
        const avDailyData = await fetchAlphaVantage(dailyParams);
        if (avDailyData) {
          const seriesKey = Object.keys(avDailyData).find(k => k.startsWith('Time Series (Daily)'));
          if (seriesKey) {
            const dailyPoints = parseAVTimeSeries(avDailyData, seriesKey, 'Daily');
            console.log(`Processed AV Daily for ${symbol}: ${dailyPoints.length} points.`);

            if (dailyPoints.length > 0) {
              if (currentPrice === null) {
                currentPrice = dailyPoints[dailyPoints.length - 1].y;
                console.log(`Current price updated from AV Daily data for ${symbol}: ${currentPrice}`);
              }

              // 1W Chart & Change (daily fallback)
              if (chartData['1W'].length === 0) {
                const last7CalendarDaysApprox = dailyPoints.slice(-7);
                chartData['1W'] = ensureCurrentTimeDataPoint(last7CalendarDaysApprox, currentPrice);
                if (currentPrice && last7CalendarDaysApprox.length > 0 && last7CalendarDaysApprox[0].y) {
                  percentageChanges['1W'] = calculatePercentageChange(currentPrice, last7CalendarDaysApprox[0].y);
                }
              }

              // 1M Chart & Change (daily fallback)
              if (chartData['1M'].length === 0) {
                const last30CalendarDaysApprox = dailyPoints.slice(-22);
                chartData['1M'] = ensureCurrentTimeDataPoint(last30CalendarDaysApprox, currentPrice);
                if (currentPrice && last30CalendarDaysApprox.length > 0 && last30CalendarDaysApprox[0].y) {
                  percentageChanges['1M'] = calculatePercentageChange(currentPrice, last30CalendarDaysApprox[0].y);
                }
              }

              // 3M Chart & Change (daily fallback)
              if (chartData['3M'].length === 0) { 
                const last90CalendarDaysApprox = dailyPoints.slice(-66);
                chartData['3M'] = ensureCurrentTimeDataPoint(last90CalendarDaysApprox, currentPrice);
                if (currentPrice && last90CalendarDaysApprox.length > 0 && last90CalendarDaysApprox[0].y) {
                  percentageChanges['3M'] = calculatePercentageChange(currentPrice, last90CalendarDaysApprox[0].y);
                }
              }

              // YTD Chart & Change (daily fallback - this is its primary source)
              if (chartData['YTD'].length === 0) {
                const startOfYear = new Date(now.getFullYear(), 0, 1).getTime();
                const ytdPoints = dailyPoints.filter(p => p.x >= startOfYear);
                chartData['YTD'] = ensureCurrentTimeDataPoint(ytdPoints, currentPrice);
                if (currentPrice && ytdPoints.length > 0 && ytdPoints[0].y) {
                  percentageChanges['YTD'] = calculatePercentageChange(currentPrice, ytdPoints[0].y);
                }
              }

              // 1Y Chart & Change (daily fallback - this is its primary source)
              if (chartData['1Y'].length === 0) {
                const oneYearAgoTime = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()).getTime();
                const lastYearPoints = dailyPoints.filter(p => p.x >= oneYearAgoTime);
                chartData['1Y'] = ensureCurrentTimeDataPoint(lastYearPoints, currentPrice);
                if (currentPrice && lastYearPoints.length > 0 && lastYearPoints[0].y) {
                  percentageChanges['1Y'] = calculatePercentageChange(currentPrice, lastYearPoints[0].y);
                }
              }
            } else {
               console.warn('No points parsed from AV Daily data for '+symbol);
            }
          } else {
             console.warn('No time series key found in AV Daily data for '+symbol);
          }
        }
      }
    } catch (e) {
      handleErrorForBars(e, 'Multi-Period', 'AlphaVantage'); 
    }
    
    // 4. Alpha Vantage: Weekly Adjusted Time Series for 2Y charts and changes
    try {
      const weeklyParams = new URLSearchParams({
        function: 'TIME_SERIES_WEEKLY_ADJUSTED',
        symbol: symbol,
        outputsize: 'full',
      });
      const avWeeklyData = await fetchAlphaVantage(weeklyParams);
      if (avWeeklyData) {
        const seriesKey = Object.keys(avWeeklyData).find(k => k.startsWith('Weekly Adjusted Time Series'));
        if (seriesKey) {
          const weeklyPoints = parseAVTimeSeries(avWeeklyData, seriesKey, 'Weekly Adjusted');
          console.log(`Processed AV Weekly Adjusted for ${symbol}: ${weeklyPoints.length} points.`);

          if (weeklyPoints.length > 0) {
            if (currentPrice === null) {
              currentPrice = weeklyPoints[weeklyPoints.length - 1].y;
              console.log(`Current price updated from AV Weekly Adjusted data for ${symbol}: ${currentPrice}`);
            }
            
            // 2Y Chart & Change
            const twoYearsAgoTime = new Date(now.getFullYear() - 2, now.getMonth(), now.getDate()).getTime();
            const last2YearsPoints = weeklyPoints.filter(p => p.x >= twoYearsAgoTime);
            chartData['2Y'] = ensureCurrentTimeDataPoint(last2YearsPoints, currentPrice, 1000 * 60 * 60 * 24 * 3);
            if (currentPrice && last2YearsPoints.length > 0 && last2YearsPoints[0].y) {
              percentageChanges['2Y'] = calculatePercentageChange(currentPrice, last2YearsPoints[0].y);
            }
          } else {
            console.warn('No points parsed from AV Weekly Adjusted data for '+symbol);
          }
        } else {
            console.warn('No time series key found in AV Weekly Adjusted data for '+symbol);
        }
      }
    } catch (e) {
      handleErrorForBars(e, '5Y', 'AlphaVantage'); // Grouping weekly based chart errors
    }

    const result = {
      symbol,
      currentPrice,
      percentageChanges,
      chartData,
      fiftyTwoWeekHigh,
      fiftyTwoWeekLow,
      marketValue,
      peRatio,
    };
    
    console.log(`Final data for ${symbol} before sending response.`);

    return new Response(JSON.stringify({ data: result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error('General error in stock-detail function:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
    return new Response(JSON.stringify({ error: (error as Error).message || 'Internal Server Error' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});

console.log('Stock Detail Edge Function is ready to serve requests.'); 