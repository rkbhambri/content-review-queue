# ----- Build stage -----
FROM node:22-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
# API base is relative; nginx proxies /api to the backend service.
ENV VITE_API_BASE=/api
RUN npm run build

# ----- Runtime stage (nginx) -----
FROM nginx:1.27-alpine AS runtime
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
HEALTHCHECK --interval=10s --timeout=3s --retries=5 \
  CMD wget -qO- http://127.0.0.1:80/ >/dev/null 2>&1 || exit 1
