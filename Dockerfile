FROM node:16-alpine3.17 AS builder
WORKDIR /app
COPY . ./
RUN npm ci
RUN npm run build

FROM node:16-alpine3.17
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/dist ./dist
EXPOSE 3000
CMD ["sh", "-c", "npm run migrate && npm run start:prod"]
