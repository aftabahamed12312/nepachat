FROM node:20-alpine
WORKDIR /app
COPY server/package*.json ./
RUN npm ci --omit=dev --no-audit
COPY server/src ./src
ENV PORT=4000
EXPOSE 4000
CMD ["node", "src/index.js"]
