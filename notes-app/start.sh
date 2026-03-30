#!/bin/bash

# Script to start notes-app PWA on HTTPS localhost:3002

cd "$(dirname "$0")"

echo "🚀 Запуск Notes App на https://localhost:3002"
echo "⏹️  Для остановки нажмите Ctrl+C"
echo ""

http-server --ssl --cert localhost+2.pem --key localhost+2-key.pem -p 3002 -c-1 &

# Открыть браузер (опционально)
# open https://localhost:3002

wait
