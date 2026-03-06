#!/bin/bash
# Design System Token Checker
# Scans .tsx components for hardcoded colors that bypass hh-* tokens.
# Run: bash scripts/check-design-tokens.sh

COMPONENTS_DIR="src/components/HH"
VIOLATIONS=0
FILES_WITH_VIOLATIONS=0

echo "=== Design System Token Check ==="
echo ""

# Allowed patterns (won't flag these):
# - Comments (// or /*)
# - Import statements
# - CSS variable references: var(--hh-*)
# - #ffffff / #fff used with text-white on colored buttons (handled by Tailwind)
# - Files in _archive/ folder

for file in "$COMPONENTS_DIR"/*.tsx; do
  # Skip archive files
  [[ "$file" == *"_archive"* ]] && continue

  filename=$(basename "$file")
  file_violations=0

  # Check 1: Hardcoded hex colors in style={{ }} or as string values
  # Match: '#xxxxxx' or "#xxxxxx" but NOT inside var(--) or comments
  while IFS= read -r line; do
    linenum=$(echo "$line" | cut -d: -f1)
    content=$(echo "$line" | cut -d: -f2-)

    # Skip comments and imports
    [[ "$content" =~ ^[[:space:]]*(//|\*|import ) ]] && continue
    # Skip var(--hh references
    [[ "$content" =~ var\(--hh ]] && continue
    # Skip CSS variable definitions (globals.css patterns)
    [[ "$content" =~ ^[[:space:]]*-- ]] && continue

    if [ $file_violations -eq 0 ]; then
      echo "  $filename:"
      FILES_WITH_VIOLATIONS=$((FILES_WITH_VIOLATIONS + 1))
    fi
    file_violations=$((file_violations + 1))
    VIOLATIONS=$((VIOLATIONS + 1))
    echo "    L$linenum: $(echo "$content" | sed 's/^[[:space:]]*//' | head -c 120)"
  done < <(grep -n -E "(#[0-9a-fA-F]{3,8}[\"'\s;,\)]|rgba?\()" "$file" | grep -v "//.*#" | grep -v "var(--" | grep -v "import " | grep -v "_archive")

  # Check 2: Inline style with color/backgroundColor using hardcoded values
  while IFS= read -r line; do
    linenum=$(echo "$line" | cut -d: -f1)
    content=$(echo "$line" | cut -d: -f2-)

    [[ "$content" =~ var\(-- ]] && continue

    if [ $file_violations -eq 0 ]; then
      echo "  $filename:"
      FILES_WITH_VIOLATIONS=$((FILES_WITH_VIOLATIONS + 1))
    fi
    file_violations=$((file_violations + 1))
    VIOLATIONS=$((VIOLATIONS + 1))
    echo "    L$linenum (inline style): $(echo "$content" | sed 's/^[[:space:]]*//' | head -c 120)"
  done < <(grep -n -E "style=\{.*((color|backgroundColor|borderColor|background)\s*:\s*[\"']#)" "$file")

  if [ $file_violations -gt 0 ]; then
    echo ""
  fi
done

echo "=== Summary ==="
echo "Files with violations: $FILES_WITH_VIOLATIONS"
echo "Total violations: $VIOLATIONS"
echo ""

if [ $VIOLATIONS -gt 0 ]; then
  echo "Use hh-* design tokens instead of hardcoded colors."
  echo "Tokens defined in: src/styles/globals.css"
  echo "Docs: CLAUDE.md → Design System section"
fi
