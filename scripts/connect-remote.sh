#!/bin/sh
set -eu
if [ "$#" -ne 1 ]; then
  echo 'Usage: sh scripts/connect-remote.sh <remote-url>' >&2
  exit 2
fi
case "$1" in
  https://github.com/*|git@github.com:*) ;;
  *) echo 'Use a GitHub repository URL without embedded credentials.' >&2; exit 2 ;;
esac
if git remote get-url origin >/dev/null 2>&1; then
  echo 'origin already exists; inspect it instead of overwriting it.' >&2
  exit 1
fi
git remote add origin "$1"
printf '%s
' 'origin configured. Review staged content before pushing.'
