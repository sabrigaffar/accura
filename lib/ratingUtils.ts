import { supabase } from './supabase';

/**
 * Calculate average rating for a user (driver or merchant)
 * @param userId - The ID of the user (profile ID)
 * @returns Average rating and total number of reviews
 */
export async function getUserRating(userId: string) {
  try {
    const { data, error } = await supabase
      .from('reviews')
      .select('rating')
      .eq('reviewee_id', userId);

    if (error) {
      console.error('Error fetching user ratings:', error);
      return { averageRating: 0, totalReviews: 0 };
    }

    if (!data || data.length === 0) {
      return { averageRating: 0, totalReviews: 0 };
    }

    const totalRating = data.reduce((sum, review) => sum + review.rating, 0);
    const averageRating = totalRating / data.length;

    return {
      averageRating: parseFloat(averageRating.toFixed(1)),
      totalReviews: data.length,
    };
  } catch (error) {
    console.error('Error calculating user rating:', error);
    return { averageRating: 0, totalReviews: 0 };
  }
}

/**
 * Get user rating with caching to avoid repeated requests
 */
const ratingCache = new Map<string, { averageRating: number; totalReviews: number; timestamp: number }>();

export async function getCachedUserRating(userId: string) {
  const cached = ratingCache.get(userId);
  const now = Date.now();
  
  // Cache for 5 minutes
  if (cached && now - cached.timestamp < 5 * 60 * 1000) {
    return cached;
  }
  
  const rating = await getUserRating(userId);
  ratingCache.set(userId, { ...rating, timestamp: now });
  return rating;
}

/**
 * Update merchant rating in the merchants table
 * @param merchantId - The ID of the merchant
 */
export async function updateMerchantRating(merchantId: string) {
  try {
    // Get merchant owner_id
    const { data: merchant, error: merchantError } = await supabase
      .from('merchants')
      .select('owner_id')
      .eq('id', merchantId)
      .single();

    if (merchantError) {
      console.error('Error fetching merchant:', merchantError);
      return;
    }

    if (!merchant) {
      console.error('Merchant not found');
      return;
    }

    // Get all ratings for this merchant
    const { data: reviews, error: reviewsError } = await supabase
      .from('reviews')
      .select('rating')
      .eq('reviewee_id', merchant.owner_id)
      .eq('reviewee_type', 'merchant');

    if (reviewsError) {
      console.error('Error fetching merchant reviews:', reviewsError);
      return;
    }

    if (!reviews || reviews.length === 0) {
      // Reset rating if no reviews
      await supabase
        .from('merchants')
        .update({ 
          rating: 0, 
          total_reviews: 0,
          updated_at: new Date().toISOString()
        })
        .eq('id', merchantId);
      return;
    }

    // Calculate average rating
    const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
    const averageRating = totalRating / reviews.length;
    const totalReviews = reviews.length;

    // Update merchant rating
    const { error: updateError } = await supabase
      .from('merchants')
      .update({ 
        rating: parseFloat(averageRating.toFixed(1)), 
        total_reviews: totalReviews,
        updated_at: new Date().toISOString()
      })
      .eq('id', merchantId);

    if (updateError) {
      console.error('Error updating merchant rating:', updateError);
    }
  } catch (error) {
    console.error('Error updating merchant rating:', error);
  }
}

/**
 * Update driver rating in the driver_profiles table
 * @param driverId - The ID of the driver (profile ID)
 */
export async function updateDriverRating(driverId: string) {
  try {
    // Get all ratings for this driver
    const { data: reviews, error: reviewsError } = await supabase
      .from('reviews')
      .select('rating')
      .eq('reviewee_id', driverId)
      .eq('reviewee_type', 'driver');

    if (reviewsError) {
      console.error('Error fetching driver reviews:', reviewsError);
      return;
    }

    if (!reviews || reviews.length === 0) {
      // Reset rating if no reviews
      await supabase
        .from('driver_profiles')
        .update({ 
          average_rating: 0,
          updated_at: new Date().toISOString()
        })
        .eq('id', driverId);
      return;
    }

    // Calculate average rating
    const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
    const averageRating = totalRating / reviews.length;

    // Update driver rating
    const { error: updateError } = await supabase
      .from('driver_profiles')
      .update({ 
        average_rating: parseFloat(averageRating.toFixed(1)),
        updated_at: new Date().toISOString()
      })
      .eq('id', driverId);

    if (updateError) {
      console.error('Error updating driver rating:', updateError);
    }
  } catch (error) {
    console.error('Error updating driver rating:', error);
  }
}