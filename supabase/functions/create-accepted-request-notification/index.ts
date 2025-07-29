import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { NotificationType } from '../_shared/notifications.ts';

interface RequestBody {
  originalSenderAuthId: string; // auth.users.id of the user who INITIALLY SENT the request
  accepterProfileId: string;    // profiles.id of the user who ACCEPTED the request
  accepterAuthId: string;       // auth.users.id of the user who ACCEPTED the request (for navigation)
  friendshipId: string;         // The ID of the friendship record
}

serve(async (req: Request) => {
  const body = await req.json();
  const { originalSenderAuthId, accepterProfileId, accepterAuthId, friendshipId } = body as RequestBody;

  if (!originalSenderAuthId || !accepterProfileId || !accepterAuthId || !friendshipId) {
    return new Response(JSON.stringify({
      error: 'Missing required parameters: originalSenderAuthId, accepterProfileId, accepterAuthId, friendshipId'
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // Use the environment variable names you confirmed previously
    const supabaseUrl = Deno.env.get('MY_SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('MY_SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Supabase URL or Service Role Key is not set.');
    }

    const supabaseAdmin: SupabaseClient = createClient(supabaseUrl, serviceRoleKey);

    // Fetch accepter's name to make the notification message more descriptive
    let accepterName = 'Someone';
    const { data: accepterProfile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('name, username')
      .eq('id', accepterProfileId) // Accepter's profile ID
      .single();

    if (profileError) {
      console.warn(`Could not fetch accepter's name for notification:`, profileError.message);
    } else if (accepterProfile) {
      accepterName = accepterProfile.name || accepterProfile.username || 'Someone';
    }

    const messagePreview = `${accepterName} accepted your friend request.`;

    const { data, error: notificationError } = await supabaseAdmin
      .from('notifications')
      .insert({
        user_id: originalSenderAuthId, // The user receiving the notification is the one who sent the original request
        notification_type: NotificationType.ACCEPTED_REQUEST,
        related_item_id: accepterAuthId, // Link to the accepter's user profile for navigation
        related_item_source: 'users', // To navigate to a user profile
        message_preview: messagePreview,
        is_read: false,
        // friendship_id: friendshipId, // Optional: if you need this, add a column
      });

    if (notificationError) {
      console.error('Error inserting accepted friend request notification:', notificationError);
      return new Response(JSON.stringify({ error: notificationError.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true, notification: data }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (e: any) {
    console.error('Critical error in create-accepted-request-notification function:', e.message, e.stack);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}); 