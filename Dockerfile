FROM node:20-alpine AS build
WORKDIR /app

COPY package*.json ./
COPY prisma ./
RUN npm install

ENV DATABASE_URL=postgresql://uvxbcrl7telmkbtsp4n4:bC1h38JpFxpbX3vgc6eShp5Dp74tBB@bjjjgtzlmgps6u3knk95-postgresql.services.clever-cloud.com:50013/bjjjgtzlmgps6u3knk95
RUN npx prisma migrate deploy

COPY . .
RUN npx prisma generate



EXPOSE 3000

ENV PORT=8080


RUN npm run build


FROM node:20-alpine AS production

WORKDIR /app
COPY --from=build /app .

CMD ["npm", "start"]

# final