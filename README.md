# Coolify OG Image Generator

A modern TypeScript-based Open Graph image generator service built with Hono and Playwright, designed for deployment on Coolify.

## Features

- 🚀 **Fast & Efficient** - Hybrid RAM + disk caching with 24-hour TTL and smart promotion
- 🎨 **Customizable** - Support for light/dark themes and custom branding
- 🔒 **Production Ready** - Rate limiting, CORS configuration, and environment-based settings
- 📱 **Social Media Optimized** - Generates 1200x630 images perfect for Twitter, Facebook, LinkedIn
- 🛠️ **Cache Management** - Built-in endpoints for cache invalidation and monitoring
- 🐳 **Coolify Compatible** - Deploys seamlessly on Coolify with automatic Playwright browser installation
- 🏗️ **Multi-Architecture** - Works on both AMD64 and ARM64 platforms

## Quick Start

### Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
# Server Configuration
PORT=3000
NODE_ENV=production

# CORS Configuration - comma-separated list of allowed origins
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=60

# Image Generation & Caching
DEFAULT_CACHE_TTL=86400          # 24 hours (both RAM and disk cache)
HTTP_CACHE_TTL=86400             # 24 hours (browser/CDN cache)
IMAGE_CACHE_MAX_SIZE=100         # Maximum images in RAM cache (disk unlimited)

# Cache Management Authentication
ADMIN_TOKEN=your-secret-token-here
```

### Installation

```bash
# Install dependencies
pnpm install

# Install Playwright browsers (for local development)
pnpm dlx playwright install chromium

# Development
pnpm run dev

# Production build
pnpm run build
pnpm start
```

## API Usage

### Generate OG Image

```
GET /og?title=Your%20Title&author=Author&website=example.com&theme=light
```

**Parameters:**

- `title` _(required)_ - Main title text (max 200 chars) - **Note: Avoid emojis for best cross-platform compatibility**
- `author` _(optional)_ - Author name (max 100 chars, default: "Anonymous")
- `website` _(optional)_ - Website domain (max 100 chars, default: "example.com")
- `theme` _(optional)_ - Color theme: `light` or `dark` (default: "light")

**Best Practices:**
- Use descriptive text instead of emojis (e.g., "Rocket Launch" instead of 🚀)
- Keep titles concise and readable
- Test both light and dark themes for your content

**Example:**

```bash
curl "https://your-og-service.com/og?title=Hello%20World&author=Scott%20Spence&website=scottspence.com&theme=dark" \
  --output image.png
