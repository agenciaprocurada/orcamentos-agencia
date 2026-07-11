# Etapa 1: Build da aplicação
FROM node:20-alpine AS build

WORKDIR /app

# Copia os arquivos de dependência primeiro para garantir que o cache de npm intall é preservado se não for alterado
COPY package*.json ./

# Puppeteer é devDependency usado só localmente; sem isso o npm ci baixa
# ~170 MB de Chrome a cada build e estoura o disco do servidor (ENOSPC).
ENV PUPPETEER_SKIP_DOWNLOAD=true

# Instala as dependências (ci pra builds automatizados é preferível do que install diretamente)
RUN npm ci

# Copia o restante do código
COPY . .

# Injeção das variáveis de ambiente para o build do React/Vite
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
# Chave PÚBLICA VAPID (Web Push). É pública por natureza (vai no bundle), então
# tem um default embutido — funciona sem precisar configurar build arg no painel.
ARG VITE_VAPID_PUBLIC_KEY=BNn0nDbN3JJLjOoWCcKxKV9qxRDChacs-OWt4aJFBEuFhzjKD6u5zel9f8eZIN4JDN0jH9s2HZgP7PadxSo5A-M

# Torná-las disponíveis durante o processo de build do 'npm run build'
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
ENV VITE_VAPID_PUBLIC_KEY=$VITE_VAPID_PUBLIC_KEY

# Realiza o build (resultado vai para a pasta /dist)
RUN npm run build

# Etapa 2: Servir os arquivos através do Nginx
FROM nginx:alpine

# Removemos o app nginx padrão e copiamos nossa nova versão (React/Vite)
RUN rm -rf /usr/share/nginx/html/*
COPY --from=build /app/dist /usr/share/nginx/html

# Ajuste da configuração de URL para não quebrar após recarregar nas páginas do React Router (SPA)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# A porta padrão onde o nginx rodará dentro do container
EXPOSE 80

# Inicia o nginx
CMD ["nginx", "-g", "daemon off;"]
