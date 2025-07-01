# Aare Guru GNOME Shell Extension Makefile

EXTENSION_NAME = aareguru@jon4hz.io
BUILD_DIR = build
ZIP_NAME = $(EXTENSION_NAME).zip

# Source files to include in the extension
SOURCES = extension.js prefs.js metadata.json stylesheet.css schemas/

.PHONY: all install uninstall enable disable status prefs clean validate zip help version release lint test

all: compile

compile:
	@echo "Compiling GSettings schema..."
	glib-compile-schemas schemas/

install: zip
	@echo "Installing extension using gnome-extensions..."
	gnome-extensions install --force $(ZIP_NAME)
	@echo "Extension installed. Please restart GNOME Shell and enable the extension with:"
	@echo "gnome-extensions enable $(EXTENSION_NAME)"

uninstall:
	@echo "Uninstalling extension using gnome-extensions..."
	gnome-extensions uninstall $(EXTENSION_NAME) || echo "Extension was not installed"
	@echo "Extension uninstalled."

enable:
	@echo "Enabling extension..."
	gnome-extensions enable $(EXTENSION_NAME)
	@echo "Extension enabled."

disable:
	@echo "Disabling extension..."
	gnome-extensions disable $(EXTENSION_NAME)
	@echo "Extension disabled."

status:
	@echo "Extension status:"
	@gnome-extensions list --enabled | grep -q $(EXTENSION_NAME) && echo "✅ Enabled" || echo "❌ Disabled"
	@gnome-extensions list --user | grep -q $(EXTENSION_NAME) && echo "📦 Installed" || echo "❌ Not installed"

prefs:
	@echo "Opening extension preferences..."
	gnome-extensions prefs $(EXTENSION_NAME)

clean:
	@echo "Cleaning build artifacts..."
	rm -f schemas/gschemas.compiled
	rm -rf $(BUILD_DIR)
	rm -f $(ZIP_NAME)
	rm -f $(EXTENSION_NAME)-v*.zip

validate: compile
	@echo "Validating extension..."
	./scripts/validate.sh

lint:
	@echo "Running lint checks..."
	@echo "Checking JSON syntax..."
	@jq empty metadata.json && echo "✅ metadata.json is valid" || (echo "❌ metadata.json is invalid" && exit 1)
	@echo "Checking for common issues..."
	@grep -n "console.log" *.js || echo "✅ No console.log statements found"
	@grep -n "TODO\|FIXME" *.js || echo "✅ No TODO/FIXME comments found"

test: lint validate
	@echo "Running all tests..."
	@echo "Testing API connectivity..."
	@curl -sf "https://aareguru.existenz.ch/v2018/current?city=bern&app=gnome.shell.extension&version=test" > /dev/null && echo "✅ API is accessible" || echo "⚠️  API might be unavailable"

zip: compile
	@echo "Creating extension zip package..."
	mkdir -p $(BUILD_DIR)
	cp -r $(SOURCES) $(BUILD_DIR)/
	cp schemas/gschemas.compiled $(BUILD_DIR)/schemas/
	cd $(BUILD_DIR) && zip -r ../$(ZIP_NAME) .
	rm -rf $(BUILD_DIR)
	@echo "Extension package created: $(ZIP_NAME)"

release: test zip
	@echo "Preparing release..."
	@VERSION=$$(jq -r '.version' metadata.json); \
	VERSIONED_ZIP="$(EXTENSION_NAME)-v$$VERSION.zip"; \
	cp $(ZIP_NAME) "$$VERSIONED_ZIP"; \
	echo "Release package created: $$VERSIONED_ZIP"; \
	echo ""; \
	echo "To create a release:"; \
	echo "1. Create and push a git tag: git tag v$$VERSION && git push origin v$$VERSION"; \
	echo "2. The GitHub Actions workflow will automatically create the release"; \
	echo "3. Or manually upload $$VERSIONED_ZIP to GitHub releases"

help:
	@echo "Available targets:"
	@echo "  compile   - Compile GSettings schema"
	@echo "  install   - Install extension using gnome-extensions"
	@echo "  uninstall - Remove extension using gnome-extensions"
	@echo "  enable    - Enable the extension"
	@echo "  disable   - Disable the extension"
	@echo "  status    - Show extension status"
	@echo "  prefs     - Open extension preferences"
	@echo "  clean     - Remove build artifacts"
	@echo "  lint      - Run code linting checks"
	@echo "  validate  - Run validation tests"
	@echo "  test      - Run all tests (lint + validate + API test)"
	@echo "  zip       - Create installable zip package"
	@echo "  release   - Prepare release package"
	@echo "  help      - Show this help message"
