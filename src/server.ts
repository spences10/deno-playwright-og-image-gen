import { Hono, Context } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { secureHeaders } from 'hono/secure-headers';
import { template_renderer } from './utils/template-renderer';
import { image_generator } from './utils/image-generator';
import { og_params } from './types/og-params';

const app = new Hono();
const template_renderer_instance = new template_renderer();
const image_generator_instance = new image_generator();

// Setup graceful shutdown
image_generator_instance.setup_shutdown_handlers();

// Middleware
app.use('*', logger());
app.use('*', secureHeaders());
app.use('*', cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://scottspence.com', 'https://www.scottspence.com'] 
    : '*',
  allowMethods: ['GET'],
  allowHeaders: ['Content-Type'],
}));

// Simple rate limiting for production (can be enhanced later)
if (process.env.NODE_ENV === 'production') {
  const request_counts = new Map<string, { count: number; reset_time: number }>();
  
  app.use('*', async (c: Context, next) => {
    const client_ip = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown';
    const now = Date.now();
    const window_ms = 60 * 1000; // 1 minute
    const max_requests = 60; // 60 requests per minute
    
    const client_data = request_counts.get(client_ip);
    
    if (!client_data || now > client_data.reset_time) {
      request_counts.set(client_ip, { count: 1, reset_time: now + window_ms });
      return next();
    }
    
    if (client_data.count >= max_requests) {
      return c.json({ 
        error: 'Too many requests',
        retry_after: Math.ceil((client_data.reset_time - now) / 1000)
      }, 429);
    }
    
    client_data.count++;
    return next();
  });
}

function validate_og_params(query: Record<string, string | undefined>): { valid: boolean; params?: og_params; error?: string } {
  const { title, author, website, theme } = query;

  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    return { valid: false, error: 'Title is required and must be a non-empty string' };
  }

  if (title.length > 200) {
    return { valid: false, error: 'Title must be 200 characters or less' };
  }

  if (author && (typeof author !== 'string' || author.length > 100)) {
    return { valid: false, error: 'Author must be a string of 100 characters or less' };
  }

  if (website && (typeof website !== 'string' || website.length > 100)) {
    return { valid: false, error: 'Website must be a string of 100 characters or less' };
  }

  if (theme && !['light', 'dark'].includes(theme)) {
    return { valid: false, error: 'Theme must be either "light" or "dark"' };
  }

  return {
    valid: true,
    params: {
      title: title.trim(),
      author: author?.trim() || 'Anonymous',
      website: website?.trim() || 'example.com',
      theme: (theme as 'light' | 'dark') || 'light'
    }
  };
}

// Routes
app.get('/', (c: Context) => {
  return c.json({
    service: 'Coolify OG Image Generator',
    version: '1.0.0',
    endpoints: {
      generate: '/og?title=Your%20Title&author=Author&website=example.com&theme=light',
      health: '/health'
    },
    documentation: {
      title: 'Required - The main title text (max 200 chars)',
      author: 'Optional - Author name (max 100 chars, default: Anonymous)',
      website: 'Optional - Website domain (max 100 chars, default: example.com)',
      theme: 'Optional - Color theme: light or dark (default: light)'
    }
  });
});

app.get('/og', async (c: Context) => {
  try {
    // Get query parameters
    const query = c.req.query();
    
    // Validate parameters
    const validation = validate_og_params(query);
    if (!validation.valid) {
      return c.json({ error: validation.error }, 400);
    }

    const params = validation.params!;

    // Generate cache key
    const cache_key = `${params.title}-${params.author}-${params.website}-${params.theme}`;
    
    // Set cache headers (1 hour)
    c.header('Cache-Control', 'public, max-age=3600, s-maxage=3600');
    c.header('Content-Type', 'image/png');
    c.header('X-Cache-Key', cache_key);

    // Render HTML template
    const html_content = template_renderer_instance.render_template('default', {
      title: params.title,
      author: params.author || 'Anonymous',
      website: params.website || 'example.com',
      theme: params.theme || 'light'
    });

    // Generate image
    const image_buffer = await image_generator_instance.generate_image(html_content, {
      width: 1200,
      height: 630,
      device_scale_factor: 2,
      format: 'png'
    });

    return c.body(image_buffer);

  } catch (error) {
    console.error('Error generating OG image:', error);
    return c.json({ 
      error: 'Internal server error while generating image',
      message: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    }, 500);
  }
});

// Health check endpoint
app.get('/health', (c: Context) => {
  return c.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    service: 'og-image-generator'
  });
});

// Start server
const port = Number(process.env.PORT) || 3000;

// For Node.js, we need to use the serve function
import { serve } from '@hono/node-server';

serve({
  fetch: app.fetch,
  port: port,
});

console.log(`🚀 OG Image Generator server running on port ${port}`);
console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
console.log(`🔗 Health check: http://localhost:${port}/health`);
console.log(`🖼️  Generate image: http://localhost:${port}/og?title=Hello%20World`);
