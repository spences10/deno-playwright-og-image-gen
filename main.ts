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
    return new Response(`
      <html>
        <body style="font-family: Arial; padding: 40px;">
          <h1>OG Image Generator</h1>
          <p>Server is running!</p>
          <h2>Test the API:</h2>
          <ul>
            <li><a href="/api/generate" target="_blank">Generate Test Image</a></li>
            <li><a href="/health">Health Check</a></li>
          </ul>
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
