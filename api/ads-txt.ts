import { adsTxt } from '../server/ads'

export const GET = () => adsTxt(process.env.VITE_ADSENSE_CLIENT)
