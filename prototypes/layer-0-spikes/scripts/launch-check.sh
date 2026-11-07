#!/bin/sh
# Launch a packaged app binary, wait for the renderer's DB log line, check the process
# is still alive, optionally screenshot, then quit. Usage: launch-check.sh <binary> <log> [png]
BIN="$1"; LOG="$2"; PNG="$3"
"$BIN" > "$LOG" 2>&1 &
PID=$!
i=0
while [ $i -lt 40 ]; do
  grep -q "renderer console.*db info" "$LOG" && break
  /bin/sleep 0.25; i=$((i+1))
done
/bin/sleep 1
if kill -0 $PID 2>/dev/null; then echo "ALIVE pid=$PID after $(( (i*250+1000) )) ms"; else echo "DEAD"; fi
[ -n "$PNG" ] && screencapture -x "$PNG"
kill $PID 2>/dev/null; wait $PID 2>/dev/null
cat "$LOG"
