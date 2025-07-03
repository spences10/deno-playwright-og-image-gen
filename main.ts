import { serve } from "https://deno.land/std/http/server.ts";
import { chromium } from "playwright";

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

const PORT = parseInt(Deno.env.get("PORT") || "8000");

const server = serve(async (req) => {
  const url = new URL(req.url);
  
  if (url.pathname === "/api/generate") {
    try {
      console.log("Generating image...");
      
      // Default template data
      const template_data = {
        title: "Hello World",
        description: "OG Image Generator is Working!",
        backgroundColor: "#667eea",
        backgroundColorSecondary: "#764ba2",
        textColor: "white"
      };
      
      // Load and render template
      const template_content = await load_template("basic");
      const rendered_html = render_template(template_content, template_data);
      
      // Launch browser
      const browser = await chromium.launch();
      const page = await browser.newPage();
      
      // Set viewport to OG image size
      await page.setViewportSize({ width: 1200, height: 630 });
      
      // Load rendered HTML
      await page.setContent(rendered_html);
      
      // Take screenshot
      const screenshot = await page.screenshot({ 
        type: 'png',
        fullPage: false
      });
      
      await browser.close();
      
      console.log("Image generated successfully");
      
      return new Response(screenshot, {
        headers: { 
          "Content-Type": "image/png",
          "Cache-Control": "public, max-age=3600"
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
