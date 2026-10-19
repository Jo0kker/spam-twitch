FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8788 EBS_DATA_PATH=/data/credentials.json
COPY package.json ./
COPY server ./server
COPY extension ./extension
COPY downloads ./downloads
RUN mkdir /data && chown node:node /data
USER node
VOLUME ["/data"]
EXPOSE 8788
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://127.0.0.1:8788/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "server/ebs.mjs"]
