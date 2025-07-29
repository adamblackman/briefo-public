import { Article } from '@/types/news';

export const mockArticles: Article[] = [
  {
    id: 1,
    title: "Tesla's AI breakthroughs could lead to massive profits, analysts say",
    summary: "Investment analysts are eyeing Tesla's advancements in artificial intelligence as a potential new revenue stream, separate from vehicle sales. The company's AI initiatives, led by CEO Elon Musk, could position Tesla as not just an automaker but a leader in cutting-edge technology.\n\nThe company's FSD (Full Self-Driving) technology has shown significant improvements in recent months, with some analysts estimating it could become a $100 billion business within five years.\n\nMusk recently announced that Tesla would be sharing more details about its Dojo supercomputer at an upcoming AI day, further fueling investor excitement about the company's technological edge over traditional automakers.",
    imageUrl: "https://images.pexels.com/photos/13861/IMG_3496bfree.jpg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2",
    source: "MarketWatch",
    time: "2h ago",
    url: "https://www.example.com/tesla-ai",
    votes: 245,
    commentCount: 73,
    comments: [
      {
        id: 1,
        username: "investor2023",
        text: "I'm skeptical about these valuations. The AI hype is overblown and Tesla still needs to focus on car production.",
        time: "1h ago"
      },
      {
        id: 2,
        username: "techbull",
        text: "This is why Tesla trades at such a premium compared to other automakers. They're a tech company that happens to make cars.",
        time: "45m ago"
      },
      {
        id: 3,
        username: "marketanalyst",
        text: "The potential for licensing their AI technology to other manufacturers could be huge.",
        time: "30m ago"
      }
    ]
  },
  {
    id: 2,
    title: "Fed signals potential interest rate cut as inflation cools",
    summary: "The Federal Reserve has indicated it may begin cutting interest rates in the coming months as recent data shows inflation moderating. In a statement following their latest policy meeting, Fed officials noted that while they remain vigilant about price pressures, the economy has shown signs of achieving the 'soft landing' they've been aiming for.\n\nMarkets reacted positively to the news, with major indices climbing on hopes that lower borrowing costs could reinvigorate business investment and consumer spending.\n\nEconomists now predict the first rate cut could come as soon as September, with potentially two or three more reductions before the end of the year.",
    imageUrl: "https://images.pexels.com/photos/6801648/pexels-photo-6801648.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2",
    source: "Bloomberg",
    time: "4h ago",
    url: "https://www.example.com/fed-rates",
    votes: 187,
    commentCount: 56,
    comments: [
      {
        id: 1,
        username: "economistnow",
        text: "About time. The high rates have been putting unnecessary pressure on the economy.",
        time: "3h ago"
      },
      {
        id: 2,
        username: "inflationhawk",
        text: "Too soon. Inflation isn't fully tamed yet and this could lead to a resurgence.",
        time: "2h ago"
      }
    ]
  },
  {
    id: 3,
    title: "Apple's new AR headset impresses developers, but questions remain about consumer adoption",
    summary: "Apple's recently announced augmented reality headset has received strong initial feedback from developers who've had hands-on time with the device. Software creators have praised the intuitive interface, impressive display quality, and sophisticated tracking capabilities.\n\nHowever, analysts continue to debate whether the high price point—expected to be around $3,000—will limit mass consumer adoption. Some industry experts predict Apple will need to release a more affordable version within 18 months to truly establish AR as a mainstream platform.\n\nDespite the pricing concerns, Apple's entrance into the AR market has reinvigorated interest in the technology, with venture capital investment in AR startups increasing by 40% since the announcement.",
    imageUrl: "https://images.pexels.com/photos/5589339/pexels-photo-5589339.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2",
    source: "TechCrunch",
    time: "6h ago",
    url: "https://www.example.com/apple-ar",
    votes: 142,
    commentCount: 38,
    comments: [
      {
        id: 1,
        username: "applegeek",
        text: "First gen will be for developers and enthusiasts, but Apple always brings prices down over time.",
        time: "5h ago"
      },
      {
        id: 2,
        username: "vrinvestor",
        text: "The real potential is in enterprise applications. I can see this being huge for design, medical, and education sectors.",
        time: "4h ago"
      }
    ]
  },
  {
    id: 4,
    title: "Bitcoin surges past $70,000 as institutional adoption accelerates",
    summary: "Bitcoin has reached a new all-time high, surpassing $70,000 as institutional investors continue to pile into the cryptocurrency. Several major financial institutions have announced new Bitcoin offerings for their clients, reflecting growing mainstream acceptance of digital assets.\n\nThe surge comes amid persistent inflation concerns and continued interest in alternative stores of value. Analysts note that regulatory clarity in key markets has also contributed to increased institutional comfort with cryptocurrency investments.\n\nMeanwhile, on-chain data shows that long-term holders continue to accumulate Bitcoin, suggesting confidence in the asset's long-term prospects despite historical volatility.",
    imageUrl: "https://images.pexels.com/photos/5980743/pexels-photo-5980743.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2",
    source: "CoinDesk",
    time: "10h ago",
    url: "https://www.example.com/bitcoin-surge",
    votes: 324,
    commentCount: 97,
    comments: [
      {
        id: 1,
        username: "cryptomaxi",
        text: "This is just the beginning. When you consider the limited supply and increasing demand, $100k is inevitable.",
        time: "8h ago"
      },
      {
        id: 2,
        username: "traderman",
        text: "Feels like 2017 all over again. Be careful with FOMO buying at these levels.",
        time: "7h ago"
      }
    ]
  },
  {
    id: 5,
    title: "Amazon's AI-powered retail strategy shows promising early results",
    summary: "Amazon has reported encouraging preliminary results from its new AI-enhanced retail strategy. The company has implemented machine learning algorithms to optimize inventory management, personalize customer recommendations, and streamline logistics operations.\n\nEarly data suggests the AI initiatives have reduced supply chain costs by approximately 12% while improving product delivery times by an average of 8 hours. The company is also seeing higher conversion rates from its more finely tuned recommendation engine.\n\nAmazon executives emphasized that these improvements are just the beginning, with more sophisticated AI applications planned for rollout over the next 18 months. Analysts have responded positively, with several upgrading their price targets for Amazon stock.",
    imageUrl: "https://images.pexels.com/photos/5696562/pexels-photo-5696562.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2",
    source: "Reuters",
    time: "12h ago",
    url: "https://www.example.com/amazon-ai",
    votes: 156,
    commentCount: 42,
    comments: [
      {
        id: 1,
        username: "retailfuturist",
        text: "Amazon continuing to widen the moat against traditional retailers. This is why physical retail is struggling.",
        time: "10h ago"
      },
      {
        id: 2,
        username: "supplychain_pro",
        text: "The logistics improvements are the real story here. 12% cost reduction at Amazon's scale is enormous.",
        time: "9h ago"
      }
    ]
  }
];

export const mockRelatedNews = [
  {
    id: 101,
    title: "AAPL shares climb on strong iPhone 15 pre-orders",
    source: "CNBC",
    time: "2h ago"
  },
  {
    id: 102,
    title: "Tech sector leads market rally as investors eye AI opportunities",
    source: "WSJ",
    time: "5h ago"
  },
  {
    id: 103,
    title: "Apple supplier reports increased component orders for Q3",
    source: "Reuters",
    time: "Yesterday"
  }
];