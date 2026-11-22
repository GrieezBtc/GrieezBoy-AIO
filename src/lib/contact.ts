/** Where people are sent to buy premium (payment is handled manually for now). */
export const WHATSAPP_NUMBER = "2348107461934";
export const TELEGRAM_USER = "grieezboy001";

export function whatsappLink(message: string): string {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

export function telegramLink(message: string): string {
  return `https://t.me/${TELEGRAM_USER}?text=${encodeURIComponent(message)}`;
}
