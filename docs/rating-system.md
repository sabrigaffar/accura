# Order Rating System Documentation

## Overview
The order rating system allows customers to rate their delivery experience for both drivers and merchants after an order is delivered. The system includes a 1-5 star rating with optional comments and automatically updates average ratings for drivers and merchants.

## Components

### 1. Rating Screen ([app/order/[id]/rate.tsx](file:///c:/Users/sabri%20Ga3far/Desktop/project/app/order/%5Bid%5D/rate.tsx))
A dedicated screen for submitting ratings with the following features:
- 1-5 star rating selection
- Optional comment field
- Real-time rating submission to Supabase
- Automatic average rating updates for drivers and merchants

### 2. Order Detail Integration ([app/order/[id].tsx](file:///c:/Users/sabri%20Ga3far/Desktop/project/app/order/%5Bid%5D.tsx))
The rating button appears on the order detail screen only after the order status is "delivered" and no rating has been submitted yet.

### 3. Rating Utilities ([lib/ratingUtils.ts](file:///c:/Users/sabri%20Ga3far/Desktop/project/lib/ratingUtils.ts))
Utility functions for:
- Calculating average ratings
- Updating merchant and driver average ratings
- Caching rating data to improve performance

### 4. Profile Integration ([app/(tabs)/profile.tsx](file:///c:/Users/sabri%20Ga3far/Desktop/project/app/(tabs)/profile.tsx))
Display of ratings on user profiles for drivers and merchants.

### 5. Dedicated Profile Screens
- Driver Profile ([app/profile/driver-profile.tsx](file:///c:/Users/sabri%20Ga3far/Desktop/project/app/profile/driver-profile.tsx))
- Merchant Profile ([app/profile/merchant-profile.tsx](file:///c:/Users/sabri%20Ga3far/Desktop/project/app/profile/merchant-profile.tsx))

## Database Schema

### Reviews Table
```sql
CREATE TABLE IF NOT EXISTS reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id),
  reviewer_id uuid NOT NULL REFERENCES profiles(id),
  reviewee_id uuid NOT NULL REFERENCES profiles(id),
  reviewee_type TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### Key Relationships
- `reviewer_id`: References the customer who submitted the review (from profiles table)
- `reviewee_id`: References the driver or merchant owner (from profiles table)
- `order_id`: References the order being reviewed (from orders table)

## Implementation Details

### 1. Merchant Reviews
Merchant reviews use the merchant's `owner_id` (which is a profile ID) rather than the merchant ID to maintain consistency with the reviewee_id foreign key constraint.

### 2. Driver Reviews
Driver reviews use the driver's profile ID directly.

### 3. Average Rating Updates
When a new review is submitted:
1. The review is inserted into the reviews table
2. The system automatically calculates and updates the average rating for the driver/merchant
3. The updated average is stored in the respective profile tables:
   - For drivers: `driver_profiles.average_rating`
   - For merchants: `merchants.rating`

### 4. Caching
The rating system implements caching to avoid repeated database queries:
- Ratings are cached for 5 minutes
- Cached data is automatically refreshed after the cache expires

## Usage Flow

1. Customer completes an order (status becomes "delivered")
2. Customer navigates to the order detail screen
3. "Rate Order" button appears if no rating has been submitted
4. Customer taps the button to access the rating screen
5. Customer selects a star rating (1-5) and optionally adds a comment
6. Customer submits the rating
7. System:
   - Inserts review(s) into the database
   - Updates average ratings for driver and merchant
   - Updates order status to reflect rating submission
8. Customer is returned to the order detail screen

## Security Considerations

- Row Level Security (RLS) policies ensure users can only view reviews about themselves
- Users can only create reviews for orders they've placed
- Rating values are validated to be between 1-5

## Error Handling

- Graceful handling of network errors
- User-friendly error messages
- Logging of system errors for debugging

## Testing

The system includes test scripts to verify functionality:
- [scripts/simple-rating-test.ts](file:///c:/Users/sabri%20Ga3far/Desktop/project/scripts/simple-rating-test.ts): Basic functionality test
- [scripts/verify-rating-system.ts](file:///c:/Users/sabri%20Ga3far/Desktop/project/scripts/verify-rating-system.ts): Comprehensive system verification
- [scripts/test-order-rating.ts](file:///c:/Users/sabri%20Ga3far/Desktop/project/scripts/test-order-rating.ts): Order-specific rating test

## Future Enhancements

1. Display of individual reviews on profile screens
2. Review moderation system
3. Photo uploads with reviews
4. Response functionality for merchants/drivers to reviews
5. Review reporting and flagging system