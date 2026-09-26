#!/bin/sh
set -eu

site_file="${1:?请提供 Nginx 站点配置路径}"
server_name="${2:?请提供 HTTPS 站点域名}"
snippet=/etc/nginx/snippets/sfmc-qq-webhook.conf
backup="${site_file}.bak-$(date +%Y%m%d%H%M%S)"

test -f "$site_file"
install -m 0644 "$(dirname "$0")/nginx-webhook-location.conf" "$snippet"
cp -p "$site_file" "$backup"

python3 - "$site_file" "$server_name" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
server_name = sys.argv[2]
text = path.read_text()
include_line = "    include /etc/nginx/snippets/sfmc-qq-webhook.conf;\n"
if include_line not in text:
    marker = f"server_name {server_name};\n"
    if marker not in text:
        raise SystemExit(f"未找到站点 {server_name}")
    text = text.replace(marker, marker + include_line, 1)
    path.write_text(text)
PY

if ! nginx -t; then
    cp -p "$backup" "$site_file"
    exit 1
fi
systemctl reload nginx
printf 'Nginx 回调路径已安装；站点备份：%s\n' "$backup"
