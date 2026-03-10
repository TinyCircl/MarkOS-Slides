FROM node:22-bookworm-slim

WORKDIR /app

COPY package.json package.json

RUN npm install --include=optional
RUN npx playwright install --with-deps chromium

COPY src src

ENV NODE_ENV=production
ENV PORT=3210

EXPOSE 3210

CMD ["npm", "run", "start"]
