#!/bin/bash
# Double-click this file on macOS to launch OC Freeway Rush in your browser.
cd "$(dirname "$0")"
if [ -d "/Applications/Google Chrome.app" ]; then
  open -a "Google Chrome" index.html
else
  open index.html
fi
