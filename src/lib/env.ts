// Central place for configuration. External services are optional: when their
// keys are missing the app keeps working and logs what it would have done.

export const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");

export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const supabasePublishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const features = {
  stripe: Boolean(process.env.STRIPE_SECRET_KEY),
  subscriptions: Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_SUBSCRIPTION_PRICE_ID),
  email: Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM),
  sms: Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER),
};

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable ${name}`);
  return value;
}
