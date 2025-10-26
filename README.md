# وصلني (Wasalni) - Arabic Delivery Ecosystem

A comprehensive delivery platform inspired by Mrsool, built with React Native Expo and Supabase. This project includes a complete multi-role system for customers, drivers, merchants, and administrators.

## Features

### Customer App (الزبائن)
- **Home Screen** - Browse merchants by category (restaurants, grocery, pharmacy, gifts)
- **Orders Management** - Track current and previous orders with real-time status
- **Chat** - Communicate with drivers during delivery
- **Offers** - View promotions and discount codes
- **Profile** - Manage account, addresses, payment methods, and settings

### Order Rating System
- **Post-Delivery Ratings** - Rate orders after successful delivery
- **Dual Rating** - Rate both driver and merchant for comprehensive feedback
- **Star Rating** - 1-5 star rating system with descriptive labels
- **Comment System** - Optional text feedback for detailed reviews
- **Real-time Updates** - Automatic calculation and display of average ratings
- **Profile Integration** - Ratings displayed on driver and merchant profiles
- **Review Management** - View and manage submitted reviews

### Driver Features
- **Profile Management** - Manage vehicle information, license details, and availability
- **Order Assignment** - Receive and accept delivery requests
- **Earnings Tracking** - Monitor income and delivery statistics
- **Rating System** - Build reputation through customer reviews
- **Online Status** - Toggle availability for receiving orders
- **Real-time Navigation** - GPS-based delivery tracking

### Merchant Features
- **Store Management** - Manage product catalog and store information
- **Order Processing** - Accept, prepare, and mark orders as ready
- **Rating System** - Build reputation through customer reviews
- **Business Hours** - Set and manage store opening hours
- **Order Analytics** - Track sales and performance metrics

### Core Functionalities
- Arabic RTL (Right-to-Left) interface
- Phone number authentication with OTP verification
- Real-time order tracking
- Multi-category merchant browsing
- Secure payment processing
- Push notifications
- In-app chat system
- **Order Rating System** - Rate drivers and merchants after delivery with 1-5 stars and comments

### Driver & Merchant Features
- **Driver Profile Management** - Manage vehicle information and availability
- **Merchant Profile Management** - Manage store information and opening hours
- **Real-time Order Assignment** - Receive and manage delivery requests
- **Earnings Tracking** - Monitor income and delivery statistics
- **Rating System** - Build reputation through customer reviews

## Tech Stack

- **Frontend**: React Native with Expo SDK 54
- **Navigation**: Expo Router (file-based routing)
- **Backend**: Supabase (PostgreSQL database with Row Level Security)
- **Authentication**: Supabase Auth (OTP via SMS)
- **Styling**: StyleSheet with custom theme system
- **Fonts**: Cairo & Tajawal (Arabic Google Fonts)
- **Icons**: Lucide React Native

## Database Schema

The application uses a comprehensive Supabase database with the following tables:

### Core Tables
- `profiles` - User profiles (customers, drivers, merchants, admins)
- `addresses` - Delivery addresses with geolocation
- `merchants` - Store/restaurant information
- `merchant_products` - Product catalog
- `orders` - Order management with status tracking
- `order_items` - Individual items per order

### Driver & Delivery
- `driver_profiles` - Driver information and verification
- `driver_earnings` - Earnings tracking per delivery

### Communication & Support
- `chat_conversations` - Chat sessions between customers and drivers
- `chat_messages` - Individual messages
- `notifications` - Push notification logs
- `support_tickets` - Customer support system

### Financial
- `transactions` - All financial transactions
- `commission_rules` - Platform commission configuration
- `reviews` - Customer reviews and ratings

## Project Structure

```
project/
├── app/                    # Expo Router screens
│   ├── (tabs)/            # Tab navigation screens
│   │   ├── index.tsx      # Home screen
│   │   ├── orders.tsx     # Orders listing
│   │   ├── chat.tsx       # Chat screen
│   │   ├── offers.tsx     # Offers screen
│   │   └── profile.tsx    # Profile screen
│   ├── auth/              # Authentication screens
│   │   └── index.tsx      # Login/OTP screen
│   ├── _layout.tsx        # Root layout
│   └── index.tsx          # Entry point
├── components/            # Reusable components
├── constants/             # Theme and constants
│   └── theme.ts          # Colors, typography, spacing
├── contexts/              # React contexts
│   └── AuthContext.tsx   # Authentication context
├── lib/                   # Utilities
│   └── supabase.ts       # Supabase client
├── types/                 # TypeScript types
│   └── database.ts       # Database type definitions
└── scripts/              # Utility scripts
    └── seed-data.ts      # Database seeding

```

