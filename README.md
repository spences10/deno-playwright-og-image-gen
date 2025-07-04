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

- `title` _(required)_ - Main title text (max 200 chars)
- `author` _(optional)_ - Author name (max 100 chars, default: "Anonymous")
- `website` _(optional)_ - Website domain (max 100 chars, default: "example.com")
- `theme` _(optional)_ - Color theme: `light` or `dark` (default: "light")

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
```

Clears both RAM and disk caches.

**Delete specific image:**

```
DELETE /cache/{cache-key}
```

Removes image from both RAM and disk caches.

## Deployment on Coolify

1. **Connect Repository** - Add your Git repository to Coolify
2. **Set Environment Variables** - Configure the environment variables listed above
3. **Deploy** - Coolify will automatically:
   - Use the official Playwright Docker image (browsers pre-installed)
   - Install dependencies with pnpm
   - Build and deploy your service

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

## Error Handling

The service includes comprehensive error handling:

- Parameter validation with detailed error messages
- Graceful Playwright shutdown on process termination
- Development vs production error responses
- Cross-platform browser compatibility

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
