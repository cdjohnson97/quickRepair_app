# Front web React (Vite) servi par nginx.
# Build : docker build -t fixeo-web --build-arg VITE_API_URL=https://api.exemple.fr/api .
# Les variables VITE_* sont intégrées au moment du build (elles finissent dans le JS du navigateur :
# n'y mettre que des valeurs publiques).

FROM node:24-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG VITE_API_URL=http://localhost:3000/api
ARG VITE_EMAILJS_SERVICE_ID=
ARG VITE_EMAILJS_TEMPLATE_ID=
ARG VITE_EMAILJS_PUBLIC_KEY=
ENV VITE_API_URL=$VITE_API_URL \
    VITE_EMAILJS_SERVICE_ID=$VITE_EMAILJS_SERVICE_ID \
    VITE_EMAILJS_TEMPLATE_ID=$VITE_EMAILJS_TEMPLATE_ID \
    VITE_EMAILJS_PUBLIC_KEY=$VITE_EMAILJS_PUBLIC_KEY
RUN npm run build

FROM nginx:1.29-alpine AS runtime
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD wget -qO- http://localhost/ >/dev/null || exit 1
