# CardStock Sydney

Track Pokemon card stock across major Australian retailers.

## Features

- Real-time stock monitoring for Kmart, BIG W, and EB Games
- User authentication with email/password
- Clean dashboard showing stock status
- Per-store availability (when retailer APIs are discovered)
- Price tracking and change notifications
- Redis-based rate limiting (optional)
- Scheduled monitoring every 3 minutes

## Tech Stack

- **Next.js 15** - React framework with App Router
- **Prisma** - ORM with SQLite (dev) / Turso (prod)
- **NextAuth.js** - Authentication
- **Tailwind CSS** - Styling
- **Cheerio** - Web scraping
- **Redis** (Upstash) - Rate limiting
- **Vercel** - Hosting and cron jobs

## Getting Started

1. Install dependencies:
```bash
pnpm install
```

2. Set up environment variables:
```bash
cp .env.local.example .env.local
# Edit .env.local with your values
```

3. Run database migrations:
```bash
pnpm prisma migrate dev
pnpm prisma db seed
```

4. Start development server:
```bash
pnpm dev
```

## Deployment

1. Push to GitHub
2. Connect repository to Vercel
3. Add environment variables in Vercel dashboard:
   - `DATABASE_URL` (Turso connection string)
   - `AUTH_SECRET` (generate secure random string)
   - `AUTH_TRUST_HOST=true`
   - `UPSTASH_REDIS_REST_URL` (optional)
   - `UPSTASH_REDIS_REST_TOKEN` (optional)

4. Deploy!

## Extending

### Adding New Retailers

1. Create adapter in `lib/retailers/[retailer].ts`
2. Export from `lib/retailers/index.ts`
3. Add retailer to database seed

### Per-Store Availability

When you discover retailer pickup/availability APIs:
1. Update the retailer adapter to fetch store data
2. Return store availability in the `storeAvails` array
3. The normalizer will automatically create store records

### Adding Features

- Alert rules are already in the schema
- Email/Discord notifications can be added to `StockEvent` processing
- Admin UI for product management
- Analytics dashboard

## License

MIT