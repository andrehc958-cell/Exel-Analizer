import { adsTxt } from '../server/ads.js';
export const GET = () => adsTxt(process.env.VITE_ADSENSE_CLIENT);
