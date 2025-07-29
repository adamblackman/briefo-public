import { Stock } from '@/types/stocks';

export const mockStocks: Stock[] = [
  {
    symbol: 'AAPL',
    name: 'Apple Inc.',
    price: 187.32,
    change: 1.25,
    marketCap: 2950000000000,
    volume: 62000000,
    sector: 'Technology',
    chartData: [184.2, 185.4, 183.9, 184.8, 186.2, 187.32]
  },
  {
    symbol: 'MSFT',
    name: 'Microsoft Corp.',
    price: 410.17,
    change: 0.75,
    marketCap: 3050000000000,
    volume: 22000000,
    sector: 'Technology',
    chartData: [405.8, 408.2, 407.5, 409.1, 411.3, 410.17]
  },
  {
    symbol: 'TSLA',
    name: 'Tesla, Inc.',
    price: 215.83,
    change: -1.25,
    marketCap: 686000000000,
    volume: 125000000,
    sector: 'Automotive',
    chartData: [218.2, 219.4, 217.1, 216.8, 214.9, 215.83]
  },
  {
    symbol: 'AMZN',
    name: 'Amazon.com Inc.',
    price: 177.23,
    change: 0.92,
    marketCap: 1825000000000,
    volume: 41000000,
    sector: 'Consumer Cyclical',
    chartData: [175.4, 176.3, 177.8, 178.2, 176.9, 177.23]
  },
  {
    symbol: 'NVDA',
    name: 'NVIDIA Corp.',
    price: 875.64,
    change: 2.37,
    marketCap: 2150000000000,
    volume: 55000000,
    sector: 'Technology',
    chartData: [856.1, 862.3, 868.7, 871.2, 873.9, 875.64]
  },
  {
    symbol: 'GOOGL',
    name: 'Alphabet Inc.',
    price: 152.29,
    change: -0.48,
    marketCap: 1920000000000,
    volume: 32000000,
    sector: 'Communication Services',
    chartData: [154.2, 153.8, 153.1, 152.7, 152.6, 152.29]
  },
  {
    symbol: 'META',
    name: 'Meta Platforms Inc.',
    price: 472.61,
    change: 1.82,
    marketCap: 1210000000000,
    volume: 18000000,
    sector: 'Communication Services',
    chartData: [465.3, 467.8, 469.2, 470.5, 471.9, 472.61]
  },
  {
    symbol: 'BRK.B',
    name: 'Berkshire Hathaway',
    price: 412.85,
    change: 0.27,
    marketCap: 915000000000,
    volume: 4500000,
    sector: 'Financial Services',
    chartData: [410.2, 410.9, 411.4, 412.1, 412.6, 412.85]
  }
];