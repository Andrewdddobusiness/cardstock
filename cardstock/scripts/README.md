# CardStock Database Utilities

This directory contains utility scripts for monitoring and managing the CardStock database and stock tracking system.

## Available Scripts

### Quick Stock Check (`quick-stock-check.ts`)
Fast overview of the stock monitoring system status.

**Usage:**
```bash
npm run stock:check
```

**What it shows:**
- Database overview (products, variants, snapshots, events)
- Recent activity (last 24 hours)
- Latest snapshots and events
- Products by retailer
- System health indicators

### Detailed Stock Check (`check-stock-updates.ts`)
Comprehensive analysis of stock updates and system state.

**Usage:**
```bash
npm run stock:detailed
```

**What it shows:**
- Full stock update summary
- Recent updates (last 24 hours) with detailed status
- Products needing attention (stale data)
- Data integrity check

### Add BigW Products (`add-bigw-products.ts`)
Script to bulk add Pokemon TCG products from BigW.

**Usage:**
```bash
npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/add-bigw-products.ts
```

## API Endpoints for Stock Monitoring

### Test Endpoint
```bash
# Basic health check
curl http://localhost:3000/api/stock/test

# Include sample data
curl http://localhost:3000/api/stock/test?data=true
```

### Stock Status Endpoint
```bash
# Get stock status (24 hours, 10 results)
curl http://localhost:3000/api/stock/status

# Custom timeframe and limit
curl http://localhost:3000/api/stock/status?hours=48&limit=20
```

## Understanding the Data

### Key Models
- **Product**: Items being tracked (Pokemon cards, etc.)
- **ProductVariant**: Specific variants of products
- **InventorySnapshot**: Point-in-time stock status
- **StockEvent**: Changes in stock status
- **StoreAvailability**: Store-level availability data

### Stock Status Types
- ✅ **IN STOCK**: Available for purchase online
- ❌ **OUT OF STOCK**: Not available
- 🔄 **PREORDER**: Available for pre-order
- 🏪 **IN STORE ONLY**: Only available in physical stores

### Event Types
- **STATUS_FLIP**: General status change
- **IN_STOCK**: Product came back in stock
- **OUT_OF_STOCK**: Product went out of stock
- **PRICE_DROP**: Price decreased

## Monitoring Workflow

1. **Check system health** with `npm run stock:check`
2. **Review detailed status** with `npm run stock:detailed`
3. **Monitor via API** using the `/api/stock/test` and `/api/stock/status` endpoints
4. **Run stock updates** via `/api/monitors/run` endpoint

## Troubleshooting

### No Recent Updates
If you see no recent snapshots or events:
1. Check if the monitoring system is running
2. Run manual stock check: `GET /api/monitors/run`
3. Verify product URLs are still valid

### Database Connection Issues
Ensure `.env.local` contains the correct `DATABASE_URL`:
```bash
DATABASE_URL="your_database_connection_string"
```

### Stale Products
Products showing no updates in 24+ hours may need:
- URL verification
- Retailer adapter updates
- Manual re-checking