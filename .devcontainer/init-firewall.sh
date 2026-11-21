#!/bin/bash
# Default-deny outbound firewall with a domain whitelist.
# Based on Anthropic's reference devcontainer. Edit ALLOWED_DOMAINS to taste.
set -euo pipefail
IFS=$'\n\t'

ALLOWED_DOMAINS=(
  "api.anthropic.com"
  "statsig.com"
  "sentry.io"
  "registry.npmjs.org"
  "marketplace.visualstudio.com"
  "vscode.blob.core.windows.net"
  "update.code.visualstudio.com"
  "pypi.org"
  "files.pythonhosted.org"
  # GitHub web/api/git ranges are added separately; these serve raw/release files
  "github.com"
  "codeload.github.com"
  "raw.githubusercontent.com"
  "objects.githubusercontent.com"
  # OS package mirrors (Debian-based image)
  "deb.debian.org"
  "security.debian.org"
  # Audio sourcing
  "kenney.nl"
  "opengameart.org"
  # Playwright browser downloads (optional)
  "cdn.playwright.dev"
  "playwright.download.prss.microsoft.com"
)

# Freesound is allowed only when started with --freesound (i.e. an API key is set)
if [ "${1:-}" = "--freesound" ]; then
  ALLOWED_DOMAINS+=("freesound.org" "cdn.freesound.org")
fi

# 1. Preserve Docker's internal DNS NAT rules, then flush everything else
DOCKER_DNS_RULES=$(iptables-save -t nat | grep "127\.0\.0\.11" || true)

iptables -F
iptables -X
iptables -t nat -F
iptables -t nat -X
iptables -t mangle -F
iptables -t mangle -X
ipset destroy allowed-domains 2>/dev/null || true

if [ -n "$DOCKER_DNS_RULES" ]; then
  iptables -t nat -N DOCKER_OUTPUT 2>/dev/null || true
  iptables -t nat -N DOCKER_POSTROUTING 2>/dev/null || true
  echo "$DOCKER_DNS_RULES" | xargs -L 1 iptables -t nat
fi

# 2. Allow DNS, localhost (before restrictions)
iptables -A OUTPUT -p udp --dport 53 -j ACCEPT
iptables -A INPUT -p udp --sport 53 -j ACCEPT
iptables -A OUTPUT -p tcp --dport 22 -j ACCEPT
iptables -A INPUT -p tcp --sport 22 -m state --state ESTABLISHED -j ACCEPT
iptables -A INPUT -i lo -j ACCEPT
iptables -A OUTPUT -o lo -j ACCEPT

ipset create allowed-domains hash:net

# 3. GitHub IP ranges (from the meta API)
echo "Fetching GitHub IP ranges..."
gh_ranges=$(curl -s https://api.github.com/meta)
if [ -z "$gh_ranges" ] || ! echo "$gh_ranges" | jq -e '.web and .api and .git' >/dev/null; then
  echo "ERROR: Failed to fetch valid GitHub IP ranges" >&2
  exit 1
fi
while read -r cidr; do
  if [[ ! "$cidr" =~ ^[0-9]{1,3}(\.[0-9]{1,3}){3}/[0-9]{1,2}$ ]]; then
    echo "ERROR: Invalid CIDR from GitHub meta: $cidr" >&2
    exit 1
  fi
  ipset add -exist allowed-domains "$cidr"
done < <(echo "$gh_ranges" | jq -r '(.web + .api + .git)[]' | aggregate -q)

# 4. Resolve whitelisted domains
for domain in "${ALLOWED_DOMAINS[@]}"; do
  echo "Resolving $domain..."
  ips=$(dig +noall +answer A "$domain" | awk '$4 == "A" {print $5}')
  if [ -z "$ips" ]; then
    echo "WARNING: Failed to resolve $domain - skipping" >&2
    continue
  fi
  while read -r ip; do
    if [[ ! "$ip" =~ ^[0-9]{1,3}(\.[0-9]{1,3}){3}$ ]]; then
      echo "ERROR: Invalid IP for $domain: $ip" >&2
      exit 1
    fi
    ipset add -exist allowed-domains "$ip"
  done <<< "$ips"
done

# 5. Allow the host network (needed for VS Code <-> container communication)
HOST_IP=$(ip route | grep default | cut -d" " -f3)
if [ -z "$HOST_IP" ]; then
  echo "ERROR: Failed to detect host IP" >&2
  exit 1
fi
HOST_NETWORK=$(echo "$HOST_IP" | sed "s/\.[0-9]*$/.0\/24/")
iptables -A INPUT -s "$HOST_NETWORK" -j ACCEPT
iptables -A OUTPUT -d "$HOST_NETWORK" -j ACCEPT

# 6. Default-deny, then allow established + whitelisted
iptables -P INPUT DROP
iptables -P FORWARD DROP
iptables -P OUTPUT DROP
iptables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT
iptables -A OUTPUT -m state --state ESTABLISHED,RELATED -j ACCEPT
iptables -A OUTPUT -m set --match-set allowed-domains dst -j ACCEPT
# Reject (not drop) everything else so failures are immediate
iptables -A OUTPUT -j REJECT --reject-with icmp-admin-prohibited

# 7. Verify
echo "Verifying firewall..."
if curl --connect-timeout 5 https://example.com >/dev/null 2>&1; then
  echo "ERROR: firewall verification failed - able to reach https://example.com" >&2
  exit 1
fi
if ! curl --connect-timeout 5 https://api.github.com/zen >/dev/null 2>&1; then
  echo "ERROR: firewall verification failed - unable to reach https://api.github.com" >&2
  exit 1
fi
echo "Firewall configured successfully."
