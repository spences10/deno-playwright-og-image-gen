import { serve } from "https://deno.land/std/http/server.ts";
import { crypto } from "https://deno.land/std/crypto/mod.ts";

// In-memory cache for generated images
const imageCache = new Map<string, string>();

// Simple template renderer
function render_template(template_content: string, data: Record<string, string>): string {
  let rendered = template_content;
  for (const [key, value] of Object.entries(data)) {
    const placeholder = `{{${key}}}`;
    rendered = rendered.replaceAll(placeholder, value);
  }
  return rendered;
}

// Load template file
async function load_template(template_name: string): Promise<string> {
  const template_path = `./templates/${template_name}.html`;
  return await Deno.readTextFile(template_path);
}

// Generate cache key from template data
function generate_cache_key(template_data: Record<string, string>): string {
  const sorted_data = Object.keys(template_data)
    .sort()
    .reduce((result, key) => {
      result[key] = template_data[key];
      return result;
    }, {} as Record<string, string>);
  
  const data_string = JSON.stringify(sorted_data);
  const hash = crypto.subtle.digestSync("SHA-256", new TextEncoder().encode(data_string));
  return Array.from(new Uint8Array(hash))
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
}

const PORT = parseInt(Deno.env.get("PORT") || "8000");

const server = serve(async (req) => {
  const url = new URL(req.url);
  
  if (url.pathname === "/api/generate") {
    try {
      console.log("Generating image...");
      
      // Extract query parameters
      const params = new URLSearchParams(url.search);
      
      // Default template data with query parameter overrides
      const template_data = {
        title: params.get("title") || "Hello World",
        description: params.get("description") || "OG Image Generator is Working!",
        author: params.get("author") || "",
        website: params.get("website") || "",
        backgroundColor: params.get("backgroundColor") || "#667eea",
        backgroundColorSecondary: params.get("backgroundColorSecondary") || "#764ba2",
        textColor: params.get("textColor") || "white"
      };
      
      // Generate cache key
      const cache_key = generate_cache_key(template_data);
      
      // Check if HTML is already cached
      if (imageCache.has(cache_key)) {
        console.log("Returning cached HTML");
        const cached_html = imageCache.get(cache_key)!;
        return new Response(cached_html, {
          headers: { 
            "Content-Type": "text/html",
            "Cache-Control": "public, max-age=2592000"
          }
        });
      }
      
      // Load and render HTML template
      const template_content = await load_template("basic");
      const html = render_template(template_content, template_data);
      
      // Cache the generated HTML
      imageCache.set(cache_key, html);
      
      console.log("HTML generated successfully");
      
      return new Response(html, {
        headers: { 
          "Content-Type": "text/html",
          "Cache-Control": "public, max-age=2592000"
        }
      });
      
    } catch (error) {
      console.error("Error generating image:", error);
      return new Response("Error generating image", { status: 500 });
    }
  }
  
  // Health check endpoint
  if (url.pathname === "/health") {
    return new Response("OK", { status: 200 });
  }
  
  // Root endpoint with instructions
  if (url.pathname === "/") {
    const ogImageUrl = `${url.protocol}//${url.host}/api/generate?title=OG%20Image%20Generator&description=Beautiful%20HTML%20OG%20images%20with%20Deno&author=Scott%20Spence&website=og.scott.garden`;
    
    return new Response(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>OG Image Generator - Beautiful HTML OG Images</title>
          <meta name="description" content="Generate beautiful OG images using HTML templates with Deno">
          
          <!-- Open Graph / Facebook -->
          <meta property="og:type" content="website">
          <meta property="og:url" content="${url.protocol}//${url.host}/">
          <meta property="og:title" content="OG Image Generator - Beautiful HTML OG Images">
          <meta property="og:description" content="Generate beautiful OG images using HTML templates with Deno">
          <meta property="og:image" content="${ogImageUrl}">
          
          <!-- Twitter -->
          <meta property="twitter:card" content="summary_large_image">
          <meta property="twitter:url" content="${url.protocol}//${url.host}/">
          <meta property="twitter:title" content="OG Image Generator - Beautiful HTML OG Images">
          <meta property="twitter:description" content="Generate beautiful OG images using HTML templates with Deno">
          <meta property="twitter:image" content="${ogImageUrl}">
          
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; }
            .hero { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px; border-radius: 12px; margin-bottom: 40px; }
            .links { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin: 30px 0; }
            .link-card { border: 1px solid #e0e0e0; padding: 20px; border-radius: 8px; text-decoration: none; color: inherit; }
            .link-card:hover { background: #f5f5f5; }
            .examples { margin: 40px 0; }
            .example { margin: 20px 0; padding: 15px; background: #f8f9fa; border-radius: 8px; }
            code { background: #e9ecef; padding: 2px 6px; border-radius: 4px; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="hero">
            <h1>🖼️ OG Image Generator</h1>
            <p>Beautiful, modern OG images using HTML templates powered by Deno</p>
          </div>
          
          <div class="links">
            <a href="/api/generate" target="_blank" class="link-card">
              <h3>🎨 Default Template</h3>
              <p>See the default OG image template</p>
            </a>
            
            <a href="/health" class="link-card">
              <h3>💚 Health Check</h3>
              <p>Check server status</p>
            </a>
            
            <a href="/demo" class="link-card">
              <h3>🚀 Demo Page</h3>
              <p>Test page with OG meta tags</p>
            </a>
          </div>
          
          <div class="examples">
            <h2>📝 API Examples</h2>
            
            <div class="example">
              <h3>Blog Post</h3>
              <code>/api/generate?title=My%20Blog%20Post&description=Learn%20something%20amazing&author=Your%20Name&website=yoursite.com</code>
            </div>
            
            <div class="example">
              <h3>Custom Colors</h3>
              <code>/api/generate?title=Dark%20Theme&backgroundColor=%23000000&backgroundColorSecondary=%23333333&textColor=%23ffffff</code>
            </div>
            
            <div class="example">
              <h3>Tech Article</h3>
              <code>/api/generate?title=Deno%20Guide&description=Modern%20JavaScript%20runtime&author=Developer&website=dev.to</code>
            </div>
          </div>
          
          <footer style="margin-top: 60px; padding-top: 20px; border-top: 1px solid #e0e0e0; text-align: center; color: #666;">
            <p>Built with Deno • <a href="https://github.com/your-repo">View Source</a></p>
          </footer>
        </body>
      </html>
    `, {
      headers: { "Content-Type": "text/html" }
    });
  }
  
  // Demo page endpoint
  if (url.pathname === "/demo") {
    const ogImageUrl = `${url.protocol}//${url.host}/api/generate?title=Demo%20Page&description=Testing%20OG%20image%20generation%20with%20social%20media%20previews&author=Scott%20Spence&website=og.scott.garden`;
    
    return new Response(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Demo Page - OG Image Test</title>
          <meta name="description" content="Testing OG image generation with social media previews">
          
          <!-- Open Graph / Facebook -->
          <meta property="og:type" content="article">
          <meta property="og:url" content="${url.protocol}//${url.host}/demo">
          <meta property="og:title" content="Demo Page - OG Image Test">
          <meta property="og:description" content="Testing OG image generation with social media previews">
          <meta property="og:image" content="${ogImageUrl}">
          
          <!-- Twitter -->
          <meta property="twitter:card" content="summary_large_image">
          <meta property="twitter:url" content="${url.protocol}//${url.host}/demo">
          <meta property="twitter:title" content="Demo Page - OG Image Test">
          <meta property="twitter:description" content="Testing OG image generation with social media previews">
          <meta property="twitter:image" content="${ogImageUrl}">
          
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px; max-width: 600px; margin: 0 auto; }
            .card { border: 1px solid #e0e0e0; padding: 30px; border-radius: 12px; background: white; }
            .og-preview { margin: 30px 0; padding: 20px; background: #f8f9fa; border-radius: 8px; }
            img { max-width: 100%; border-radius: 8px; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>🎯 Demo Page</h1>
            <p>This page uses your OG image generator for social media previews!</p>
            
            <div class="og-preview">
              <h3>Generated OG Image:</h3>
              <img src="${ogImageUrl}" alt="Generated OG Image" />
              <p><small>This is what appears when you share this page on social media</small></p>
            </div>
            
            <h3>🧪 Test this page:</h3>
            <ul>
              <li>📘 <a href="https://developers.facebook.com/tools/debug/" target="_blank">Facebook Debugger</a></li>
              <li>🐦 <a href="https://cards-dev.twitter.com/validator" target="_blank">Twitter Card Validator</a></li>
              <li>💼 <a href="https://www.linkedin.com/post-inspector/" target="_blank">LinkedIn Post Inspector</a></li>
              <li>📊 <a href="https://opengraph.xyz/" target="_blank">OpenGraph.xyz</a></li>
            </ul>
            
            <p><a href="/">← Back to home</a></p>
          </div>
        </body>
      </html>
    `, {
      headers: { "Content-Type": "text/html" }
    });
  }
  
  return new Response("404 Not Found", { status: 404 });
}, { port: PORT });

console.log("🚀 OG Image Generator starting...");
console.log(`📍 Server running on http://localhost:${PORT}`);
console.log(`🖼️  Test image: http://localhost:${PORT}/api/generate`);
console.log(`❤️  Health check: http://localhost:${PORT}/health`);
