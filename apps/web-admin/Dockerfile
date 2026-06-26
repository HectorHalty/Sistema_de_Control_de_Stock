# Build admin SPA standalone (no monorepo workspace deps) and serve with nginx
FROM node:20-alpine AS builder
WORKDIR /app
COPY apps/web-admin/package*.json ./
RUN npm install --no-audit --no-fund
COPY apps/web-admin ./
ARG VITE_API_URL=http://localhost:3001
ENV VITE_API_URL=$VITE_API_URL
RUN echo ">>> Building admin with VITE_API_URL=${VITE_API_URL}" && npm run build

FROM nginx:alpine
COPY apps/web-admin/nginx.conf /etc/nginx/conf.d/default.conf
COPY apps/web-admin/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
ENTRYPOINT ["/docker-entrypoint.sh"]
