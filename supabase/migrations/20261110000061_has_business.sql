-- 10 Nov 2026 (Taj): "Do you run a business?" becomes its own answer, set in onboarding and changeable
-- in Settings. With no business the app drops the business tools (invoices, clients and leads,
-- receipts, rules) and Work means your job. null means not answered yet: the app works it out from
-- business_name and business_type, so nobody already signed up changes. Safe to run twice.
alter table public.profiles add column if not exists has_business boolean;
comment on column public.profiles.has_business is 'Do they run a business? null means not answered: the app works it out from business_name and business_type.';
