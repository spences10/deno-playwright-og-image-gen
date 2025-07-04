# Coolify OG Image Generator

A modern TypeScript-based Open Graph image generator service built with Hono and Puppeteer, designed for deployment on Coolify.

## Features

- 🚀 Modern Hono framework (fast and lightweight)
- 🎨 Customizable HTML/CSS templates
- 🖼️ High-quality image generation with Puppeteer
- 🔒 Built-in security headers and CORS
- ⚡ Rate limiting for production
- 📦 TypeScript support
- 🐳 Coolify deployment ready (no Docker files needed)

## API Endpoints

### Generate OG Image
```
GET /og?title=Your%20Title&author=Author&website=example.com&theme=light
```

**Parameters:**
- `title` (required): The main title text (max 200 chars)
- `author` (optional): Author name (max 100 chars, default: Anonymous)
- `website` (optional): Website domain (max 100 chars, default: example.com)
- `theme` (optional): Color theme - `light` or `dark` (default: light)

**Response:** PNG image (1200x630px)

### Health Check
```
GET /health
```

### Service Info
```
GET /
```

## Usage Example

From your consuming application:

```typescript
const og_image_url = (
  author: string,
  website: string,
  title: string,
) => {
  const params = {
    title,
    author,
    website: website || 'scottspence.com',
  }
  return `https://your-coolify-domain.com/og${object_to_query_params(params)}`
}

const seo_config = create_seo_config({
  title: `Reactions leaderboard - ${name}`,
  description: 'All of the most reacted to posts on the site.',
  open_graph_image: og_image_url(
    name,
    'scottspence.com',
    'Reactions leaderboard',
  ),
  url: url,
  slug: 'reactions-leaderboard',
})
```

## Development

### Prerequisites
- Node.js 18+
- pnpm (recommended) or npm

### Setup
```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Build for production
pnpm build

# Start production server
pnpm start
```

### Environment Variables
- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Environment (development/production)

## Template Customization

The OG image template is located in `src/templates/default.html`. You can:

1. Modify the HTML structure
2. Update CSS styles
3. Add new template variables in `src/utils/template-renderer.ts`
4. Create additional templates

### Template Variables
- `{{title}}` - Main title text
- `{{author}}` - Author name
- `{{website}}` - Website domain
- `{{background_colour}}` - Background color (theme-based)
- `{{text_colour}}` - Text color (theme-based)
- `{{accent_colour}}` - Accent color (theme-based)

## Deployment to Coolify

1. Push your code to a Git repository
2. In Coolify, create a new application
3. Connect your Git repository
4. Coolify will automatically detect the Node.js project
5. Set environment variables if needed
6. Deploy!

Coolify handles containerization automatically - no Docker files needed.

## Architecture

```
src/
├── server.ts              # Main Hono server
├── templates/
│   └── default.html       # HTML template for OG images
├── utils/
│   ├── image-generator.ts # Puppeteer image generation
│   └── template-renderer.ts # HTML template rendering
└── types/
    └── og-params.ts       # TypeScript interfaces
```

## Performance

- Browser instance pooling for efficient Puppeteer usage
- Template caching to reduce file I/O
- Response caching headers (1 hour)
- Rate limiting in production (60 requests/minute)

## Security

- Secure headers middleware
- Input sanitization to prevent XSS
- CORS configuration
- Rate limiting
- Parameter validation

## License

MIT
