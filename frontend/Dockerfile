FROM node:24-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
ARG VITE_USE_MOCK_API=false
ENV VITE_USE_MOCK_API=${VITE_USE_MOCK_API}
ARG VITE_PHONE_PUBLIC_URL=
ARG VITE_PHONE_ICE_SERVERS=[]
ENV VITE_PHONE_PUBLIC_URL=${VITE_PHONE_PUBLIC_URL}
ENV VITE_PHONE_ICE_SERVERS=${VITE_PHONE_ICE_SERVERS}
ARG VITE_LEAD_ENDPOINT=
ENV VITE_LEAD_ENDPOINT=${VITE_LEAD_ENDPOINT}
RUN npm run build

FROM nginx:stable-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1/healthz || exit 1

CMD ["nginx", "-g", "daemon off;"]
