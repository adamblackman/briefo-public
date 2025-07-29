export interface Stock {
  symbol: string;
  name: string;
  price: number;
  change: number;
  marketCap: number;
  volume: number;
  sector: string;
  chartData?: number[];
}