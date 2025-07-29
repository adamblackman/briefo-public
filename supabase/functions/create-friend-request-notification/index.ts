import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { NotificationType } from '../_shared/notifications.ts'; // Adjust path if needed

interface RequestBody {
  recipientAuthId: string; // auth.users.id of the recipient
  senderProfileId: string;   // profiles.id of the sender
  senderAuthId: string;      // auth.users.id of the sender (for navigation)
  friendshipId: string;      // The ID of the newly created row in the 'friends' table
}

serve(async (req: Request) => {
  const body = await req.json();
  const { recipientAuthId, senderProfileId, senderAuthId, friendshipId } = body as RequestBody;

  if (!recipientAuthId || !senderProfileId || !senderAuthId || !friendshipId) {
    return new Response(JSON.stringify({
      error: 'Missing required parameters: recipientAuthId, senderProfileId, senderAuthId, friendshipId'
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const supabaseUrl = Deno.env.get('MY_SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('MY_SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Supabase URL or Service Role Key is not set.');
    }

    const supabaseAdmin: SupabaseClient = createClient(supabaseUrl, serviceRoleKey);

    // Fetch sender's name
    let senderName = 'Someone';
    const { data: senderProfile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('name, username')
      .eq('id', senderProfileId) // Using profile_id here
      .single();

    if (profileError) {
      console.warn(`Could not fetch sender's name for friend request notification:`, profileError.message);
    } else if (senderProfile) {
      senderName = senderProfile.name || senderProfile.username || 'Someone';
    }

    const messagePreview = `${senderName} sent you a friend request.`;

    const { data, error: notificationError } = await supabaseAdmin
      .from('notifications')
      .insert({
        user_id: recipientAuthId, // User receiving the notification
        notification_type: NotificationType.FRIEND_REQUEST,
        related_item_id: senderAuthId, // STORE SENDER'S AUTH ID HERE FOR NAVIGATION
        related_item_source: 'friend_requests', // New source type
        message_preview: messagePreview,
        is_read: false,
      });

    if (notificationError) {
      console.error('Error inserting friend request notification:', notificationError);
      return new Response(JSON.stringify({ error: notificationError.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true, notification: data }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (e: any) { // Added :any to e for broader compatibility
    console.error('Critical error in create-friend-request-notification function:', e.message, e.stack);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}); 