import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
// Adjusted import path
import { NotificationType } from '../_shared/notifications.ts';

// Simplified Profile interface for this function's needs
interface Profile {
  user_id: string;
  news_categories: string[]; // e.g., ["technology", "finance"]
}

// Simplified NewsArticle interface
interface NewsArticle {
  id: string; // UUID or other unique ID from your news table
  title: string;
}

async function createSuggestionNotification(
  supabaseAdmin: SupabaseClient,
  userId: string,
  article: NewsArticle
) {
  const message = `Suggested Article: ${article.title}`;
  console.log(`Attempting to create notification for user ${userId}: ${message}`);

  const { data, error: notificationError } = await supabaseAdmin
    .from('notifications')
    .insert({
      user_id: userId,
      notification_type: NotificationType.SUGGESTED_NEWS,
      related_item_id: article.id,
      related_item_source: 'news', // As defined in your types/SQL
      message_preview: message,
      is_read: false,
    })
    .select(); // Optionally select to confirm insert

  if (notificationError) {
    console.error(`Error creating notification for user ${userId}, article ${article.id}:`, notificationError);
  } else {
    console.log(`Successfully created notification for user ${userId} for article: "${article.title}". Inserted:`, data);
  }
}

serve(async (_req: Request) => { // Added type for _req (Request from Deno's std/http, or any if not used)
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in environment variables.');
    }

    // Create a Supabase client with the SERVICE_ROLE_KEY to bypass RLS
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    console.log('Daily news suggestion job started...');

    // 1. Fetch all profiles that have news_categories defined
    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from('profiles')
      .select('user_id, news_categories')
      .not('news_categories', 'is', null); // Ensure news_categories is not null
      // You might also want to ensure news_categories is not an empty array: .filter('news_categories', 'cs', '{}') would check if it contains an empty array.
      // Or handle empty array in code.

    if (profilesError) {
      console.error('Error fetching profiles:', profilesError);
      return new Response(JSON.stringify({ error: `Error fetching profiles: ${profilesError.message}` }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!profiles || profiles.length === 0) {
      console.log('No profiles found with news categories preference.');
      return new Response(JSON.stringify({ message: 'No profiles to process.' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    console.log(`Found ${profiles.length} profiles to process.`);

    for (const profile of profiles as Profile[]) {
      if (!profile.news_categories || profile.news_categories.length === 0) {
        console.log(`Skipping user ${profile.user_id} due to empty or null news_categories.`);
        continue;
      }

      console.log(`Processing user ${profile.user_id} with categories: ${profile.news_categories.join(', ')}`);

      // 2. For each profile, find the most recent news article in their preferred categories
      const { data: latestArticle, error: articleError } = await supabaseAdmin
        .from('news') // Assuming your news table is named 'news'
        .select('id, title') // Select fields needed from the news table
        .overlaps('categories', profile.news_categories) // Use .overlaps for array column matching
        .order('created_at', { ascending: false }) // Corrected column name from 'published_at' to 'created_at' (assuming)
        .limit(1)
        .maybeSingle(); // Use maybeSingle to handle 0 or 1 result gracefully

      if (articleError) {
        console.error(`Error fetching news for user ${profile.user_id} with categories ${profile.news_categories.join(', ')}:`, articleError);
        continue; // Move to next profile
      }

      if (latestArticle) {
        console.log(`Found article "${latestArticle.title}" for user ${profile.user_id}.`);
        // Optional: Implement logic here to avoid sending the same notification repeatedly
        // For example, check if a notification for this user and this article_id (of type suggested_news) already exists and is recent.
        await createSuggestionNotification(supabaseAdmin, profile.user_id, latestArticle as NewsArticle);
      } else {
        console.log(`No recent news found for user ${profile.user_id} in categories: ${profile.news_categories.join(', ')}`);
      }
    }

    console.log('Daily news suggestion job completed successfully.');
    return new Response(JSON.stringify({ message: 'News suggestion job completed successfully.' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error: any) { // Added type for error
    console.error('Critical error in Edge Function:', error.message, error.stack);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
