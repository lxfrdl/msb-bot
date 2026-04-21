FROM oven/bun:alpine AS base
WORKDIR /usr

# Install base utilities and locale support
RUN apk add --update --no-cache \
    tzdata \
    icu-data-full \
    icu-libs \
    musl-locales \
    musl-locales-lang \
    python3 \
    make \
    g++

# Set the timezone and locale
RUN ln -s /usr/share/zoneinfo/Europe/Brussels /etc/localtime
ENV TZ=Europe/Berlin
ENV LANG=de_DE.UTF-8 \
    LANGUAGE=de_DE:de \
    LC_ALL=de_DE.UTF-8

# Install dependencies
COPY package.json package.json
COPY bun.lock bun.lock
RUN bun install --frozen-lockfile

# Copy application files
ENV NODE_ENV=production
COPY drizzle.config.ts drizzle.config.ts
COPY ./src src

# Run the app
USER bun
EXPOSE 80/tcp
ENTRYPOINT [ "bun", "run", "src/index.js" ]

