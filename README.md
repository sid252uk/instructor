# Instructor

A mobile-friendly web app for UK driving instructors to run their lessons: availability, instant bookings, payments, cancellations, reminders and learner progress.

Built with Next.js (App Router), Supabase (Postgres, auth, row level security) and Vercel.

## What's in the first version

**Instructors**
- Sign up with a 14-day free trial (subscription billing through Stripe when configured).
- Set weekly hours and block out days off. Learners can only book inside those hours.
- Set an hourly rate, the lesson lengths on offer (1, 1.5 or 2 hours), how often lessons can start, minimum notice and how far ahead learners can book.
- Choose how learners pay: cash, bank transfer (learners see your bank details and a payment reference), and/or card through Stripe Connect.
- Set a cancellation notice period and what a late cancellation costs (nothing, the full price, a fixed fee or a percentage), and write your own terms. Every version of the terms is kept, and each booking records which version the learner accepted.
- Share a booking link or email invites. Learners who sign up through it are linked to you.
- See the week's lessons and money owed, mark lessons paid, completed or no-show, cancel lessons, and waive late fees.
- Optional skills checklist (pre-filled with common UK driving skills) to record each learner's progress.

**Learners**
- Sign up through an instructor's link, then book instantly from the free times. The database itself refuses double bookings, so two learners can't take the same slot.
- Choose a payment method, accept the instructor's terms, and pay by card straight away if the instructor takes card payments.
- View, pay for and cancel lessons, with the late cancellation fee shown before they confirm.
- See their progress checklist when the instructor has turned it on.

**Notifications**
- Booking confirmations and cancellations by email and text, plus a reminder 24 hours before each lesson (an hourly job).

## Running it locally

1. Create a Supabase project and run the SQL in [`supabase/migrations`](supabase/migrations) (with the Supabase CLI, `supabase link` then `supabase db push`, or paste it into the SQL editor).
2. In Supabase, under Authentication > URL configuration, set the site URL to your app URL and add `<app url>/auth/confirm` as a redirect URL.
3. Copy `.env.example` to `.env.local` and fill in at least the Supabase values.
4. `npm install`, then `npm run dev` and open http://localhost:3000.

Checks: `npm test` (scheduling, time zone and money rules), `npm run db:check` (applies the migration to an in-memory Postgres and checks sign-up, linking and the double-booking block), `npm run typecheck`, `npm run lint`.

## Configuration

Only Supabase is required. Everything else switches on when its keys are present; until then the app hides that option or logs the message it would have sent.

| Variable | Needed for |
| --- | --- |
| `NEXT_PUBLIC_APP_URL` | Links in emails and Stripe redirects |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Everything (the new `sb_publishable_…` key also works, as `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side booking, cancellation and settings writes (or `SUPABASE_SECRET_KEY`) |
| `STRIPE_SECRET_KEY` | Card payments for lessons (Stripe Connect Express accounts for instructors) |
| `STRIPE_WEBHOOK_SECRET` | Subscription events from your platform account |
| `STRIPE_CONNECT_WEBHOOK_SECRET` | Lesson payments and account updates from connected accounts |
| `STRIPE_SUBSCRIPTION_PRICE_ID` | The monthly price instructors subscribe to |
| `RESEND_API_KEY`, `EMAIL_FROM` | Sending email |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` | Sending texts |
| `CRON_SECRET` | Protecting the reminder job |

For Stripe, point both a platform webhook and a Connect webhook at `/api/stripe/webhook`, listening for `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `account.updated` and `customer.subscription.*`.

## Deploying to Vercel

Import the repository, add the environment variables, and deploy. `vercel.json` schedules the reminder job hourly, which needs a Vercel Pro plan; on Hobby, change it to a daily schedule or call `/api/cron/reminders` from another scheduler with `Authorization: Bearer $CRON_SECRET`.

## How it's put together

- `supabase/migrations`: schema, row level security and the sign-up trigger. Each instructor belongs to a school (a one-person school for now), so multi-instructor schools can be added without reshaping the data.
- `src/lib/slots.ts`: works out bookable times from weekly hours, existing bookings, time off, notice and the booking window, in UK time including BST.
- `src/lib/bookings.ts`: validates and creates bookings, and applies the cancellation rules.
- `src/app/dashboard`: the instructor app. `src/app/student`: the learner app. `src/app/join/[slug]`: an instructor's booking link.
- Reads go through Supabase with row level security. Writes that carry business rules (booking, cancelling, payment status, settings such as the subscription status) happen on the server with the service role after the user has been checked.

## Not in this version yet

Multi-instructor schools, a public instructor directory, native apps and push notifications, automatic refunds, recurring block bookings, and package or prepaid-hours pricing.
