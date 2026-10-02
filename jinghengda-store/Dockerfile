FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY . .
RUN mkdir -p data uploads && chown -R node:node data uploads
USER node
EXPOSE 3000
CMD ["npm", "start"]