## Getting Started

### Prerequisites
- Node.js 18+ installed
- Expo CLI installed globally: `npm install -g expo-cli`
- Supabase account (database is pre-configured)

### Installation

1. Install dependencies:
```bash
npm install
```

2. The Supabase credentials are already configured in `.env`:
```
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

3. Start the development server:
```bash
npm run dev
```

### Testing Authentication

The app uses Supabase phone authentication. To test:
1. Enter a phone number in format: +9665XXXXXXXX
2. In development, check Supabase dashboard for OTP code
3. Enter the 6-digit code to verify

**Note**: SMS sending requires Supabase Pro plan or Twilio integration. In development, use the dashboard to get test OTP codes.

## Design System

### Colors
- **Primary**: #00B074 (Green - main brand color)
- **Secondary**: #FFD84D (Yellow - accents and highlights)
- **Background**: #FFFFFF (White)
- **Light Gray**: #F5F5F5 (Backgrounds)
- **Text**: #212121 (Primary text)
- **Text Light**: #757575 (Secondary text)

### Typography
- **Headings**: Cairo font (Bold/SemiBold)
- **Body Text**: Tajawal font (Regular/Medium)
- **Arabic RTL**: Fully right-to-left interface

### Layout
- 8px spacing system
- Rounded corners (8px, 12px, 16px)
- Soft shadows for depth
- Clean, minimal design

## Key Features Implementation

### Authentication Flow
1. User enters phone number
2. OTP sent via Supabase Auth
3. User verifies OTP
4. Profile created in `profiles` table
5. Session managed with `AuthContext`

### Order Flow
1. Customer browses merchants
2. Adds items to cart
3. Places order (creates order record)
4. Merchant accepts and prepares
5. Driver assigned and picks up
6. Real-time tracking during delivery
7. Order delivered and rated

### Security
- Row Level Security (RLS) enabled on all tables
- Users can only access their own data
- Drivers see assigned orders only
- Merchants manage their own products
- Secure authentication with JWT tokens

### Order Rating System
The rating system allows customers to provide feedback on their delivery experience:

1. **Post-Delivery Rating**: Customers can rate orders after successful delivery
2. **Dual Rating**: Separate ratings for both driver and merchant
3. **Star System**: 1-5 star rating with descriptive labels (Bad to Excellent)
4. **Comment Feedback**: Optional text comments for detailed feedback
5. **Real-time Updates**: Automatic calculation of average ratings
6. **Profile Display**: Ratings displayed on driver and merchant profiles
7. **Database Integration**: Ratings stored in the `reviews` table with proper foreign key relationships

#### Implementation Details:
- Ratings are submitted through a dedicated rating screen
- Merchant reviews use the merchant's `owner_id` to maintain data integrity
- Driver reviews use the driver's profile ID directly
- Average ratings are automatically calculated and updated in real-time
- The system prevents duplicate ratings for the same order
- Ratings are displayed with proper RTL support in Arabic

## Future Enhancements

### Planned Features
- [ ] Driver app with separate interface
- [ ] Merchant dashboard for order management
- [ ] Web admin panel with analytics
- [ ] Real-time GPS tracking with maps
- [ ] Payment gateway integration (Stripe/Hyperpay)
- [ ] Advanced search and filters
- [ ] Order scheduling
- [ ] Loyalty program
- [ ] Multi-language support (English/Arabic toggle)

### Admin Dashboard (Web)
A comprehensive web dashboard for platform management:
- User management (customers, drivers, merchants)
- Order monitoring and analytics
- Financial tracking and commission management
- Support ticket system
- Real-time statistics and reports
- Driver performance analytics
- Merchant settlement tracking

## Database Seeding

To populate the database with sample merchants:

```bash
npx ts-node scripts/seed-data.ts
```

This will add 6 sample merchants across different categories.

## Deployment

### Mobile App
```bash
# Build for iOS
expo build:ios

# Build for Android
expo build:android
```

### Web (Admin Dashboard)
```bash
npm run build:web
```

## Contributing

This is a demonstration project. For production use:
1. Configure proper SMS provider for OTP
2. Set up payment gateway
3. Implement proper image upload/CDN
4. Add comprehensive error handling
5. Set up analytics and monitoring
6. Configure push notifications

## License

This project is created for demonstration purposes.

## Support

For issues or questions about the implementation, please refer to:
- Expo Documentation: https://docs.expo.dev
- Supabase Documentation: https://supabase.com/docs
- React Native Documentation: https://reactnative.dev

---

**Built with ❤️ for the Arabic market**

وصلني - توصيل سريع وآمن
