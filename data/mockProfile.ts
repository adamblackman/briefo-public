import { UserProfile } from '@/types/profile';

export const mockUserProfile: UserProfile = {
  name: 'Alex Morgan',
  username: 'amorgan',
  avatar: 'https://images.pexels.com/photos/1681010/pexels-photo-1681010.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2',
  email: 'alex.morgan@example.com',
  phone: '+1 (555) 123-4567',
  location: 'San Francisco, CA',
  memberSince: 'Jan 2022',
  membershipLevel: 'Premium',
  stats: {
    articlesRead: 387,
    comments: 42,
    portfolioGrowth: 12.4
  },
  preferences: {
    notifications: true,
    darkMode: true,
    language: 'English (US)'
  }
};