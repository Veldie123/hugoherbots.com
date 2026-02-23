#!/bin/bash

echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║                    HugoHerbots.ai TODO Tracker                   ║"
echo "╚══════════════════════════════════════════════════════════════════╝"
echo ""

echo "📋 Gestructureerde TODO's (met ID en status):"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
grep -rn "TODO\[" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.py" src/ server/ scripts/ 2>/dev/null | while read line; do
    file=$(echo "$line" | cut -d: -f1)
    linenum=$(echo "$line" | cut -d: -f2)
    content=$(echo "$line" | cut -d: -f3-)
    echo ""
    echo "📁 $file:$linenum"
    echo "   $content"
done

echo ""
echo ""
echo "📝 Ongestructureerde TODO's:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
grep -rn "// TODO:" --include="*.ts" --include="*.tsx" --include="*.js" src/ server/ 2>/dev/null | grep -v "TODO\[" | while read line; do
    file=$(echo "$line" | cut -d: -f1)
    linenum=$(echo "$line" | cut -d: -f2)
    content=$(echo "$line" | cut -d: -f3-)
    echo "  • $file:$linenum → $content"
done

echo ""
echo ""
echo "📊 Samenvatting:"
echo "━━━━━━━━━━━━━━━━"
structured=$(grep -rn "TODO\[" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.py" src/ server/ scripts/ 2>/dev/null | wc -l)
unstructured=$(grep -rn "// TODO:" --include="*.ts" --include="*.tsx" --include="*.js" src/ server/ 2>/dev/null | grep -v "TODO\[" | wc -l)
echo "  Gestructureerd: $structured"
echo "  Ongestructureerd: $unstructured"
echo "  Totaal: $((structured + unstructured))"
echo ""
