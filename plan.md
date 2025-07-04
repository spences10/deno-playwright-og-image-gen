# Open Graph Image Generator - Implementation Plan

## Overview
Create a TypeScript-based OG image generator service that uses Puppeteer to render HTML templates into images, deployable to Coolify.

## Architecture

### Technology Stack
- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js (simple, well-documented)
- **Image Generation**: Puppeteer (headless Chrome)
- **Template Engine**: HTML/CSS with dynamic content injection
- **Deployment**: Coolify (auto-containerisation)

### Project Structure
```
coolify-og-image-gen/
├── src/
│   ├── server.ts              # Main Express server
│   ├── routes/
│   │   └── og.ts              # OG image generation endpoint
│   ├── templates/
│   │   ├── default.html       # HTML template for OG images
│   │   └── styles.css         # CSS styling for template
│   ├── utils/
│   │   ├── image-generator.ts # Puppeteer image generation logic
│   │   └── template-renderer.ts # HTML template rendering
│   └── types/
│       └── og-params.ts       # TypeScript interfaces
├── package.json
├── tsconfig.json
├── .gitignore
└── README.md
```

## API Design

### Endpoint: `GET /og`
**Query Parameters:**
- `title` (required): The main title text
- `author` (optional): Author name
- `website` (optional): Website domain (default: provided domain)
- `theme` (optional): Color theme (light/dark)

**Response:**
- Content-Type: `image/png`
- Generated OG image (1200x630px - standard OG dimensions)

### Example Usage
```
GET /og?title=My%20Blog%20Post&author=Scott%20Spence&website=scottspence.com
```

## Implementation Details

### 1. HTML Template Features
- Responsive design that works at 1200x630px
- Clean, professional typography
- Configurable color themes
- Support for long titles with text wrapping
- Author and website branding areas

### 2. Image Generation Process
1. Accept query parameters
2. Validate and sanitise input
3. Inject parameters into HTML template
4. Launch Puppeteer browser instance
5. Render HTML to image
6. Return image as response
7. Clean up browser resources

### 3. Performance Optimisations
- Browser instance pooling/reuse
- Template caching
- Response caching headers
- Graceful error handling

### 4. Security Considerations
- Input sanitisation to prevent XSS
- Rate limiting
- Parameter validation
- Safe HTML rendering

## Deployment to Coolify

### Requirements
- `package.json` with start script
- Environment variables for configuration
- Health check endpoint
- Proper error handling and logging

### Environment Variables
- `PORT` (default: 3000)
- `NODE_ENV` (production/development)
- `BROWSER_EXECUTABLE_PATH` (for Puppeteer in containers)

## Development Workflow

1. **Setup**: Initialize TypeScript project with dependencies
2. **Core**: Implement basic Express server and OG endpoint
3. **Template**: Create HTML template with CSS styling
4. **Generator**: Implement Puppeteer image generation
5. **Testing**: Test with various parameter combinations
6. **Optimisation**: Add caching and performance improvements
7. **Deployment**: Configure for Coolify deployment

## Next Steps
1. Initialize the project structure
2. Set up TypeScript configuration
3. Install dependencies (Express, Puppeteer, etc.)
4. Implement the core server and OG generation logic
5. Create the HTML template with styling
6. Test the complete workflow
7. Prepare for Coolify deployment