```

### Health Check

```
GET /health
```

Returns service status and cache information.

### Cache Management

**View cache status:**

```
GET /cache
```

Returns both RAM and disk cache statistics and keys.

**Clear all caches:**

```
DELETE /cache
Authorization: Bearer your-admin-token
```

Clears both RAM and disk caches. Requires authentication.

**Delete specific image:**

```
DELETE /cache/{cache-key}
Authorization: Bearer your-admin-token
```

Removes image from both RAM and disk caches. Requires authentication.

## Deployment on Coolify

1. **Connect Repository** - Add your Git repository to Coolify
2. **Set Environment Variables** - Configure the environment variables listed above
3. **Configure Persistent Storage** (Optional) - To persist cache across deployments:
   - Add Volume Mount in Coolify storage settings
   - Source Path: `/data/coolify/applications/YOUR_APP_ID/cache`
   - Destination Path: `/app/cache`
4. **Deploy** - Coolify will automatically:
   - Use the official Playwright Docker image (browsers pre-installed)
   - Install dependencies with pnpm
   - Build and deploy your service

### CDN Optimization with Cloudflare

For optimal performance with social media crawlers, configure Cloudflare Cache Rules:

1. **Create Cache Rule** in Cloudflare Dashboard → Caching → Cache Rules
2. **Filter Expression**: `(http.request.uri contains "/og")`
3. **Cache Settings**:
   - **Cache Eligibility**: Eligible for cache
   - **Edge TTL**: Ignore cache-control header → 1 day
   - **Browser TTL**: Override origin → 2 hours
   - **Cache Key**: Leave defaults (includes all query parameters)

This setup provides:
- **Instant Global Delivery**: Images cached at Cloudflare edge locations worldwide
- **Reduced Server Load**: Popular images served from CDN without hitting your server
- **Improved OG Tester Compatibility**: Sub-second response times for social media crawlers

### Cache Configuration for Different Site Sizes

For small sites (500 pages or less):
```bash
DEFAULT_CACHE_TTL=31536000       # 1 year (nearly permanent)
HTTP_CACHE_TTL=31536000          # 1 year for browsers/CDNs
IMAGE_CACHE_MAX_SIZE=500         # Match your page count
```

For medium sites (500-5000 pages):
```bash
DEFAULT_CACHE_TTL=2592000        # 30 days
HTTP_CACHE_TTL=2592000           # 30 days for browsers/CDNs
IMAGE_CACHE_MAX_SIZE=1000        # Adjust based on memory
```

For large sites (5000+ pages):
```bash
DEFAULT_CACHE_TTL=86400          # 24 hours (default)
HTTP_CACHE_TTL=86400             # 24 hours for browsers/CDNs
IMAGE_CACHE_MAX_SIZE=100         # Keep RAM usage low
```

The project uses a custom Dockerfile with the official Microsoft Playwright image (`mcr.microsoft.com/playwright:v1.53.1-noble`) for maximum reliability and performance.

### Why Playwright?

This service uses Playwright instead of Puppeteer for several key advantages:

- **Cross-Platform Support** - Works reliably on both AMD64 and ARM64 architectures
- **Container-Optimized** - Designed specifically for containerized environments
- **Simplified Dependencies** - Automatic browser installation with system dependencies
- **Better Error Handling** - More robust browser process management
- **Production Ready** - Extensively tested in cloud deployment scenarios

## Performance

### Caching Strategy

- **RAM Cache**: 24 hours (configurable via `DEFAULT_CACHE_TTL`)

  - Stores 100 most recent images in memory (~5-20MB)
  - Instant access for frequently requested images
  - Lost on server restart

- **Disk Cache**: 24 hours (configurable via `DEFAULT_CACHE_TTL`)

  - Unlimited storage on filesystem
  - Persistent across server restarts
  - Automatic promotion to RAM cache on access

- **HTTP Cache**: 24 hours (configurable via `HTTP_CACHE_TTL`)
  - Browsers and CDNs cache responses
  - Industry standard duration for OG images

### Cache Pre-warming

The service includes intelligent cache pre-warming on startup:

- **Dynamic Popular Content**: Automatically fetches popular posts from connected sites
- **RAM Cache Promotion**: Pre-loads most-viewed content from disk to RAM
- **Zero Maintenance**: No hardcoded lists to maintain - adapts based on real traffic data
- **Faster Social Sharing**: Popular content serves instantly to OG crawlers

### Cache Flow

1. **Request** → Check RAM cache (fastest)
2. **RAM miss** → Check disk cache
3. **Disk hit** → Load from disk + promote to RAM
4. **Disk miss** → Generate new image + save to both caches

### Cache Headers

All responses include debug headers:

- `X-Cache-Key` - Unique identifier for the image
- `X-Cache-Status` - Cache hit status:
  - `HIT-RAM` - Served from memory (fastest)
  - `HIT-DISK` - Served from disk cache
  - `MISS` - Generated new image
- `Content-Length` - Image size for faster crawler processing

## Development

### Project Structure

```
src/
├── server.ts                 # Main application server
├── types/
│   └── og-params.ts         # TypeScript interfaces
├── utils/
│   ├── image-generator.ts   # Playwright image generation
│   └── template-renderer.ts # HTML template rendering
└── templates/
    └── default.html         # OG image template
```

### Adding New Templates

1. Create a new HTML file in `src/templates/`
2. Update the template renderer to support the new template
3. The template receives: `title`, `author`, `website`, `theme`

### Local Development

```bash
# Watch mode with hot reload
pnpm run dev

# Test image generation
curl "http://localhost:3000/og?title=Test" --output test.png

# Check cache status
curl "http://localhost:3000/cache"
```

## Rate Limiting

Production deployments include rate limiting:

- **Window**: 1 minute (configurable)
- **Max Requests**: 60 per window (configurable)
- **Based on**: Client IP address

## Troubleshooting

### OG Image Testers Showing "Broken" Images

If OG image testing tools show broken images but social platforms work correctly:

**Common Causes:**
- **Initial Generation Delay**: First-time image generation takes 2-3 seconds
- **Tester Timeouts**: Many OG testers have very short timeout periods (2-5 seconds)
- **Cache Miss**: Image not pre-warmed or evicted from cache

**Solutions:**
1. **CDN Setup**: Configure Cloudflare Cache Rules (see CDN Optimization section)
2. **Pre-warming**: Popular content is automatically pre-warmed on service restart
3. **Manual Pre-warm**: Visit the OG URL directly to cache before sharing

**Why Social Platforms Work Better:**
- Longer timeout periods (10-30 seconds)
- Better retry logic
- More patient crawling behavior

### Performance Monitoring

Monitor service performance using the built-in logging:

```bash
# View cache hit/miss logs
docker logs your-container-name | grep "Cache hit\|Generated fresh"

# Example output:
✅ Cache hit (ram): My Post Title - 15ms
🔄 Generated fresh: New Post Title - 2341ms
```

Response time guidelines:
- **RAM hits**: < 50ms (excellent)
- **Disk hits**: 50-200ms (good)
- **Fresh generation**: 2000-4000ms (normal for first request)

## Error Handling

The service includes comprehensive error handling:

- Parameter validation with detailed error messages
- Graceful Playwright shutdown on process termination
- Development vs production error responses
- Cross-platform browser compatibility
- Automatic retry logic for failed image generation

## License

MIT - See LICENSE file for details

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## Support

For issues and questions:

- Create an issue on GitHub
- Check the health endpoint: `/health`
- Review cache status: `/cache`
