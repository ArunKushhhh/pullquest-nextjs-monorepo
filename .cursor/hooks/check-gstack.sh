#!/bin/bash
# Cursor sessionStart hook — warn when gstack is not installed globally.

if [ -d "$HOME/.claude/skills/gstack/bin" ]; then
  echo '{}'
  exit 0
fi

cat <<'EOF'
{
  "additional_context": "GSTACK_MISSING: gstack is required for AI-assisted work in this repo. Install: git clone --depth 1 https://github.com/garrytan/gstack.git ~/.claude/skills/gstack && cd ~/.claude/skills/gstack && ./setup --team — then restart Cursor. Do not proceed with implementation until gstack is installed or the user explicitly waives this requirement."
}
EOF
exit 0
