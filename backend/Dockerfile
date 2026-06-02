FROM node:20-alpine
RUN apk add --no-cache openssl python3 make g++
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npx prisma generate
RUN npm run build
EXPOSE 3001
CMD ["sh", "-c", "echo '[START] migrating...' && npx prisma migrate deploy && echo '[START] running server...' && node dist/index.js"]
