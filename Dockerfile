FROM node:12.18.1
WORKDIR /app
COPY ./server/ .
RUN npm install --quiet
CMD [ "node", "server.js" ]