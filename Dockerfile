FROM node:20-alpine AS build
WORKDIR /app

COPY package*.json ./
COPY prisma ./
RUN npm install

COPY . .

EXPOSE 3000

ENV PORT=8080

RUN npm run build

FROM node:20-alpine AS production

WORKDIR /app
COPY --from=build /app .

CMD ["sh", "-c", "npx prisma migrate deploy && npx prisma generate && npm start"]

# final