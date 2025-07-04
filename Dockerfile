# Use the official Playwright image with Node.js and browsers pre-installed
FROM mcr.microsoft.com/playwright:v1.53.2-noble

# Set proper locale for Unicode support
ENV LANG=en_US.UTF-8
ENV LC_ALL=en_US.UTF-8
ENV LANGUAGE=en_US:en

# Install additional Unicode fonts for better emoji support
RUN apt-get update && apt-get install -y \
    fonts-noto-color-emoji \
    fonts-liberation \
    fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build the application
RUN pnpm run build

# Expose port
EXPOSE 3000

# Start the application
CMD ["pnpm", "start"]
