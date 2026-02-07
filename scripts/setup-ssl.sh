#!/bin/bash

# ===========================================
# SSL Certificate Setup Script (Host Nginx)
# ===========================================
# Usage: sudo ./scripts/setup-ssl.sh your-domain.com your-email@example.com
#
# Prerequisites:
#   - Nginx installed on host
#   - Domain DNS pointing to this server
#   - Port 80 accessible from internet
#
# This script uses certbot with the nginx plugin for
# automatic SSL certificate management.

set -e

# Non-interactive mode for apt
export DEBIAN_FRONTEND=noninteractive
export APT_OPTS="-y -qq -o Dpkg::Options::=--force-confdef -o Dpkg::Options::=--force-confold"

DOMAIN="${1:-}"
EMAIL="${2:-}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log_success() { echo -e "${GREEN}✓ $1${NC}"; }
log_info() { echo -e "${YELLOW}→ $1${NC}"; }
log_error() { echo -e "${RED}✗ $1${NC}"; }
log_step() { echo -e "${CYAN}▶ $1${NC}"; }

# Check root
if [ "$EUID" -ne 0 ]; then
    log_error "Please run as root (sudo)"
    exit 1
fi

# Validate inputs
if [ -z "$DOMAIN" ] || [ -z "$EMAIL" ]; then
    echo "Usage: $0 <domain> <email>"
    echo "Example: $0 cms.example.com admin@example.com"
    exit 1
fi

echo ""
echo -e "${CYAN}══════════════════════════════════════════${NC}"
echo -e "${CYAN}  SSL Certificate Setup${NC}"
echo -e "${CYAN}══════════════════════════════════════════${NC}"
echo ""
echo "  Domain: $DOMAIN"
echo "  Email:  $EMAIL"
echo ""

# Step 1: Install certbot if not present
if ! command -v certbot &> /dev/null; then
    log_step "Installing Certbot..."
    apt-get update $APT_OPTS
    apt-get install $APT_OPTS certbot python3-certbot-nginx
    log_success "Certbot installed"
else
    log_info "Certbot already installed"
fi

# Step 2: Check if nginx is running
if ! systemctl is-active --quiet nginx; then
    log_error "Nginx is not running. Please start nginx first:"
    echo "  sudo systemctl start nginx"
    exit 1
fi

# Step 3: Request certificate (non-interactive)
log_step "Requesting SSL certificate..."

certbot --nginx \
    --non-interactive \
    --email "$EMAIL" \
    --agree-tos \
    --no-eff-email \
    --redirect \
    -d "$DOMAIN" \
    -d "www.$DOMAIN"

if [ $? -ne 0 ]; then
    log_error "Failed to obtain SSL certificate"
    echo ""
    echo "Troubleshooting tips:"
    echo "  1. Make sure DNS A records point to this server for both:"
    echo "     - $DOMAIN"
    echo "     - www.$DOMAIN"
    echo "  2. Make sure port 80 is accessible (check firewall: ufw status)"
    echo "  3. Check nginx is serving the domain: curl -I http://$DOMAIN"
    echo "  4. Try again in a few minutes (rate limiting)"
    exit 1
fi

log_success "SSL certificate obtained!"

# Step 4: Setup auto-renewal cron
log_step "Setting up auto-renewal..."

# Remove any existing certbot renew entries and add new one
(crontab -l 2>/dev/null | grep -v "certbot renew"; echo "0 3 * * * certbot renew --quiet --post-hook 'systemctl reload nginx'") | crontab -

log_success "Auto-renewal configured (runs daily at 3 AM)"

# Step 5: Test renewal
log_step "Testing renewal process..."
certbot renew --dry-run

if [ $? -eq 0 ]; then
    log_success "Renewal test passed"
else
    log_info "Renewal test had issues - certificate will still work"
fi

echo ""
echo -e "${GREEN}═══════════════════════════════════════════${NC}"
echo -e "${GREEN}  SSL Setup Complete!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════${NC}"
echo ""
echo "  Your site is now available at:"
echo "    https://${DOMAIN}"
echo "    https://www.${DOMAIN}"
echo ""
echo "  Certificate details:"
echo "    sudo certbot certificates"
echo ""
echo "  Certificate will auto-renew before expiry."
echo ""
echo -e "${GREEN}═══════════════════════════════════════════${NC}"
