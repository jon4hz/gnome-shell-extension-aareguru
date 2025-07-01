# Aare Guru GNOME Shell Extension
[![Test](https://github.com/jon4hz/gnome-shell-extension-aareguru/actions/workflows/ci.yml/badge.svg)](https://github.com/jon4hz/gnome-shell-extension-aareguru/actions/workflows/ci.yml)
[![Release](https://github.com/jon4hz/gnome-shell-extension-aareguru/actions/workflows/release.yml/badge.svg)](https://github.com/jon4hz/gnome-shell-extension-aareguru/actions/workflows/release.yml)


A GNOME Shell extension that displays water temperature and flow information from the Aare.guru API in your panel.

## Features

- **Panel Indicator**: Shows current water temperature directly in the GNOME Shell top panel
- **Detailed Information**: Click the indicator to see:
  - Water temperature with descriptive text
  - Water flow rate and description
  - Current air temperature
  - Weather forecast for today
  - Location information
  - Last update time
- **Configurable Settings**: Choose from multiple measurement stations and set update frequency
- **Automatic Updates**: Refreshes data every 15 minutes by default (configurable)

## Supported Cities

The extension supports all measurement stations available in the Aare.guru API:

- Bern (Schönau)
- Thun
- Brienz
- Interlaken
- Hagneck
- Biel
- Aarau
- Olten
- Brugg
- Untersiggenthal
- Koblenz
- Rekingen
- Rheinfelden

## Installation

### Manual Installation

1. Clone or download this repository:
   ```bash
   git clone https://github.com/jonah/gnome-shell-extension-aareguru.git
   cd gnome-shell-extension-aareguru
   ```

2. Install the extension:
   ```bash
   # Create extension directory if it doesn't exist
   mkdir -p ~/.local/share/gnome-shell/extensions/aareguru@jon4hz.io/
   
   # Copy extension files
   cp -r * ~/.local/share/gnome-shell/extensions/aareguru@jon4hz.io/
   
   # Compile the settings schema
   glib-compile-schemas ~/.local/share/gnome-shell/extensions/aareguru@jon4hz.io/schemas/
   ```

3. Restart GNOME Shell:
   - On X11: Press `Alt + F2`, type `r`, and press Enter
   - On Wayland: Log out and log back in

4. Enable the extension:
   ```bash
   gnome-extensions enable aareguru@jon4hz.io
   ```

   Or use GNOME Extensions app (if installed):
   - Open "Extensions" app
   - Find "Aare Guru" and toggle it on

## Configuration

1. Open the extension preferences:
   ```bash
   gnome-extensions prefs aareguru@jon4hz.io
   ```

2. Or click on the temperature indicator in the panel and select "Settings"

3. Configure:
   - **City**: Select your preferred measurement station
   - **Update Interval**: Set how often to refresh data (1-60 minutes)

## API Information

This extension uses the [Aare.guru API](https://aareguru.existenz.ch/) to fetch water temperature, flow, and weather data.

## Development

### Building

The extension is written in modern JavaScript (ES6+) and uses:
- GJS (GNOME JavaScript bindings)
- GTK4/Adwaita for preferences
- Soup for HTTP requests

### Project Structure

```
├── extension.js          # Main extension code
├── prefs.js             # Preferences window
├── metadata.json        # Extension metadata
├── stylesheet.css       # Custom styling
├── schemas/            # GSettings schema
│   └── org.gnome.shell.extensions.aareguru.gschema.xml
└── README.md           # This file
```

### Testing

1. Enable extension in looking glass for debugging:
   ```bash
   # Open looking glass
   Alt + F2, type 'lg', press Enter
   
   # In looking glass console:
   Extension.lookup('aareguru@jon4hz.io').stateObj._indicator._updateData()
   ```

2. Check logs:
   ```bash
   journalctl -f -o cat /usr/bin/gnome-shell
   ```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the GPL3 License - see the LICENSE file for details.

## Acknowledgments

- Thanks to the [Aare.guru](https://aare.guru/) team for providing the free API
- Data provided by Swiss Federal Office for the Environment and MeteoSwiss
