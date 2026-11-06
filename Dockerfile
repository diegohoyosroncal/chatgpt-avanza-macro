FROM nginx:alpine

COPY avanza_macro.user.js avanza_macro_maestro_v4.user.js macro-registry.json /usr/share/nginx/html/
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
