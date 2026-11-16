#!/bin/sh
set -eu
echo "smoke: $ENDPOINT"
curl -fsS "$ENDPOINT" | grep -q '"ok":true'
echo "smoke: ok"
