import { z } from 'zod';

export const SHOP_SERVICE_TYPES = [
  'Delivery', 'Dine-in', 'Takeaway', 'Installation', 'Repair',
  'Consulting', 'Retail', 'Online', 'Offline', 'Other'
] as const;

export const shopFormSchema = z.object({
  name: z.string().min(2, 'Shop name is required'),
  adminEmail: z.string().email('Valid email is required'),
  contactNumber: z.string().optional().or(z.literal('')),
  address: z.string().min(5, 'Full address is required'),
  gstNumber: z.string().optional().or(z.literal('')),
  storeType: z.string().optional().or(z.literal('')),
  typeService: z.enum(SHOP_SERVICE_TYPES).optional().or(z.literal('')),
  salesAndProduct: z.string().optional().or(z.literal('')),
  city: z.string().optional().or(z.literal('')),
  state: z.string().optional().or(z.literal('')),
  pincode: z.string().optional().or(z.literal('')),
  latitude: z.union([z.string(), z.number()]).optional(),
  longitude: z.union([z.string(), z.number()]).optional(),
});

export type ShopFormValues = z.infer<typeof shopFormSchema>;
