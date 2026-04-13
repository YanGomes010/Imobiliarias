FROM node:20 AS build

WORKDIR /app

ARG REACT_APP_N8N_WEBHOOK_URL
ARG REACT_APP_N8N_API_KEY

ENV REACT_APP_N8N_WEBHOOK_URL=$REACT_APP_N8N_WEBHOOK_URL
ENV REACT_APP_N8N_API_KEY=$REACT_APP_N8N_API_KEY

COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/build /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
