#!/bin/bash

# Aare Guru Extension Validation Script

echo "🌊 Aare Guru Extension Validation"
echo "================================="

# Check if metadata.json is valid
echo "📋 Checking metadata.json..."
if jq empty metadata.json 2>/dev/null; then
    echo "✅ metadata.json is valid JSON"
else
    echo "❌ metadata.json is invalid JSON"
    exit 1
fi

# Check if schema is compiled
echo "⚙️  Checking GSettings schema..."
if [ -f "schemas/gschemas.compiled" ]; then
    echo "✅ GSettings schema is compiled"
else
    echo "❌ GSettings schema not compiled. Run: glib-compile-schemas schemas/"
    exit 1
fi

# Check essential files
echo "📁 Checking essential files..."
files=("extension.js" "prefs.js" "metadata.json" "schemas/org.gnome.shell.extensions.aareguru.gschema.xml")
for file in "${files[@]}"; do
    if [ -f "$file" ]; then
        echo "✅ $file exists"
    else
        echo "❌ $file is missing"
        exit 1
    fi
done

# Test API connectivity
echo "🌐 Testing API connectivity..."
if curl -s "https://aareguru.existenz.ch/v2018/current?city=bern&app=gnome.shell.extension&version=1.0" | jq empty 2>/dev/null; then
    echo "✅ API is accessible and returns valid JSON"
else
    echo "⚠️  API might be unavailable or returning invalid data"
fi

# Check GNOME Shell version compatibility
echo "🖥️  Checking GNOME Shell compatibility..."
if command -v gnome-shell &> /dev/null; then
    SHELL_VERSION=$(gnome-shell --version | grep -oP '(?<=GNOME Shell )[0-9]+')
    if [ "$SHELL_VERSION" -ge 42 ]; then
        echo "✅ GNOME Shell version $SHELL_VERSION is supported"
    else
        echo "⚠️  GNOME Shell version $SHELL_VERSION might not be fully supported"
    fi
else
    echo "⚠️  GNOME Shell not found in PATH"
fi

echo ""
echo "🎉 Validation complete!"
echo ""
echo "To install the extension:"
echo "make install"
echo ""
echo "To enable the extension:"
echo "gnome-extensions enable aareguru@jon4hz.io"
