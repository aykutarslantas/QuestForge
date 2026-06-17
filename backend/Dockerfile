FROM node:20

WORKDIR /app

# Copy package configuration files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm ci

# Copy application source code
COPY tsconfig.json ./
COPY src ./src

# Generate Prisma client
RUN npx prisma generate

# Build typescript code
RUN npm run build

EXPOSE 4000

# We run migration and start in the entrypoint command or via a script
CMD ["sh", "-c", "npx prisma migrate deploy && npm start"]
