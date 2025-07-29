import { supabase } from './supabase';

/**
 * Updates a user's profile bio
 * @param userId The user's ID
 * @param bio The new bio text
 * @returns A promise that resolves when the update is complete
 */
export async function updateUserBio(userId: string, bio: string) {
  try {
    if (bio.length > 80) {
      throw new Error('Bio cannot exceed 80 characters.');
    }

    const { error } = await supabase
      .from('profiles')
      .update({ bio, updated_at: new Date().toISOString() })
      .eq('user_id', userId);
    
    if (error) throw error;
    
    return { success: true };
  } catch (error: any) {
    console.error('Error updating bio:', error);
    return { success: false, error: { message: error.message || 'Failed to update bio.' } };
  }
}

/**
 * Updates a user's full name
 * @param userId The user's ID
 * @param name The new full name
 * @returns A promise that resolves when the update is complete
 */
export async function updateUserName(userId: string, name: string) {
  try {
    const { error } = await supabase
      .from('profiles')
      .update({ name, updated_at: new Date().toISOString() })
      .eq('user_id', userId);
    
    if (error) throw error;
    
    return { success: true };
  } catch (error) {
    console.error('Error updating name:', error);
    return { success: false, error };
  }
}

/**
 * Updates a user's username
 * @param userId The user's ID
 * @param username The new username
 * @returns A promise that resolves when the update is complete
 */
export async function updateUserUsername(userId: string, username: string) {
  try {
    // You might want to add username validation/uniqueness checks here or in database policies
    const { error } = await supabase
      .from('profiles')
      .update({ username, updated_at: new Date().toISOString() })
      .eq('user_id', userId);
    
    if (error) {
      if (error.code === '23505') { // PostgreSQL unique violation error code
        throw new Error('Username already exists. Please choose another.');
      }
      throw error;
    }
    
    return { success: true };
  } catch (error: any) { // Catch any error to ensure message is passed
    console.error('Error updating username:', error);
    return { success: false, error: { message: error.message || 'Failed to update username.' } };
  }
}

/**
 * Fetches a user's profile data
 * @param userId The user's ID
 * @returns A promise that resolves with the profile data or an error
 */
export async function getUserProfile(userId: string) {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('name, username, bio')
      .eq('user_id', userId)
      .single(); // Use single() as we expect one profile per user

    if (error && error.code !== 'PGRST116') { // PGRST116: row not found, which is a valid case for a new user
      throw error;
    }
    
    return { success: true, data };
  } catch (error) {
    console.error('Error fetching profile:', error);
    return { success: false, error };
  }
} 