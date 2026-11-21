FROM node:20

ARG TZ
ENV TZ="$TZ"

ARG CLAUDE_CODE_VERSION=latest

# Dev tools plus firewall dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
  less git procps sudo fzf zsh man-db unzip gnupg2 gh \
  iptables ipset iproute2 dnsutils aggregate jq nano vim curl ca-certificates \
  ffmpeg sox libsox-fmt-all python3 python3-pip python3-venv \
  && apt-get clean && rm -rf /var/lib/apt/lists/*

# Chromium system libraries for optional Playwright testing (needs root, so done
# at build time while the network is open). Browsers themselves are downloaded
# later by the node user via `npx playwright install chromium`.
RUN npx -y playwright install-deps chromium \
  && apt-get clean && rm -rf /var/lib/apt/lists/* /root/.npm

# Persist command history
RUN mkdir /commandhistory && touch /commandhistory/.bash_history && chown -R node /commandhistory

ENV DEVCONTAINER=true

# Workspace and config dirs
RUN mkdir -p /workspace /home/node/.claude && chown -R node:node /workspace /home/node/.claude

WORKDIR /workspace

# Global npm packages for the node user (create the prefix as root first)
RUN mkdir -p /usr/local/share/npm-global && chown -R node:node /usr/local/share/npm-global
USER node
ENV NPM_CONFIG_PREFIX=/usr/local/share/npm-global
ENV PATH=$PATH:/usr/local/share/npm-global/bin
ENV SHELL=/bin/zsh
ENV EDITOR=nano
ENV VISUAL=nano

RUN npm install -g @anthropic-ai/claude-code@${CLAUDE_CODE_VERSION}

# Copy and set up firewall script (root-owned; node may only run it via sudo)
COPY init-firewall.sh /usr/local/bin/init-firewall.sh
USER root
RUN chmod +x /usr/local/bin/init-firewall.sh && \
  echo "node ALL=(root) NOPASSWD: /usr/local/bin/init-firewall.sh" > /etc/sudoers.d/node-firewall && \
  chmod 0440 /etc/sudoers.d/node-firewall
USER node
