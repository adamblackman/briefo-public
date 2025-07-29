import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

console.log("--- Perplexity Chat Edge Function initializing ---");

// Environment Variables
const PERPLEXITY_API_KEY = Deno.env.get("PERPLEXITY_API_KEY");
const SUPABASE_URL = Deno.env.get("MY_SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("MY_SUPABASE_SERVICE_ROLE_KEY");

console.log(`PERPLEXITY_API_KEY loaded: ${!!PERPLEXITY_API_KEY}`);
console.log(`MY_SUPABASE_URL loaded: ${!!SUPABASE_URL}`);
console.log(`MY_SUPABASE_SERVICE_ROLE_KEY loaded: ${!!SUPABASE_SERVICE_ROLE_KEY}`);

// Use the sonar model for responses
const PERPLEXITY_MODEL = "sonar";

// Helper: Call Perplexity API
async function callPerplexityAPI(
  messages: Array<{role: string, content: string}>, 
  systemPrompt?: string,
  stream = false
) {
  if (!PERPLEXITY_API_KEY) {
    console.error("PERPLEXITY_API_KEY is not set");
    throw new Error("PERPLEXITY_API_KEY is not set in environment variables");
  }

  // Add system prompt if provided
  const messagePayload = systemPrompt 
    ? [{role: "system", content: systemPrompt}, ...messages]
    : messages;

  const body = {
    model: PERPLEXITY_MODEL,
    messages: messagePayload,
    temperature: 1.1, // Lower temperature for more consistent outputs
    stream: stream,   // Enable streaming mode when requested
    web_search_options: {
      search_context_size: "medium"
    }
  };
  
  console.log(`Calling Perplexity API with model: ${PERPLEXITY_MODEL}, stream: ${stream}`);
  // console.log("Messages payload:", JSON.stringify(body.messages, null, 2));

  try {
    console.log("Making request to Perplexity API");
    const response = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${PERPLEXITY_API_KEY}`,
      },
      body: JSON.stringify(body),
    });

    console.log(`Perplexity API response status: ${response.status}`);
    
    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`Perplexity API Error: ${response.status} ${response.statusText}`, errorBody);
      throw new Error(`Perplexity API request failed: ${response.status} ${errorBody}`);
    }

    console.log("Perplexity API request successful");
    
    if (stream) {
      return { stream: response.body };
    } else {
      const data = await response.json();
      console.log("Successfully received response from Perplexity API");
      const content = data.choices[0]?.message?.content;
      if (!content) {
        console.error("No content in Perplexity API response");
        throw new Error("No content in Perplexity API response");
      }
      return { content, data };
    }
  } catch (error) {
    console.error("Error in Perplexity API call:", error);
    throw error;
  }
}

serve(async (req: Request) => {
  // Handle CORS preflight request
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Check environment variables
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !PERPLEXITY_API_KEY) {
    console.error("Missing critical environment variables");
    return new Response(
      JSON.stringify({ error: "Server configuration error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  try {
    console.log("Received request to perplexity-chat function");
    const reqBody = await req.json();
    const { user_id, message_id, stream = true } = reqBody;
    
    console.log(`Request params: user_id=${user_id}, message_id=${message_id}, stream=${stream}`);

    if (!user_id || !message_id) {
      console.error("Missing required parameters: user_id or message_id");
      return new Response(
        JSON.stringify({ error: "user_id and message_id are required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Initialize Supabase client with service_role key
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      }
    });

    // 1. Fetch the current triggering message details
    const { data: messageData, error: messageError } = await supabaseAdmin
      .from('ai_messages')
      .select('*')
      .eq('id', message_id)
      .single();

    if (messageError || !messageData) {
      console.error("Error fetching triggering message:", messageError);
      return new Response(
        JSON.stringify({ error: "Could not fetch the triggering message" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    // Ensure the triggering message is from the user, as expected by this flow
    if (messageData.sender !== 'user') {
        console.error("Triggering message is not from 'user'. Actual sender:", messageData.sender);
        return new Response(JSON.stringify({ error: "Invalid triggering message: not from user" }), {
            status: 400, // Bad Request
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    // Fetch user profile to get preferences for system prompt (remains the same)
    const { data: profileData, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('news_categories, favorite_companies')
      .eq('user_id', user_id)
      .single();

    if (profileError) {
      console.error("Error fetching user profile:", profileError);
      return new Response(
        JSON.stringify({ error: "Could not fetch user profile" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Prepare arrays for system prompt
    const newsCategories = profileData.news_categories || [];
    const favoriteCompanies = profileData.favorite_companies || [];

    // 2. Fetch recent conversation history (excluding the current message)
    const { data: historyMessagesRaw, error: historyError } = await supabaseAdmin
      .from('ai_messages')
      .select('*')
      .eq('user_id', user_id)
      .neq('id', message_id) // Exclude the current message from history
      .order('created_at', { ascending: false }) // Newest first for processing convenience
      .limit(10); // Fetch a reasonable number of history items

    if (historyError) {
      console.error("Error fetching conversation history:", historyError);
      return new Response(
        JSON.stringify({ error: "Could not fetch conversation history" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    const historyMessages = historyMessagesRaw || [];

    // 3. Initialize apiMessages with the current user's message
    const apiMessages: Array<{role: string, content: string}> = [
      { role: 'user', content: messageData.content }
    ];
    let lastRoleAdded = 'user';

    // 4. Prepend history messages, ensuring alternating roles
    for (const histMsg of historyMessages) {
      const histRole = histMsg.sender === 'user' ? 'user' : 'assistant';
      if (histRole !== lastRoleAdded) {
        // Prepend to keep the order [oldest, ..., newest_user_msg]
        apiMessages.unshift({ role: histRole, content: histMsg.content });
        lastRoleAdded = histRole;
      }
      // Optional: Limit total messages in apiMessages here if needed
      // if (apiMessages.length >= 10) break; // Example limit
    }

    // 5. Ensure the *very first* message in the sequence (oldest) is 'user'.
    if (apiMessages.length > 0 && apiMessages[0].role === 'assistant') {
      console.log("Oldest message in history was assistant, removing it to ensure sequence starts with user.");
      apiMessages.shift(); 
    }

    // 6. If apiMessages became empty (e.g., history was only [A]), re-ensure current user msg is there.
    if (apiMessages.length === 0) {
        console.log("apiMessages became empty after adjustment, re-adding current user message.");
        apiMessages.push({ role: 'user', content: messageData.content });
    }
    
    // At this point, apiMessages should be [U, A, U, ..., U_current]
    // It must not be empty and must end with user. The construction ensures it ends with user (messageData).
    // It must start with user for the Perplexity API call.
    if (apiMessages.length === 0 || apiMessages[0].role !== 'user' || apiMessages[apiMessages.length - 1].role !== 'user') {
        console.error("Critical error: Final apiMessages structure is invalid before calling Perplexity.", JSON.stringify(apiMessages));
        return new Response(JSON.stringify({ error: "Internal server error: Could not construct valid message payload for AI." }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    // Debug log
    // console.log(`Message roles sequence for Perplexity API (to be prepended with system): ${apiMessages.map(m => m.role).join(', ')}`);
    // console.log("Full messages for Perplexity API:", JSON.stringify(apiMessages, null, 2));

    // Build system prompt with user preferences
    const systemPrompt = `You are a helpful AI assistant named Perplexity. Respond in a concise, informative, and personable style without any bracketed citations or external reference markers.\n\nUser Preferences:\n– Favorite news categories: ${JSON.stringify(newsCategories)}\n– Favorite companies: ${JSON.stringify(favoriteCompanies)}\n\nBehavioral Rules:\n1. General: Align news-related replies with preferred categories. Focus stock insights on favorite companies.\n2. News Title Context: If the user's message includes a full news headline, treat that headline as the primary context. Frame your answer around that specific news.\n3. Stock Ticker Context: If the user mentions a ticker symbol prefixed with "@" (e.g. "@AAPL"), treat that company as the primary context. Center your response on that company.\n4. "Recent News:" Trigger: If the user input begins with "Recent News: <Company>", fetch and summarize only the most recent and relevant articles for that company.\n5. "Financial Analysis:" Trigger: If the user input begins with "Financial Analysis: <Company>", perform step-by-step reasoning. Include valuation metrics, earnings projections, dividend yield, and current market data.\nEnsure you never add extra sections, never mention policy or system internals, and always abide by these instructions.\nIMPORTANT: Absolutely do not include any citation markers like [1], [2], [3], etc., anywhere in your response. Do not reference external sources using bracketed numbers.`;
    
    if (stream) {
      // --- Streaming Mode ---
      const { stream: responseStream } = await callPerplexityAPI(apiMessages, systemPrompt, true);
      
      if (!responseStream) {
        return new Response(
          JSON.stringify({ error: "Failed to get streaming response" }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      
      // Create a new message in the database first
      const { data: newMessage, error: createError } = await supabaseAdmin
        .from('ai_messages')
        .insert({
          user_id,
          sender: 'perplexity',
          content: '', // Empty content, will be updated as chunks arrive
          message_type: 'text',
          created_at: new Date().toISOString(),
          is_streaming: true // Flag to indicate this message is being streamed
        })
        .select('id')
        .single();

      if (createError) {
        console.error("Error creating message for streaming:", createError);
        return new Response(
          JSON.stringify({ error: "Could not create message for streaming" }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const messageId = newMessage.id;
      
      // Set up a stream transformer to process chunks and update the database
      const transformer = new TransformStream({
        async start(controller) {
          controller.enqueue(JSON.stringify({ 
            message_id: messageId,
            type: 'start',
            content: ''
          }) + '\n');
        },
        async transform(chunk, controller) {
          try {
            const text = new TextDecoder().decode(chunk);
            // For streams, need to parse each line as a separate JSON object
            const lines = text.split('\n').filter(line => line.trim() !== '');
            
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const dataContent = line.substring(6); // Remove 'data: ' prefix
                
                if (dataContent === '[DONE]') {
                  // End of stream
                  controller.enqueue(JSON.stringify({
                    message_id: messageId,
                    type: 'done',
                    content: ''
                  }) + '\n');
                  continue;
                }
                
                try {
                  const data = JSON.parse(dataContent);
                  if (data.choices && data.choices[0]?.delta?.content) {
                    const content = data.choices[0].delta.content;
                    
                    // Send the cleaned chunk to the client
                    controller.enqueue(JSON.stringify({
                      message_id: messageId,
                      type: 'chunk',
                      content: content
                    }) + '\n');
                  }
                } catch (e) {
                  console.error("Error parsing JSON from chunk:", e);
                }
              }
            }
          } catch (e) {
            console.error("Error processing stream chunk:", e);
          }
        },
        async flush(controller) {
          controller.enqueue(JSON.stringify({
            message_id: messageId,
            type: 'done',
            content: '' 
          }) + '\n');
        }
      });

      // Read and transform the stream, storing accumulated text
      let fullText = '';
      
      const processedStream = responseStream.pipeThrough(
        new TransformStream({
          transform(chunk, controller) {
            try {
              const text = new TextDecoder().decode(chunk);
              const lines = text.split('\n').filter(line => line.trim() !== '');
              
              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  const dataContent = line.substring(6);
                  
                  if (dataContent === '[DONE]') {
                    controller.enqueue(new TextEncoder().encode(line + '\n'));
                    continue;
                  }
                  
                  try {
                    const data = JSON.parse(dataContent);
                    if (data.choices && data.choices[0]?.delta?.content) {
                      const content = data.choices[0].delta.content;
                      fullText += content;
                    }
                    controller.enqueue(new TextEncoder().encode(line + '\n'));
                  } catch (e) {
                    console.error("Error in accumulating text:", e);
                    controller.enqueue(new TextEncoder().encode(line + '\n'));
                  }
                } else {
                  controller.enqueue(new TextEncoder().encode(line + '\n'));
                }
              }
            } catch (e) {
              console.error("Error in stream processing:", e);
              controller.error(e);
            }
          },
          async flush(controller) {
            // After streaming is done, update the database with the complete text
            try {
              await supabaseAdmin
                .from('ai_messages')
                .update({
                  content: fullText,
                  is_streaming: false
                })
                .eq('id', messageId);
            } catch (e) {
              console.error("Error updating final message content:", e);
            }
          }
        })
      ).pipeThrough(transformer);

      return new Response(processedStream, {
        headers: {
          ...corsHeaders,
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive"
        }
      });
    } else {
      // --- Non-Streaming Mode (original behavior) ---
      const { content: rawContent } = await callPerplexityAPI(apiMessages, systemPrompt, false);

      // Remove citations before saving/returning (if this is still desired, though prompt should handle it)
      // ... existing code ...

      // Insert AI response back into the database
      const { data: insertData, error: insertError } = await supabaseAdmin
        .from('ai_messages')
        .insert({
          user_id,
          sender: 'perplexity',
          content: rawContent,
          message_type: 'text',
          created_at: new Date().toISOString()
        })
        .select('id')
        .single();

      if (insertError) {
        console.error("Error inserting AI response:", insertError);
        return new Response(
          JSON.stringify({ error: "Could not save AI response" }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Log success message
      console.log("Successfully inserted response");

      return new Response(
        JSON.stringify({ 
          success: true, 
          response: rawContent, 
          message_id: insertData.id  // Include the message ID in the response
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
  } catch (error) {
    console.error("Error in perplexity-chat function:", error);
    // Ensure proper error message extraction from unknown type
    const errorMessage = error instanceof Error 
      ? error.message 
      : "Internal server error";
      
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
}); 