# 构建阶段
# FROM node:18-alpine AS builder
# WORKDIR /app
# COPY package*.json ./
# RUN npm config set registry https://registry.npmmirror.com
# RUN npm install
# COPY . .
# RUN npm run build

# 生产环境阶段
FROM nginx:alpine
COPY ./dist /usr/share/nginx/html
COPY ./nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"] 