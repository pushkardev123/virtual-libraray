// Meta Pixel (Facebook Pixel) type declarations
declare global {
  interface Window {
    fbq?: (action: string, eventName: string, data?: any) => void;
    _fbq?: any;
  }
}

export {};

