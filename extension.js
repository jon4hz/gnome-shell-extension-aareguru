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
    WATER_TEMP_FORECAST_2H: 'Wassertemp i 2 Stunde',
    WATER_FLOW: 'Wassermängi',
    AIR_TEMPERATURE: 'Lufttemp',
    TODAY: 'Hüt',
    MORNING: 'Morge',
    AFTERNOON: 'Nami',
    EVENING: 'Abe',
    LOCATION: 'Ort',
    LAST_UPDATE: 'Z lesch Öpdeited',
    SCHWIMMKANAL: 'Schwimmkanal',
    SETTINGS: 'Iistellige',
    ERROR: 'Fähler',
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
            this._tempSection = new PopupMenu.PopupMenuSection();
            this.menu.addMenuItem(this._tempSection);

            this._tempItem = new PopupMenu.PopupMenuItem(_(UI_STRINGS.WATER_TEMPERATURE + ': --°C'), {
                reactive: false
            });
            this._tempSection.addMenuItem(this._tempItem);

            this._tempTextItem = new PopupMenu.PopupMenuItem(_(UI_STRINGS.NO_DATA), {
                reactive: false
            });
            this._tempSection.addMenuItem(this._tempTextItem);

            this._waterTempForecast2hItem = new PopupMenu.PopupMenuItem(_(UI_STRINGS.WATER_TEMP_FORECAST_2H + ': --°C'), {
                reactive: false
            });
            this._tempSection.addMenuItem(this._waterTempForecast2hItem);

            this._waterTemp2hTextItem = new PopupMenu.PopupMenuItem(_(UI_STRINGS.NO_DATA), {
                reactive: false
            });
            this._tempSection.addMenuItem(this._waterTemp2hTextItem);

            // Flow section
            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

            this._flowSection = new PopupMenu.PopupMenuSection();
            this.menu.addMenuItem(this._flowSection);

            this._flowItem = new PopupMenu.PopupMenuItem(_(UI_STRINGS.WATER_FLOW + ': -- m³/s'), {
                reactive: false
            });
            this._flowSection.addMenuItem(this._flowItem);

            this._flowTextItem = new PopupMenu.PopupMenuItem(_(UI_STRINGS.NO_DATA), {
                reactive: false
            });
            this._flowSection.addMenuItem(this._flowTextItem);

            // Schwimmkanal section
            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

            this._schwimmkanalSection = new PopupMenu.PopupMenuSection();
            this.menu.addMenuItem(this._schwimmkanalSection);

            this._schwimmkanalItem = new PopupMenu.PopupMenuItem(_(UI_STRINGS.SCHWIMMKANAL + ': --'), {
                reactive: false
            });
            this._schwimmkanalSection.addMenuItem(this._schwimmkanalItem);

            // Weather section
            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

            this._weatherSection = new PopupMenu.PopupMenuSection();
            this.menu.addMenuItem(this._weatherSection);

            this._weatherItem = new PopupMenu.PopupMenuItem(_(UI_STRINGS.AIR_TEMPERATURE + ': --°C'), {
                reactive: false
            });
            this._weatherSection.addMenuItem(this._weatherItem);

            // Today's weather forecast header
            this._todayHeaderItem = new PopupMenu.PopupMenuItem(_(UI_STRINGS.TODAY + ':'), {
                reactive: false
            });
            this._weatherSection.addMenuItem(this._todayHeaderItem);

            // Morning forecast
            this._morningForecastItem = new PopupMenu.PopupMenuItem(_(UI_STRINGS.MORNING + ': --'), {
                reactive: false
            });
            this._weatherSection.addMenuItem(this._morningForecastItem);

            // Afternoon forecast
            this._afternoonForecastItem = new PopupMenu.PopupMenuItem(_(UI_STRINGS.AFTERNOON + ': --'), {
                reactive: false
            });
            this._weatherSection.addMenuItem(this._afternoonForecastItem);

            // Evening forecast
            this._eveningForecastItem = new PopupMenu.PopupMenuItem(_(UI_STRINGS.EVENING + ': --'), {
                reactive: false
            });
            this._weatherSection.addMenuItem(this._eveningForecastItem);

            // Location and last update
            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

            this._locationItem = new PopupMenu.PopupMenuItem(_(UI_STRINGS.LOCATION + ': --'), {
                reactive: false
            });
            this.menu.addMenuItem(this._locationItem);

            this._lastUpdateItem = new PopupMenu.PopupMenuItem(_(UI_STRINGS.LAST_UPDATE + ': --'), {
                reactive: false
            });
            this.menu.addMenuItem(this._lastUpdateItem);

            // Settings
            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

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
                this._temperatureLabel.set_text(`${temp}°C`);
                this._setTemperatureColor(temp);
            } else {
                this._temperatureLabel.set_text('--°C');
                this._temperatureLabel.set_style_class_name('aare-temperature-label');
            }

            // Update popup menu items
            this._updatePopupItems(data);
        }

        _setTemperatureColor(temp) {
            let colorClass = 'aare-temperature-label';

            if (temp < 12) {
                colorClass += ' aare-temperature-cold';
            } else if (temp < 18) {
                colorClass += ' aare-temperature-cool';
            } else if (temp < 22) {
                colorClass += ' aare-temperature-warm';
            } else {
                colorClass += ' aare-temperature-hot';
            }

            this._temperatureLabel.set_style_class_name(colorClass);
        }

        _formatWeatherForecast(forecastData) {
            if (!forecastData || !forecastData.syt || forecastData.tt === null || forecastData.tt === undefined) {
                return UI_STRINGS.NO_DATA;
            }

            let forecast = `${forecastData.syt}, ${forecastData.tt}°C`;

            // Add rain probability if there's a risk
            if (forecastData.rrisk && forecastData.rrisk > 0) {
                forecast += ` (${forecastData.rrisk}% Räge)`;
            }

            return forecast;
        }

        _updatePopupItems(data) {
            // Temperature
            const temp = data.aare?.temperature;
            const tempText = data.aare?.temperature_text || UI_STRINGS.NO_DATA;

            if (temp !== null && temp !== undefined) {
                this._tempItem.label.set_text(_(UI_STRINGS.WATER_TEMPERATURE + ': ') + `${temp}°C`);
            } else {
                this._tempItem.label.set_text(_(UI_STRINGS.WATER_TEMPERATURE + ': --°C'));
            }
            this._tempTextItem.label.set_text(tempText);

            // Water temperature forecast for 2 hours
            const waterTempForecast2h = data.aare?.forecast2h;
            const waterTempForecast2hText = data.aare?.forecast2h_text || UI_STRINGS.NO_DATA;
            if (waterTempForecast2h !== null && waterTempForecast2h !== undefined) {
                this._waterTempForecast2hItem.label.set_text(_(UI_STRINGS.WATER_TEMP_FORECAST_2H + ': ') + `${waterTempForecast2h}°C`);
            } else {
                this._waterTempForecast2hItem.label.set_text(_(UI_STRINGS.WATER_TEMP_FORECAST_2H + ': --°C'));
            }
            this._waterTemp2hTextItem.label.set_text(waterTempForecast2hText);


            // Flow
            const flow = data.aare?.flow;
            const flowText = data.aare?.flow_text || UI_STRINGS.NO_DATA;

            if (flow !== null && flow !== undefined) {
                this._flowItem.label.set_text(_(UI_STRINGS.WATER_FLOW + ': ') + `${flow} m³/s`);
            } else {
                this._flowItem.label.set_text(_(UI_STRINGS.WATER_FLOW + ': -- m³/s'));
            }
            this._flowTextItem.label.set_text(flowText);

            // Schwimmkanal (bueber)
            const bueber = data.bueber;
            if (bueber) {
                const isOpen = bueber.state_open_flag;
                const emoji = isOpen ? '🏊‍♀️' : '🚫';
                const statusText = isOpen ? 'Offe' : 'Zue';
                this._schwimmkanalItem.label.set_text(_(UI_STRINGS.SCHWIMMKANAL + ': ') + `${emoji} ${statusText}`);
            } else {
                this._schwimmkanalItem.label.set_text(_(UI_STRINGS.SCHWIMMKANAL + ': --'));
            }

            // Weather
            const airTemp = data.weather?.current?.tt;
            if (airTemp !== null && airTemp !== undefined) {
                this._weatherItem.label.set_text(_(UI_STRINGS.AIR_TEMPERATURE + ': ') + `${airTemp}°C`);
            } else {
                this._weatherItem.label.set_text(_(UI_STRINGS.AIR_TEMPERATURE + ': --°C'));
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

            // Location
            const location = data.aare?.location_long || data.aare?.location || UI_STRINGS.NO_DATA;
            this._locationItem.label.set_text(_(UI_STRINGS.LOCATION + ': ') + location);

            // Last update
            const lastUpdate = new Date().toLocaleTimeString();
            this._lastUpdateItem.label.set_text(_(UI_STRINGS.LAST_UPDATE + ': ') + lastUpdate);
        }

        _setErrorState(message) {
            this._temperatureLabel.set_text('ERR');
            this._tempItem.label.set_text(_(UI_STRINGS.ERROR + ': ') + message);
            this._tempTextItem.label.set_text(UI_STRINGS.NO_DATA);
            this._waterTempForecast2hItem.label.set_text(_(UI_STRINGS.WATER_TEMP_FORECAST_2H + ': --°C'));
            this._flowItem.label.set_text(_(UI_STRINGS.WATER_FLOW + ': --'));
            this._flowTextItem.label.set_text(UI_STRINGS.NO_DATA);
            this._schwimmkanalItem.label.set_text(_(UI_STRINGS.SCHWIMMKANAL + ': --'));
            this._weatherItem.label.set_text(_(UI_STRINGS.AIR_TEMPERATURE + ': --'));
            this._morningForecastItem.label.set_text(_(UI_STRINGS.MORNING + ': --'));
            this._afternoonForecastItem.label.set_text(_(UI_STRINGS.AFTERNOON + ': --'));
            this._eveningForecastItem.label.set_text(_(UI_STRINGS.EVENING + ': --'));
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
