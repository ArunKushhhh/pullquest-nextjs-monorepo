import Stripe from 'stripe';
import { config } from './env.js';

export const stripe = new Stripe(config.STRIPE_SECRET_KEY, {
  apiVersion: '2024-06-20' as any, // specify standard API version compatible with the package version
});
