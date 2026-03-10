# Etapa 1: Build da aplicação
FROM node:20-alpine as build

WORKDIR /app

# Copia os arquivos de dependência primeiro para garantir que o cache de npm intall é preservado se não for alterado
COPY package*.json ./

# Instala as dependências (ci pra builds automatizados é preferível do que install diretamente)
RUN npm ci

# Copia o restante do código
COPY . .

# Caso utilize variáveis de ambiente que precisam estar disponíveis no frontend, adicione-as aqui como build args:
# ARG VITE_SUPABASE_URL
# ARG VITE_SUPABASE_ANON_KEY
# ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
# ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY

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
