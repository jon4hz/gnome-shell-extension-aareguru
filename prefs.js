import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import Gio from 'gi://Gio';

import { ExtensionPreferences, gettext as _ } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class AareGuruPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        window._settings = this.getSettings();

        const page = new Adw.PreferencesPage({
            title: _('General'),
            icon_name: 'dialog-information-symbolic',
        });
        window.add(page);

        // City selection group
        const cityGroup = new Adw.PreferencesGroup({
            title: _('Location'),
            description: _('Select the city for which to display water information'),
        });
        page.add(cityGroup);

        // City dropdown
        const cityModel = this._createCityModel();
        const cityRow = new Adw.ComboRow({
            title: _('City'),
            subtitle: _('Choose from available measurement stations'),
            model: cityModel.stringList,
        });

        cityGroup.add(cityRow);

        // Set initial selection and bind to settings
        const currentCity = window._settings.get_string('city');
        const cityIndex = cityModel.cities.findIndex(([value, _]) => value === currentCity);
        if (cityIndex >= 0) {
            cityRow.set_selected(cityIndex);
        }

        cityRow.connect('notify::selected', () => {
            const selectedIndex = cityRow.get_selected();
            if (selectedIndex >= 0 && selectedIndex < cityModel.cities.length) {
                window._settings.set_string('city', cityModel.cities[selectedIndex][0]);
            }
        });

        // Update interval group
        const updateGroup = new Adw.PreferencesGroup({
            title: _('Updates'),
            description: _('Configure how often the data should be refreshed'),
        });
        page.add(updateGroup);

        // Update interval spin button
        const updateRow = new Adw.SpinRow({
            title: _('Update Interval'),
            subtitle: _('Update frequency in minutes'),
            adjustment: new Gtk.Adjustment({
                lower: 1,
                upper: 300,
                step_increment: 1,
                page_increment: 5,
                value: window._settings.get_int('update-interval'),
            }),
        });

        updateGroup.add(updateRow);

        // Bind update interval setting
        window._settings.bind('update-interval', updateRow, 'value', Gio.SettingsBindFlags.DEFAULT);

        // About group
        const aboutGroup = new Adw.PreferencesGroup({
            title: _('About'),
        });
        page.add(aboutGroup);

        const aboutRow = new Adw.ActionRow({
            title: _('Aare Guru Extension'),
            subtitle: _('Data provided by Aare.guru API\nhttps://aareguru.existenz.ch/'),
        });
        aboutGroup.add(aboutRow);
    }

    _createCityModel() {
        const cities = [
            ['bern', _('Bern')],
            ['thun', _('Thun')],
            ['brienz', _('Brienz')],
            ['interlaken', _('Interlaken')],
            ['hagneck', _('Hagneck')],
            ['biel', _('Biel')],
            ['aarau', _('Aarau')],
            ['olten', _('Olten')],
            ['brugg', _('Brugg')],
            ['untersiggenthal', _('Untersiggenthal')],
            ['koblenz', _('Koblenz')],
            ['rekingen', _('Rekingen')],
            ['rheinfelden', _('Rheinfelden')],
        ];

        const stringList = new Gtk.StringList();

        cities.forEach(([value, label]) => {
            stringList.append(label);
        });

        return {
            stringList,
            cities
        };
    }
}
