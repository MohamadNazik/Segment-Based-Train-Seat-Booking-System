FROM node:20-alpine AS builder
WORKDIR /src
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
RUN adduser -D -u 10014 appuser \
    && chown -R appuser:appuser /var/cache/nginx /var/run /var/log/nginx /run
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder --chown=appuser:appuser /src/dist /usr/share/nginx/html
USER appuser
EXPOSE 8080
