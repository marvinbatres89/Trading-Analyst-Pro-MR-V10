export const VERSION="10.2.0";
export const WS_URL="wss://ws.binaryws.com/websockets/v3";
export const MARKETS={"1HZ10V":"Volatility 10 (1s) Index","1HZ25V":"Volatility 25 (1s) Index","1HZ50V":"Volatility 50 (1s) Index","1HZ75V":"Volatility 75 (1s) Index","1HZ100V":"Volatility 100 (1s) Index",R_10:"Volatility 10 Index",R_25:"Volatility 25 Index",R_50:"Volatility 50 Index",R_75:"Volatility 75 Index",R_100:"Volatility 100 Index"};
export const CFG={
 maxPrices:500,maxDigits:500,minFast:20,minComplete:40,scanMs:350,
 thresholds:{rise_fall:{prepare:68,confirm:78},even_odd:{prepare:66,confirm:74},over_under:{prepare:66,confirm:74},match:{prepare:64,confirm:72}},
 timing:{rise_fall:{prepare:4500,revalidate:1800,execute:10},even_odd:{prepare:3000,revalidate:1000,execute:10},over_under:{prepare:3000,revalidate:1000,execute:10},match:{prepare:4000,revalidate:1500,execute:10}}
};
