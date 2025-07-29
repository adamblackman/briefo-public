import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { NotificationType } from '../_shared/notifications.ts'; // Ensure this path is correct

interface RequestBody {
  recipientUserId: string; // auth.users.id of the recipient
  senderProfileId: string; // profiles.id of the sender (could also be user_id if more convenient from client)
  friendshipId: string;
  messagePreview: string;
}

serve(async (req: Request) => {
  const { recipientUserId, senderProfileId, friendshipId, messagePreview } = await req.json() as RequestBody;

  if (!recipientUserId || !senderProfileId || !friendshipId || !messagePreview) {
    return new Response(JSON.stringify({ error: 'Missing required parameters: recipientUserId, senderProfileId, friendshipId, messagePreview' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Supabase URL or Service Role Key is not set in environment variables.');
    }

    const supabaseAdmin: SupabaseClient = createClient(supabaseUrl, serviceRoleKey);

    // Optional: Fetch sender's name to make the notification more descriptive
    // This assumes senderProfileId is the UUID from your 'profiles' table.
    // If you send sender's auth.uid from client, adjust accordingly.
    let senderName = 'Someone';
    try {
        const { data: senderProfile, error: senderError } = await supabaseAdmin
            .from('profiles')
            .select('name, username')
            .eq('id', senderProfileId) // Assuming senderProfileId is the ID from 'profiles' table
            .single();

        if (senderError) {
            console.warn(`Could not fetch sender's name for notification:`, senderError.message);
        } else if (senderProfile) {
            senderName = senderProfile.name || senderProfile.username || 'Someone';
        }
    } catch (e) {
        console.warn(`Exception fetching sender's name:`, e.message);
    }


    const finalMessagePreview = `${senderName}: ${messagePreview}`;

    const { data, error } = await supabaseAdmin
      .from('notifications')
      .insert({
        user_id: recipientUserId, // The user receiving the notification
        notification_type: NotificationType.MESSAGE,
        related_item_id: friendshipId, // Link to the chat/friendship
        related_item_source: 'chats', // Or 'friendships' if that's more semantic
        message_preview: finalMessagePreview.substring(0, 255), // Max length for preview
        is_read: false,
      });

    if (error) {
      console.error('Error inserting notification:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true, notification: data }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (e) {
    console.error('Critical error in create-chat-notification function:', e.message, e.stack);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});