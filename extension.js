import GObject from 'gi://GObject';
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import Soup from 'gi://Soup';
import Gio from 'gi://Gio';

import { Extension, gettext as _ } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

// Swiss German UI text constants
const UI_STRINGS = {
    WATER_TEMPERATURE: 'Wassertemperatur',
    WATER_TEMP_FORECAST_2H: 'Wassertemp i 2 Stung',
    WATER_FLOW: 'Wassermängi',
    AIR_TEMPERATURE: 'Lufttemp',
    MORNING: 'Morge',
    AFTERNOON: 'Nami',
    EVENING: 'Abe',
    LOCATION: 'Z lesch Öpdeited',
    SCHWIMMKANAL: 'Schwimmkanal',
    SETTINGS: '⚙️ Iistellige',
    ERROR: '❌ Fähler',
    NO_DATA: '--'
};

const AareGuruIndicator = GObject.registerClass(
    class AareGuruIndicator extends PanelMenu.Button {
        constructor(extension, settings) {
            super(0.0, _('Aare Guru'));

            this._settings = settings;
            this._extension = extension;
            this._httpSession = new Soup.Session();
            this._updateTimeout = null;
            this._currentData = null;

            // Create the panel button
            this._createPanelButton();

            // Create the popup menu
            this._createPopupMenu();

            // Start updating data
            this._updateData();
            this._scheduleUpdate();

            // Connect to settings changes
            this._settings.connect('changed::city', () => {
                this._updateData();
            });

            this._settings.connect('changed::update-interval', () => {
                this._scheduleUpdate();
            });

            this._settings.connect('changed::show-temperature-section', () => {
                this._rebuildMenu();
            });

            this._settings.connect('changed::show-flow-section', () => {
                this._rebuildMenu();
            });

            this._settings.connect('changed::show-schwimmkanal-section', () => {
                this._rebuildMenu();
            });

            this._settings.connect('changed::show-weather-section', () => {
                this._rebuildMenu();
            });
        }

        _createPanelButton() {
            this._temperatureLabel = new St.Label({
                text: '--°C',
                style_class: 'aare-temperature-label',
                y_align: Clutter.ActorAlign.CENTER
            });

            this.add_child(this._temperatureLabel);
        }

        _createPopupMenu() {
            // Temperature section
            if (this._settings.get_boolean('show-temperature-section')) {
                this._tempSection = new PopupMenu.PopupMenuSection();
                this.menu.addMenuItem(this._tempSection);

                this._tempItem = new PopupMenu.PopupMenuItem(_(UI_STRINGS.WATER_TEMPERATURE + ': --°C'));
                this._tempSection.addMenuItem(this._tempItem);

                this._tempTextItem = new PopupMenu.PopupMenuItem(_(UI_STRINGS.NO_DATA));
                this._tempSection.addMenuItem(this._tempTextItem);

                this._waterTempForecast2hItem = new PopupMenu.PopupMenuItem(_(UI_STRINGS.WATER_TEMP_FORECAST_2H + ': --°C'));
                this._tempSection.addMenuItem(this._waterTempForecast2hItem);

                this._waterTemp2hTextItem = new PopupMenu.PopupMenuItem(_(UI_STRINGS.NO_DATA));
                this._tempSection.addMenuItem(this._waterTemp2hTextItem);
            }

            // Flow section
            if (this._settings.get_boolean('show-flow-section')) {
                this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

                this._flowSection = new PopupMenu.PopupMenuSection();
                this.menu.addMenuItem(this._flowSection);

                this._flowItem = new PopupMenu.PopupMenuItem(_(UI_STRINGS.WATER_FLOW + ': -- m³/s'));
                this._flowSection.addMenuItem(this._flowItem);

                this._flowTextItem = new PopupMenu.PopupMenuItem(_(UI_STRINGS.NO_DATA));
                this._flowSection.addMenuItem(this._flowTextItem);
            }

            // Schwimmkanal section
            if (this._settings.get_boolean('show-schwimmkanal-section')) {
                this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

                this._schwimmkanalSection = new PopupMenu.PopupMenuSection();
                this.menu.addMenuItem(this._schwimmkanalSection);

                this._schwimmkanalItem = new PopupMenu.PopupMenuItem(_(UI_STRINGS.SCHWIMMKANAL + ': --'));
                this._schwimmkanalSection.addMenuItem(this._schwimmkanalItem);
            }

            // Weather section
            if (this._settings.get_boolean('show-weather-section')) {
                this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

                this._weatherSection = new PopupMenu.PopupMenuSection();
                this.menu.addMenuItem(this._weatherSection);

                this._weatherItem = new PopupMenu.PopupMenuItem(_(UI_STRINGS.AIR_TEMPERATURE + ': --°C'));
                this._weatherSection.addMenuItem(this._weatherItem);

                // Morning forecast
                this._morningForecastItem = new PopupMenu.PopupMenuItem(_(UI_STRINGS.MORNING + ': --'));
                this._weatherSection.addMenuItem(this._morningForecastItem);

                // Afternoon forecast
                this._afternoonForecastItem = new PopupMenu.PopupMenuItem(_(UI_STRINGS.AFTERNOON + ': --'));
                this._weatherSection.addMenuItem(this._afternoonForecastItem);

                // Evening forecast
                this._eveningForecastItem = new PopupMenu.PopupMenuItem(_(UI_STRINGS.EVENING + ': --'));
                this._weatherSection.addMenuItem(this._eveningForecastItem);
            }

            // Location and last update
            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

            this._locationItem = new PopupMenu.PopupMenuItem(_(UI_STRINGS.LOCATION + ': --'));
            this.menu.addMenuItem(this._locationItem);

            this._lastUpdateItem = new PopupMenu.PopupMenuItem(_(UI_STRINGS.LAST_UPDATE + ': --'));
            this.menu.addMenuItem(this._lastUpdateItem);

            // Settings
            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

            const aareguruWebsiteItem = new PopupMenu.PopupMenuItem('🔗 aare.guru');
            aareguruWebsiteItem.connect('activate', () => {
                Gio.AppInfo.launch_default_for_uri('https://aare.guru', null);
            });
            this.menu.addMenuItem(aareguruWebsiteItem);

            const settingsItem = new PopupMenu.PopupMenuItem(_(UI_STRINGS.SETTINGS));
            settingsItem.connect('activate', () => {
                this._extension.openPreferences();
            });
            this.menu.addMenuItem(settingsItem);
        }

        _updateData() {
            const city = this._settings.get_string('city');
            if (!city) {
                this._setErrorState(_('No city configured'));
                return;
            }

            const url = `https://aareguru.existenz.ch/v2018/current?city=${encodeURIComponent(city)}&app=gnome-shell-extension-aareguru&version=1.0`;

            const message = Soup.Message.new('GET', url);

            this._httpSession.send_and_read_async(
                message,
                GLib.PRIORITY_DEFAULT,
                null,
                (session, result) => {
                    try {
                        const bytes = session.send_and_read_finish(result);
                        const decoder = new TextDecoder('utf-8');
                        const responseText = decoder.decode(bytes.get_data());

                        if (message.get_status() === 200) {
                            const data = JSON.parse(responseText);
                            this._updateUI(data);
                        } else {
                            this._setErrorState(_('API Error: ') + message.get_status());
                        }
                    } catch (error) {
                        this._setErrorState(_('Error: ') + error.message);
                    }
                }
            );
        }

        _updateUI(data) {
            this._currentData = data;

            // Update panel temperature
            const temp = data.aare?.temperature;
            if (temp !== null && temp !== undefined) {
                this._temperatureLabel.set_text(`🌊 ${temp}°C`);
                this._setTemperatureColor(temp);
            } else {
                this._temperatureLabel.set_text('🌊 --°C');
                this._temperatureLabel.set_style_class_name('aare-temperature-label');
            }

            // Update popup menu items
            this._updatePopupItems(data);
        }

        _setTemperatureColor(temp) {
            let colorClass = 'aare-temperature-label';

            if (temp < 8) {
                colorClass += ' aare-temperature-freezing';
            } else if (temp < 12) {
                colorClass += ' aare-temperature-cold';
            } else if (temp < 18) {
                colorClass += ' aare-temperature-cool';
            } else if (temp < 22) {
                colorClass += ' aare-temperature-warm';
            } else if (temp < 24) {
                colorClass += ' aare-temperature-hot';
            } else {
                colorClass += ' aare-temperature-very-hot';
            }

            this._temperatureLabel.set_style_class_name(colorClass);
        }

        _getWeatherEmoji(symt) {
            if (!symt) return '🌤️';
            
            // Map MeteoTest iconset values to emojis
            // Based on official MeteoTest documentation
            switch (symt) {
                case 1: return '☀️';        // sunny
                case 2: return '🌤️';       // mostly sunny
                case 3: return '⛅';        // cloudy
                case 4: return '☁️';        // heavily cloudy
                case 5: return '⛈️';        // thunderstorm (heat)
                case 6: return '🌧️';       // heavy rain
                case 7: return '❄️';        // snowfall
                case 8: return '🌫️';       // fog
                case 9: return '🌨️';       // sleet
                case 10: return '🌨️';      // sleet
                case 11: return '🌦️';      // light rain
                case 12: return '🌨️';      // snow shower
                case 13: return '⛈️';       // thunderstorm
                case 14: return '☁️';       // low stratus
                case 15: return '🌨️';      // sleet shower
                default: return '🌤️';      // default fallback
            }
        }

        _getTemperatureEmoji(temp) {
            if (temp < 0) return '🥶';
            if (temp < 10) return '🧊';
            if (temp < 25) return '😊';
            if (temp < 28) return '😎';
            return '🔥';
        }

        _getRainRiskEmoji(rrisk) {
            if (rrisk >= 80) return '☔';
            if (rrisk >= 60) return '🌧️';
            if (rrisk >= 40) return '🌦️';
            if (rrisk >= 20) return '⛅';
            return '';
        }

        _formatWeatherForecast(forecastData) {
            if (!forecastData || forecastData.tt === null || forecastData.tt === undefined) {
                return UI_STRINGS.NO_DATA;
            }

            const weatherEmoji = this._getWeatherEmoji(forecastData.symt);
            const tempEmoji = this._getTemperatureEmoji(forecastData.tt);
            
            // Use syt (text description) if available, otherwise just show the emoji and temperature
            const weatherText = forecastData.syt || '';
            let forecast = `${weatherEmoji} ${weatherText}${weatherText ? ', ' : ''}${tempEmoji} ${forecastData.tt}°C`;

            // Add rain probability if there's a risk
            if (forecastData.rrisk && forecastData.rrisk > 0) {
                const rainEmoji = this._getRainRiskEmoji(forecastData.rrisk);
                forecast += ` ${rainEmoji} (${forecastData.rrisk}% Räge)`;
            }

            return forecast;
        }

        _updatePopupItems(data) {
            // Temperature
            if (this._tempItem) {
                const temp = data.aare?.temperature;
                const tempText = data.aare?.temperature_text || UI_STRINGS.NO_DATA;

                if (temp !== null && temp !== undefined) {
                    const tempEmoji = this._getTemperatureEmoji(temp);
                    this._tempItem.label.set_text(_(UI_STRINGS.WATER_TEMPERATURE + ': ') + `${tempEmoji} ${temp}°C`);
                } else {
                    this._tempItem.label.set_text(_(UI_STRINGS.WATER_TEMPERATURE + ': 🌊 --°C'));
                }
                this._tempTextItem.label.set_text(tempText);

                // Water temperature forecast for 2 hours
                const waterTempForecast2h = data.aare?.forecast2h;
                const waterTempForecast2hText = data.aare?.forecast2h_text || UI_STRINGS.NO_DATA;
                if (waterTempForecast2h !== null && waterTempForecast2h !== undefined) {
                    const tempEmoji = this._getTemperatureEmoji(waterTempForecast2h);
                    this._waterTempForecast2hItem.label.set_text(_(UI_STRINGS.WATER_TEMP_FORECAST_2H + ': ') + `${tempEmoji} ${waterTempForecast2h}°C`);
                } else {
                    this._waterTempForecast2hItem.label.set_text(_(UI_STRINGS.WATER_TEMP_FORECAST_2H + ': ⏰ --°C'));
                }
                this._waterTemp2hTextItem.label.set_text(waterTempForecast2hText);
            }

            // Flow
            if (this._flowItem) {
                const flow = data.aare?.flow;
                const flowText = data.aare?.flow_text || UI_STRINGS.NO_DATA;

                if (flow !== null && flow !== undefined) {
                    // Add emoji based on flow level
                    let flowEmoji = '💧';
                    if (flow > 360) flowEmoji = '🌊';
                    else if (flow > 200) flowEmoji = '💦';
                    else if (flow < 50) flowEmoji = '💧';
                    
                    this._flowItem.label.set_text(_(UI_STRINGS.WATER_FLOW + ': ') + `${flowEmoji} ${flow} m³/s`);
                } else {
                    this._flowItem.label.set_text(_(UI_STRINGS.WATER_FLOW + ': 💧 -- m³/s'));
                }
                this._flowTextItem.label.set_text(flowText);
            }

            // Schwimmkanal (bueber)
            if (this._schwimmkanalItem) {
                const bueber = data.bueber;
                if (bueber) {
                    const isOpen = bueber.state_open_flag;
                    const emoji = isOpen ? '🏊‍♀️' : '🚫';
                    const statusText = isOpen ? 'Offe' : 'Zue';
                    this._schwimmkanalItem.label.set_text(_(UI_STRINGS.SCHWIMMKANAL + ': ') + `${emoji} ${statusText}`);
                } else {
                    this._schwimmkanalItem.label.set_text(_(UI_STRINGS.SCHWIMMKANAL + ': --'));
                }
            }

            // Weather
            if (this._weatherItem) {
                const airTemp = data.weather?.current?.tt;
                if (airTemp !== null && airTemp !== undefined) {
                    const tempEmoji = this._getTemperatureEmoji(airTemp);
                    this._weatherItem.label.set_text(_(UI_STRINGS.AIR_TEMPERATURE + ': ') + `${tempEmoji} ${airTemp}°C`);
                } else {
                    this._weatherItem.label.set_text(_(UI_STRINGS.AIR_TEMPERATURE + ': 🌡️ --°C'));
                }

                // Weather forecast for today
                const todayForecast = data.weather?.today;
                if (todayForecast) {
                    // Morning forecast
                    const morningText = this._formatWeatherForecast(todayForecast.v);
                    this._morningForecastItem.label.set_text(_(UI_STRINGS.MORNING + ': ') + morningText);

                    // Afternoon forecast
                    const afternoonText = this._formatWeatherForecast(todayForecast.n);
                    this._afternoonForecastItem.label.set_text(_(UI_STRINGS.AFTERNOON + ': ') + afternoonText);

                    // Evening forecast
                    const eveningText = this._formatWeatherForecast(todayForecast.a);
                    this._eveningForecastItem.label.set_text(_(UI_STRINGS.EVENING + ': ') + eveningText);
                } else {
                    this._morningForecastItem.label.set_text(_(UI_STRINGS.MORNING + ': ') + UI_STRINGS.NO_DATA);
                    this._afternoonForecastItem.label.set_text(_(UI_STRINGS.AFTERNOON + ': ') + UI_STRINGS.NO_DATA);
                    this._eveningForecastItem.label.set_text(_(UI_STRINGS.EVENING + ': ') + UI_STRINGS.NO_DATA);
                }
            }

            // Location
            const location = data.aare?.location_long || data.aare?.location || UI_STRINGS.NO_DATA;
            this._locationItem.label.set_text(_(UI_STRINGS.LOCATION + ': ') + location);

            // Last update
            const lastUpdate = new Date().toLocaleTimeString();
            this._lastUpdateItem.label.set_text(_(UI_STRINGS.LAST_UPDATE + ': ') + lastUpdate);
        }

        _setErrorState(message) {
            this._temperatureLabel.set_text('ERR');
            if (this._tempItem) {
                this._tempItem.label.set_text(_(UI_STRINGS.ERROR + ': ') + message);
                this._tempTextItem.label.set_text(UI_STRINGS.NO_DATA);
                this._waterTempForecast2hItem.label.set_text(_(UI_STRINGS.WATER_TEMP_FORECAST_2H + ': --°C'));
            }
            if (this._flowItem) {
                this._flowItem.label.set_text(_(UI_STRINGS.WATER_FLOW + ': --'));
                this._flowTextItem.label.set_text(UI_STRINGS.NO_DATA);
            }
            if (this._schwimmkanalItem) {
                this._schwimmkanalItem.label.set_text(_(UI_STRINGS.SCHWIMMKANAL + ': --'));
            }
            if (this._weatherItem) {
                this._weatherItem.label.set_text(_(UI_STRINGS.AIR_TEMPERATURE + ': --'));
                this._morningForecastItem.label.set_text(_(UI_STRINGS.MORNING + ': --'));
                this._afternoonForecastItem.label.set_text(_(UI_STRINGS.AFTERNOON + ': --'));
                this._eveningForecastItem.label.set_text(_(UI_STRINGS.EVENING + ': --'));
            }
            this._locationItem.label.set_text(_(UI_STRINGS.LOCATION + ': --'));
            this._lastUpdateItem.label.set_text(_(UI_STRINGS.LAST_UPDATE + ': Error'));
        }

        _scheduleUpdate() {
            if (this._updateTimeout) {
                GLib.source_remove(this._updateTimeout);
            }

            const interval = this._settings.get_int('update-interval');
            this._updateTimeout = GLib.timeout_add_seconds(
                GLib.PRIORITY_DEFAULT,
                interval * 60, // Convert minutes to seconds
                () => {
                    this._updateData();
                    return GLib.SOURCE_CONTINUE;
                }
            );
        }

        _rebuildMenu() {
            // Clear the existing menu
            this.menu.removeAll();

            // Recreate the menu
            this._createPopupMenu();

            // Update with current data if available
            if (this._currentData) {
                this._updatePopupItems(this._currentData);
            }
        }

        destroy() {
            if (this._updateTimeout) {
                GLib.source_remove(this._updateTimeout);
                this._updateTimeout = null;
            }

            if (this._httpSession) {
                this._httpSession.abort();
                this._httpSession = null;
            }

            super.destroy();
        }
    });

export default class AareGuruExtension extends Extension {
    constructor(metadata) {
        super(metadata);
        this._indicator = null;
    }

    enable() {
        this._settings = this.getSettings();
        this._indicator = new AareGuruIndicator(this, this._settings);
        Main.panel.addToStatusArea(this.uuid, this._indicator);
    }

    disable() {
        if (this._indicator) {
            this._indicator.destroy();
            this._indicator = null;
        }
        this._settings = null;
    }
}
