import { Conversation, RichMessage } from '@/types/chat';
import { mockStocks } from './mockStocks';
import { mockArticles } from './mockNews';

// Ensure message IDs are strings and handle possible undefined values
const createMessage = (id: number, content: any, timestamp: string, isMine: boolean, type: 'text' | 'stock' | 'article'): RichMessage => {
  // For stock and article types, provide a fallback if the lookup returns undefined
  let safeContent = content;
  
  if (type === 'stock' && (content === undefined || content === null)) {
    safeContent = mockStocks[0]; // Default to first stock if undefined
  } else if (type === 'article' && (content === undefined || content === null)) {
    safeContent = mockArticles[0]; // Default to first article if undefined
  }
  
  return {
    id: String(id),
    content: safeContent,
    timestamp,
    isMine,
    type
  };
};

export const mockConversations: Conversation[] = [
  {
    id: 1,
    name: 'Sarah Johnson',
    avatar: 'https://images.pexels.com/photos/415829/pexels-photo-415829.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2',
    lastMessage: 'Have you seen the latest Tesla news? It\'s incredible!',
    lastMessageTime: '10:34 AM',
    unread: true,
    unreadCount: 2,
    online: true,
    sent: true,
    delivered: true,
    friendship_id: 'friend-1',
    messages: [
      createMessage(1, 'Hey, have you been following the market today?', '2023-06-15 10:20 AM', false, 'text'),
      createMessage(2, 'Yeah, tech stocks are having a great day', '2023-06-15 10:22 AM', true, 'text'),
      createMessage(3, 'Take a look at Tesla! It\'s up over 5%', '2023-06-15 10:25 AM', false, 'text'),
      createMessage(4, mockStocks.find(stock => stock.symbol === 'TSLA'), '2023-06-15 10:28 AM', false, 'stock'),
      createMessage(5, 'Wow, that\'s impressive. Any news driving the jump?', '2023-06-15 10:30 AM', true, 'text'),
      createMessage(6, 'Yes, they just announced a major AI breakthrough', '2023-06-15 10:32 AM', false, 'text'),
      createMessage(7, mockArticles.find(article => article.id === 1), '2023-06-15 10:33 AM', false, 'article'),
      createMessage(8, 'Have you seen the latest Tesla news? It\'s incredible!', '2023-06-15 10:34 AM', false, 'text')
    ]
  },
  {
    id: 2,
    name: 'Mike Chang',
    avatar: 'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2',
    lastMessage: 'I\'m buying more Apple shares before earnings',
    lastMessageTime: '9:15 AM',
    unread: false,
    unreadCount: 0,
    online: false,
    sent: true,
    delivered: true,
    friendship_id: 'friend-2',
    messages: [
      createMessage(1, 'What do you think about the tech sector right now?', '2023-06-15 9:05 AM', false, 'text'),
      createMessage(2, 'I think it\'s still strong despite the recent pullback', '2023-06-15 9:08 AM', true, 'text'),
      createMessage(3, 'Agreed. Apple looks particularly undervalued', '2023-06-15 9:12 AM', false, 'text'),
      createMessage(4, mockStocks.find(stock => stock.symbol === 'AAPL'), '2023-06-15 9:13 AM', false, 'stock'),
      createMessage(5, 'I\'m buying more Apple shares before earnings', '2023-06-15 9:15 AM', false, 'text')
    ]
  },
  {
    id: 3,
    name: 'Emma Wilson',
    avatar: 'https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2',
    lastMessage: 'Did you see the Fed\'s announcement about rates?',
    lastMessageTime: 'Yesterday',
    unread: true,
    unreadCount: 1,
    online: false,
    sent: true,
    delivered: true,
    friendship_id: 'friend-3',
    messages: [
      createMessage(1, 'How are your bank stocks doing after the news?', '2023-06-14 2:30 PM', false, 'text'),
      createMessage(2, 'They\'re up about 2% today', '2023-06-14 2:35 PM', true, 'text'),
      createMessage(3, 'Did you see the Fed\'s announcement about rates?', '2023-06-14 2:40 PM', false, 'text'),
      createMessage(4, mockArticles.find(article => article.id === 2), '2023-06-14 2:42 PM', false, 'article')
    ]
  },
  {
    id: 4,
    name: 'James Roberts',
    avatar: 'https://images.pexels.com/photos/614810/pexels-photo-614810.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2',
    lastMessage: 'Check out my new crypto portfolio',
    lastMessageTime: '2 days ago',
    unread: false,
    unreadCount: 0,
    online: true,
    sent: true,
    delivered: false,
    friendship_id: 'friend-4',
    messages: [
      createMessage(1, 'Are you invested in any crypto?', '2023-06-13 11:20 AM', false, 'text'),
      createMessage(2, 'Just Bitcoin and Ethereum, about 5% of my portfolio', '2023-06-13 11:25 AM', true, 'text'),
      createMessage(3, 'Smart. I\'ve been increasing my allocation lately', '2023-06-13 11:30 AM', false, 'text'),
      createMessage(4, 'Bitcoin is on fire right now', '2023-06-13 11:32 AM', false, 'text'),
      createMessage(5, mockArticles.find(article => article.id === 4), '2023-06-13 11:35 AM', false, 'article'),
      createMessage(6, 'Check out my new crypto portfolio', '2023-06-13 11:40 AM', false, 'text')
    ]
  },
  {
    id: 5,
    name: 'Lisa Thompson',
    avatar: 'https://images.pexels.com/photos/733872/pexels-photo-733872.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2',
    lastMessage: 'Thanks for the NVIDIA tip last month!',
    lastMessageTime: '3 days ago',
    unread: false,
    unreadCount: 0,
    online: false,
    sent: true,
    delivered: true,
    friendship_id: 'friend-5',
    messages: [
      createMessage(1, 'Remember when you told me to buy NVIDIA?', '2023-06-12 3:15 PM', false, 'text'),
      createMessage(2, 'Yes, did you?', '2023-06-12 3:18 PM', true, 'text'),
      createMessage(3, 'I did! Look at it now', '2023-06-12 3:20 PM', false, 'text'),
      createMessage(4, mockStocks.find(stock => stock.symbol === 'NVDA'), '2023-06-12 3:22 PM', false, 'stock'),
      createMessage(5, 'Up over 40% since I bought. Thanks for the NVIDIA tip last month!', '2023-06-12 3:25 PM', false, 'text')
    ]
  }
];