/**
 * Configuration show functions to be exported from the design doc.
 */
var _ = require('underscore'),
    _s = require('underscore-string'),
    showdown = require('showdown'),
    sd = new showdown.converter(),
    events = require('duality/events'),
    templates = require('duality/templates'),
    utils = require('kujua-utils'),
    appinfo = require('views/lib/appinfo'),
    settings = require('settings/root'),
    moment = require('moment'),
    shows = require('../shows'),
    tour = require('./tour'),
    ddoc = settings.name;

var standard_date_formats = [
    'DD-MMM-YYYY',
    'DD/MM/YYYY',
    'MM/DD/YYYY'
];

var standard_datetime_formats = [
    'DD-MMM-YYYY HH:mm:ss',
    'DD/MM/YYYY HH:mm:ss',
    'MM/DD/YYYY HH:mm:ss'
];

var _getWorkflows = function(_info) {
    return _.map(_info.schedules, function(_schedule) {
        var name = _schedule.name;
        var workflow = { schedule: _schedule };
        if (_schedule.description) {
            workflow.description = sd.makeHtml(_schedule.description);
        }
        workflow.registrations = _.filter(
            _info.registrations, 
            function(_registration) {
                return _.some(_registration.events, function(_event) {
                    return _event.trigger === 'assign_schedule' 
                        && _event.params === name;
                }
            );
        });
        workflow.patient_reports = _.filter(
            _info.patient_reports, 
            function(_report) {
                return _report.silence_type === name;
            }
        );
        return workflow;
    });
};

var _submitConfiguration = function (_ev, _data, _validationFn, _callback) {

    var _updateStatus = function(_form, _data) {
        var footer = _form.find('.footer');
        footer.find('.btn').removeClass('disabled');
        var status = footer.find('.status');
        if (_data.success) {
            _resetTranslated(_form);
            footer.removeClass('error');
            status
                .text('Saved')
                .show()
                .delay(2000)
                .fadeOut(400);
        } else {
            footer.addClass('error');
            status
                .text('Save failed: ' + _data.error)
                .show();
        }
        if (_callback) {
            _callback(_data);
        }
    };

    _ev.stopPropagation();
    _ev.preventDefault();

    var target = $(_ev.target);
    target.addClass('disabled');
    var form = target.closest('form');

    form.find('.error-message').remove();
    form.find('.error').removeClass('error');
    if (_validationFn) {
        var valid = _validationFn(_data);
        if (!valid.valid) {
            _.each(valid.errors, function(_error) {
                var field = $(_error.field);
                field.addClass('error');
                field.prepend(
                    '<div class="error-message help-block">' + 
                        _error.error + 
                    '</div>'
                );
                field.parents('.toggle:not(.expanded)').addClass('expanded');
            });
            return _updateStatus(form, { 
                success: false, 
                error: 'Failed validation' 
            });
        }
    }

    var baseURL = require('duality/core').getBaseURL();

    $.ajax({
        type: 'PUT',
        data: JSON.stringify(_data),
        contentType: 'application/json',
        dataType: 'json',
        url: baseURL + '/update_settings/' + ddoc,
        success: function(_data) {
            _updateStatus(form, _data);
        },
        error: function (_xhr, _status, _err) {
            _updateStatus(form, { success: false, error: _err });
        }
    });

};

var _parseInt = function (_int, _default) {
    _default = _default || 0;
    if (!_int) {
        return _default;
    }
    try {
        return parseInt(_int);
    } catch(e) {
        return _default;
    }
}

var _formatTime = function (_hours, _minutes) {
    var hours = _parseInt(_hours);
    var minutes = Math.round(_parseInt(_minutes) / 5) * 5;
    return {
        hours: hours + '',
        minutes: minutes + ''
    };
};

var _resetTranslated = function(_form) {
    _form.find('.translated').each(function() {
        var textarea = $(this);
        textarea.data('message', textarea.val());
    });
};

var _hasDirtyTranslations = function(_form) {
    var dirty = false;
    _form.find('.translated').each(function() {
        if ($(this).val() != $(this).data('message')) {
            dirty = true;
        }
    });
    return dirty;
};

var _repeatingEvents = function($wrapper) {
    $wrapper
        .on('click', '.repeat-container .add', function (_ev) {
            _ev.stopPropagation();
            _ev.preventDefault();
            var container = $(_ev.target).closest('.repeat-container');
            var template = container.find('> .repeat-template').clone();
            template.removeClass('repeat-template').addClass('repeat-element');
            $(_ev.target).closest('p').before(template);
        })
        .on('click', '.repeat-container .remove', function (_ev) {
            _ev.stopPropagation();
            _ev.preventDefault();
            $(_ev.target).closest('.repeat-element').remove();
        });
};

var _alertClose = function(_ev) {
    _ev.stopPropagation();
    $(this).parent('.alert').hide();
};

/**
 * configuration:
 */
exports.configuration = function (_doc, _req) {

    /* Client-side initialization begins here */
    events.once('afterResponse', function() {

        shows.setupContext(_req, function() {

            if (!utils.isDbAdmin(_req.userCtx)) {
                return shows.render403(_req, 'You must be an admin to access this page.');
            }

            _setupTabs();

            var _switchLocale = function () {
                var selector = $('.locale-selector');
                var language = selector.val();
                selector.data('language', language);
                _.each(info.translations, function(_item) {
                    var value = _translate(_item.translations, language);
                    $('[name="' + _item.key + '"]').val(value);
                });
                _resetTranslated($('#translations-form'));
                $('#translations-form textarea').autosize();
            };

            var _parseTime = function (_data) {
                _.each(['morning', 'evening'], function (_property) {
                    var wrapper = $('#schedule-' + _property);
                    _.each(['hours', 'minutes'], function (_unit) {
                        var select = wrapper.find('[name=' + _unit + ']');
                        var value = _parseInt(select.val());
                        _data['schedule_' + _property + '_' + _unit] = value;
                    });
                });
            };

            var _validate = function (_data) {
                var errors = [];

                var morning_hours = _data.schedule_morning_hours;
                var evening_hours = _data.schedule_evening_hours;
                var morning_minutes = _data.schedule_morning_minutes;
                var evening_minutes = _data.schedule_evening_minutes;
                if (morning_hours > evening_hours || (
                        morning_hours === evening_hours 
                        && morning_minutes >= evening_minutes
                    )) {
                    errors.push({
                        field: '#messaging-window',
                        error: 'The first time must be earlier than the second time'
                    });
                }

                return {
                    valid: !errors.length,
                    errors: errors
                };
            };

            /*
             * Take app_settings object and render to template. If we have a
             * settings argument then use that to render, otherwise fetch settings.
             */
            var _renderInstalledForms = function(_settings) {
                var url = '/_db/_design/medic/_rewrite/app_settings/medic';

                function _render(_err, _forms) {

                    _forms = _forms || {};
                    var forms_list = _.values(_forms);

                    $('#forms-installed').html(
                        templates.render('configuration/forms_installed.html', {}, {
                            forms: forms_list,
                            error: _err
                        })
                    );

                    if (_err) {
                        $('#forms-installed .alert-error').show();
                    } else {
                        $('#forms-installed .alert-error').hide();
                    }

                    $('#forms-download').on('click', function() {
                        var a = $(this).get(0),
                            URL = window.webkitURL || window.URL,
                            file = new Blob(
                                [JSON.stringify(forms_list, null, 4)],
                                {"type": "application\/json"}
                            );
                        a.download = 'forms_' + moment().format('YYYY-MM-DD') + '.json';
                        a.href = URL.createObjectURL(file);
                    });

                }

                if (_settings && _settings.forms) {
                    return _render(null, _settings.forms);
                }

                $('#forms-installed').html(
                    templates.render('configuration/loader.html', {}, {})
                );

                $.ajax({
                    type: 'GET',
                    dataType: 'json',
                    url: baseURL + url,
                    success: function(_data) {
                        _render(
                            null, _data && _data.settings && _data.settings.forms
                        )
                    },
                    error: function (_xhr, _status, _err) {
                        _render(_err);
                    }
                });
            }

            var _uploadForms = function(_ev) {

                var reader = new FileReader(),
                    url = '/_db/_design/medic/_rewrite/update_settings/medic?replace=1';

                // disable form elements while running
                $('#forms-upload-form .choose').disable();
                $('#forms-upload-form .loading-wrapper').removeClass('hide');

                function finish(_error) {
                    if (_error) {
                        $('#forms-upload-form .alert-error span').text(_error);
                        $('#forms-upload-form .alert-error').show();
                    } else {
                        $('#forms-upload-form .alert-success').show();
                        _renderInstalledForms();
                    }
                    $('#forms-upload-form .choose').enable();
                    $('#forms-upload-form .loading-wrapper').addClass('hide');
                    // reset uploader
                    var uploader = $('#forms-upload-form .uploader');
                    uploader.replaceWith(uploader = uploader.clone(true));
                }

                if (this.files.length === 0) {
                    finish('File not found');
                }

                reader.onloadend = function(_ev) {
                    var json,
                        settings = { forms: {} };

                    try {
                        // expects array of forms
                        json = JSON.parse(_ev.target.result);
                        json.forEach(function(form, idx) {
                            if (form.meta && form.meta.code) {
                                // form codes are case insensitive and object
                                // key and a form.meta.code should be the same.
                                settings.forms[form.meta.code.toUpperCase()] = form;
                                form.meta.code = form.meta.code.toUpperCase();
                            }
                        });
                    } catch(e) {
                        return finish(e);
                    }

                    $.ajax({
                        type: 'PUT',
                        data: JSON.stringify(settings),
                        contentType: 'application/json',
                        dataType: 'json',
                        url: baseURL + url,
                        success: function(_data) {
                            finish();
                        },
                        error: function (_xhr, _status, _err) {
                            finish(_err);
                        }
                    });

                }

                reader.readAsText(this.files[0]);

            };

            if (!utils.isUserAdmin(_req.userCtx)) {
                return shows.render403(_req);
            }

            utils.updateTopNav('settings', 'Configuration');

            _repeatingEvents($('#configuration-form'));

            var filter = $('#phone-filters-match');
            var value = filter.data('value');
            if (!filter.find('option[value="' + value + '"]').length) {
                filter.prepend('<option value="' + value + '">Custom (' + value + ')</option>');
            }
            filter.val(value);
            filter.select2();

            _renderInstalledForms(info);

            $('#configuration-form').on('click', '.submit', function (_ev) {

                var data = {
                    locale: $('#language').val(),
                    gateway_number: $('#gateway-number').val(),
                    default_country_code: $('#default-country-code').val(),
                    forms_only_mode: !$('#accept-messages').prop('checked'),
                    date_format: $('#date-display-format').val(),
                    reported_date_format: $('#datetime-display-format').val(),
                    outgoing_phone_replace: {
                        match: $('#phone-filters-match').val(),
                        replace: $('#phone-filters-replace').val()
                    }
                };

                data.locales = [];
                $('#languages .repeat-element').each(function() {
                    data.locales.push({
                        code: $(this).find('[name=language-code]').val(),
                        name: $(this).find('[name=language-name]').val()
                    });
                });

                _parseTime(data);

                _submitConfiguration(_ev, data, _validate, function(_result) {
                    if (_result.success) {
                        $('#default-language').html(
                            templates.render(
                                'configuration/default-language.html', 
                                _req, 
                                { locales: data.locales }
                            )
                        );
                        $('#language-to-edit').html(
                            templates.render(
                                'partials/locale.html', 
                                _req, 
                                { locale: data.locale, locales: data.locales }
                            )
                        );
                        _switchLocale();
                    }
                });
            });

            $('a[data-toggle="tab"]').on('shown', function (e) {
                if ($(e.target).hasClass('autosize')) {
                    $('#translations-form textarea').autosize();
                }
            });

            $('#discard-changes-confirmation .btn-primary').on('click', function(ev) {
                ev.preventDefault();
                $('#discard-changes-confirmation').modal('hide');
                _switchLocale();
            });
            $('#discard-changes-confirmation').on('hidden', function () {
                var selector = $('.locale-selector');
                selector.val(selector.data('language'));
            });
            $('#date-display-format').on('change', function () {
                var text = moment().format($('#date-display-format').val());
                $('#date-format-example').text(text);
            });
            $('#datetime-display-format').on('change', function () {
                var text = moment().format($('#datetime-display-format').val());
                $('#datetime-format-example').text(text);
            });

            $('#translations').on('change', '.locale-selector', function () {
                if (_hasDirtyTranslations($('#translations-form'))) {
                    $('#discard-changes-confirmation').modal('show');
                } else {
                    _switchLocale();
                }
            });
            $('#translations').on('click', '.submit', function (_ev) {
                var language = $('.locale-selector').val();
                var translations = _.map(info.translations, function(_item) {
                    if (!_item.translations) {
                        _item.translations = [];
                    }
                    var msg = _.findWhere(_item.translations, { locale: language });
                    if (!msg) {
                        msg = { locale: language };
                        _item.translations.push(msg);
                    }
                    msg.content = $('[name="' + _item.key + '"]').val();
                    return _item;
                });
                _submitConfiguration(_ev, { translations: translations });
            });
            $('#forms-upload-form .choose').on('click', function(_ev) {
                _ev.preventDefault();
                // reset result status
                $('#forms-upload-form .alert-success').hide();
                $('#forms-upload-form .alert-error').hide();
                $('#forms-upload-form .uploader').click();
            });
            $('#forms-upload-form .uploader').on('change', _uploadForms);
            $('#forms-configuration [data-dismiss=alert]').on('click', _alertClose);
            $('a.tab-link').on('click', function(_ev) {
                _ev.preventDefault();
                var href = $(_ev.target).closest('a').attr('href');
                $('#content .nav-tabs a[href="' + href + '"]').tab('show');
            });

            tour.start(_req.query.tour);
        });
    });

    var _translate = function(_translations, _locale) {
        var translation = _.findWhere(_translations, { locale: _locale });
        return translation && translation.content;
    };

    var _formatTimeProperty = function (_info, _property) {
        return _formatTime(
            info['schedule_' + _property + '_hours'],
            info['schedule_' + _property + '_minutes']
        );
    };

    var info = appinfo.getAppInfo.call(this, _req);
    var baseURL = require('duality/core').getBaseURL(_req);
    var translations = _.map(info.translations, function(_translation) {
        var def = _translation.default
            || _translate(_translation.translations, 'en' )
            || _translation.key;
        var msg = _translate(_translation.translations, info.locale);
        return {
            key: _translation.key,
            default: def,
            message: msg
        };
    });

    var dateFormats = standard_date_formats;
    if (!_.contains(dateFormats, info.date_format)) {
        dateFormats.push(info.date_format);
    }

    var datetimeFormats = standard_datetime_formats;
    if (!_.contains(datetimeFormats, info.reported_date_format)) {
        datetimeFormats.push(info.reported_date_format);
    }

    require('../dust-helpers');

    return {
        info: info,
        title: info.translate('Configuration'),
        content: templates.render('configuration/configuration.html', _req, {
            info: info,
            locale: info.locale,
            locales: info.locales,
            translations: translations,
            baseURL: baseURL,
            scheduleEvening: _formatTimeProperty(info, 'evening'),
            scheduleMorning: _formatTimeProperty(info, 'morning'),
            date_formats: dateFormats,
            date_format_example: moment().format(info.date_format),
            datetime_formats: datetimeFormats,
            datetime_format_example: moment().format(info.reported_date_format)
        })
    };
};

var _setupTabs = function() {
    var tabPrefix = 'tab-';
    var hash = window.location.hash;
    if (hash) {
        var href = hash.replace(tabPrefix, '');
        $('.nav-tabs a[href=' + href + ']').tab('show');
    }
    $('.nav-tabs a').on('shown.bs.tab', function (e) {
        window.location.hash = e.target.hash.replace('#', tabPrefix);
    });
};

/**
 * workflows:
 */
exports.workflows = function (_doc, _req) {

    /* Client-side initialization begins here */
    events.once('afterResponse', function() {
        shows.setupContext(_req, function() {
            if (!utils.isDbAdmin(_req.userCtx)) {
                return shows.render403(_req, 'You must be an admin to access this page.');
            }
            utils.updateTopNav('schedules', 'Schedules');
        });
    });

    var info = appinfo.getAppInfo.call(this, _req);
    return {
        info: info,
        title: info.translate('Schedules'),
        content: templates.render('workflow/workflows.html', _req, {
            workflows: _getWorkflows(info)
        })
    };
};

/**
 * workflow:
 */
exports.workflow = function (_doc, _req) {

    /* Client-side initialization begins here */
    events.once('afterResponse', function() {
        shows.setupContext(_req, function() {
            if (!utils.isDbAdmin(_req.userCtx)) {
                return shows.render403(_req, 'You must be an admin to access this page.');
            }
            if (!workflow) {
                return shows.render404(_req);
            }

            _setupTabs();

            utils.updateTopNav('schedules', 'Schedule', ': ' + workflow.schedule.name);

            _repeatingEvents($('#workflow-content'));

            $('#workflow-content').on('click', '.toggle-head', function (_ev) {
                _ev.stopPropagation();
                _ev.preventDefault();
                $(_ev.target).closest('.toggle').toggleClass('expanded');
            });

            $('#workflow-content').on('change', '[name=offset_unit]', function(_ev) {
                var target = $(_ev.target);
                var show = target.val() !== 'minutes' && target.val() !== 'hours';
                target.closest('.message').find('.send_time').toggle(show);
            });

            var selector;
            var _switchLocale = function () {
                var language = selector.val();
                selector.data('language', language);
                var form = selector.closest('form');
                form.find('.translated').each(function() {
                    var textarea = $(this);
                    var messages = textarea.data('messages');
                    textarea.val(_findMessage(messages, language));
                });
                _resetTranslated(form);
            };

            $('#discard-changes-confirmation .btn-primary').on('click', function(ev) {
                ev.preventDefault();
                $('#discard-changes-confirmation').modal('hide');
                _switchLocale();
            });
            $('#discard-changes-confirmation').on('hidden', function () {
                var selector = $('.locale-selector');
                selector.val(selector.data('language'));
            });
            $('.locale-selector').on('change', function (_ev) {
                selector = $(_ev.target);
                if (_hasDirtyTranslations(selector.closest('form'))) {
                    $('#discard-changes-confirmation').modal('show');
                } else {
                    _switchLocale(_ev);
                }
            });
            $('select[name=start_from]').on('change', function(_ev) {
                var name = $(_ev.target).find(':selected').text();
                $('.date-property-name').text(name);
            });

            var _mergeMessages = function (_elem) {
                var locale = _elem.closest('form').find('.locale-selector').val();
                var messages = _elem.data('messages') || [];
                var message = _.find(messages, function(_message) {
                    return _message.locale === locale;
                });
                if (!message) {
                    message = { locale: locale }
                    messages.push(message);
                }
                message.content = _elem.val();
                return messages;
            };

            var _getValidations = function (_elem) {
                var validations = [];
                _elem.find('.repeat-element').each(function() {
                    validations.push({
                        property: $(this).find('[name=property]').val(),
                        rule: $(this).find('[name=rule]').val(),
                        message: _mergeMessages($(this).find('[name=content]'))
                    });
                });
                return validations;
            };

            var _updateRegistration = function (_data) {
                $('#workflow-incoming .registration').each(function(_idx) {
                    var elem = $(this);
                    var registration = _findForm(
                        _data.registrations, elem.data('form')
                    );
                    registration.validations.list = _getValidations(elem);
                    registration.messages[0].message = _mergeMessages(
                        elem.find('.responses [name=content]')
                    );
                });
            };

            var _updatePatientReports = function (_data) {
                $('#workflow-incoming .report').each(function() {
                    var elem = $(this);
                    var form = _findForm(
                        _data.patient_reports, elem.data('form')
                    );
                    form.validations.list = _getValidations(elem);
                    form.silence_for = elem.find('[name=silence-value]').val() + 
                        ' ' + elem.find('[name=silence-unit]').val();
                    form.silence_type = workflow.schedule.name;
                    var messages = [];
                    elem.find('.response').each(function() {
                        var message = $(this).find('[name=message]');
                        if (message.val()) {
                            messages.push({
                                message: _mergeMessages(message),
                                event_type: $(this).find('[name=event_type]').val(),
                                recipient: 'reporting_unit'
                            });
                        }
                    });
                    form.messages = messages;
                });
            };

            var _validTime = function (_time) {
                if (!_time) {
                    return true;
                }
                _time = _time.split(' ')[0];
                return !isNaN(Number(_time));
            };

            $('#workflow-incoming').on('click', '.submit', function (_ev) {
                var data = _.pick(info, 'registrations', 'patient_reports');
                _updateRegistration(data);
                _updatePatientReports(data);
                _submitConfiguration(_ev, data, function (_data) {
                    var errors = [];

                    _.each(_data.patient_reports, function(_report, _idx) {
                        if (!_validTime(_report.silence_for)) {
                            errors.push({
                                field: '#workflow-incoming .report:nth-child(' + (_idx + 2) + ') .silence',
                                error: 'The unit must be an integer'
                            });
                        }
                    });

                    return {
                        valid: !errors.length,
                        errors: errors
                    };
                });
            });

            var _parseSendTime = function (_wrapper) {
                var parts = _.map(['hours', 'minutes'], function (_unit) {
                    var select = _wrapper.find('[name=' + _unit + ']');
                    return _parseInt(select.val());
                });
                return parts.join(':');
            };


            $('#workflow-outgoing').on('click', '.submit', function (_ev) {

                var data = _.pick(info, 'schedules');

                var $schedule = $('#workflow-outgoing');
                var schedule = _.find(data.schedules, function(_schedule) {
                    return _schedule.name === workflow.schedule.name;
                });
                schedule.start_from = $schedule.find('[name=start_from]').val();
                schedule.messages = [];
                $schedule.find('.repeat-element').each(function() {
                    var $message = $(this);

                    var offsetValue = $message.find('[name=offset_value]').val();
                    var offsetUnit = $message.find('[name=offset_unit]').val();
                    var offset = offsetValue + ' ' + offsetUnit;

                    var ignoreSendTime = _.contains(['minutes', 'hours'], offsetUnit);
                    var sendTime = ignoreSendTime ? 
                        null : _parseSendTime($message.find('.send_time'));

                    schedule.messages.push({
                        message: _mergeMessages($message.find('[name=message]')),
                        group: $message.find('[name=group]').val(),
                        offset: offset,
                        send_day: $message.find('[name=send_day]').val(),
                        send_time: sendTime,
                        recipient: $message.find('[name=recipient]').val()
                    });
                });

                _submitConfiguration(_ev, data, function (_data) {
                    var errors = [];

                    _.each(_data.schedules, function(_schedule) {
                        _.each(_schedule.messages, function(_message, _idx) {
                            var group = _message.group;
                            var messageElem = '#workflow-outgoing .message:nth-child(' + (_idx + 2) + ') ';
                            if (isNaN(Number(_message.group))) {
                                errors.push({
                                    field: messageElem + '.group',
                                    error: 'The group must be an integer'
                                });
                            }
                            if (!_validTime(_message.offset)) {
                                errors.push({
                                    field: messageElem + '.message-description',
                                    error: 'The offset unit must be an integer'
                                });
                            }
                        });
                    });

                    return {
                        valid: !errors.length,
                        errors: errors
                    };
                });

            });
        });
    });

    function _findForm (_forms, _name) {
        return _.find(_forms, function(_form) {
            return _form.form === _name;
        });
    }

    function _getFields(_report) {
        if (_report.fields && _report.fields.length && _report.fields[0].field_name) {
            return _report.fields;
        }
        return _.map(
            _.uniq(_.pluck(_report.validations.list, 'property')),
            function(fieldName) {
                return {
                    field_name: fieldName,
                    title: _s.titleize(fieldName.replace(/_/g, ' '))
                };
            }
        );
    }

    function _createValidationsModel (_report) {
        var fields = _getFields(_report);
        return [{
            template: true,
            fields: fields,
            property: 'patient_name',
            rule: '',
            message: '',
            messages: []
        }].concat(_.map(_report.validations.list, function(_validation) {
            return {
                fields: fields,
                property: _validation.property,
                rule: _validation.rule,
                message: _findMessage(_validation.message, info.locale),
                messages: JSON.stringify(_validation.message)
            };
        }));
    }

    function _createReports (_workflow) {

        return _.map(_workflow.patient_reports, function(_report) {
            _.each(['report_accepted', 'registration_not_found'], function(_type) {
                var exists = _.some(_report.messages, function(_m) {
                    return _m.event_type === _type;
                });
                if (!exists) {
                    _report.messages.push({ event_type: _type, message: [] });
                }
            });
            var responses = _.map(_report.messages, function(_message) {
                return {
                    event_type: _message.event_type,
                    message: _findMessage(_message.message, info.locale),
                    messages: JSON.stringify(_message.message)
                };
            });
            return {
                form: _report.form,
                name: _report.name || 'Patient Report',
                format: _report.format,
                responses: responses,
                silence: _formatDate(_report.silence_for),
                validations: _createValidationsModel(_report)
            };
        });
    }

    function _createRegistrations (_workflow) {
        return _.map(_workflow.registrations, function(_registration) {
            var message = _registration.messages[0].message;
            return {
                form: _registration.form,
                help: sd.makeHtml(_registration.help || ''),
                message: _findMessage(message, info.locale),
                messages: JSON.stringify(message),
                validations: _createValidationsModel(_registration)
            };
        });
    }

    function _findMessage (_messages, _language) {
        var message = _.find(_messages, function(_message) {
            return _message.locale === _language;
        });
        return message && message.content;
    }

    function _formatDate (_date) {
        if (!_date) {
            return {
                value: '',
                unit: 'days'
            };
        }
        var parts = _date.split(' ');
        return {
            value: parts[0],
            unit: parts[1]
        };
    }

    function _formatTimeProperty (_time) {
        if (!_time) {
            return _formatTime();
        }
        var parts = _time.split(':');
        return _formatTime(parts[0], parts[1]);
    }

    function _createScheduleModel (_workflow) {
        var fields = [{
            field_name: 'reported_date',
            title: 'Registration Date'
        }];
        var lmpFields = ['weeks_since_lmp', 'last_menstrual_period', 'lmp']
        var hasLmp = _.some(_getFields(_workflow.registrations[0]), function(field) {
            return _.contains(lmpFields, field.field_name);
        });
        if (hasLmp) {
            fields.push({
              field_name: 'lmp_date',
              title: 'Last Menstrual Period'
            });
        }
        var messages = [{
            template: true,
            message: {},
            offset: {},
            sendTime: {},
            contents: []
        }].concat(_.map(_workflow.schedule.messages, function(_message) {
            return {
                schedule: _workflow.schedule,
                message: _message,
                sendTime: _formatTimeProperty(_message.send_time),
                offset: _formatDate(_message.offset),
                content: _findMessage(_message.message, info.locale),
                contents: JSON.stringify(_message.message)
            };
        }));
        return {
            start_from: _workflow.schedule.start_from,
            fields: fields,
            messages: messages
        };
    }

    var info = appinfo.getAppInfo.call(this, _req);
    var baseURL = require('duality/core').getBaseURL(_req);

    var workflow = _.find(_getWorkflows(info), function(_workflow) {
        return _workflow.schedule.name === _req.query.form;
    });

    var context = {
        locale: info.locale,
        locales: info.locales
    };
    if (workflow) {
        _.extend(context, {
            overview: {
                baseURL: baseURL,
                workflow: workflow
            },
            incoming: {
                baseURL: baseURL,
                registrations: _createRegistrations(workflow),
                reports: _createReports(workflow)
            },
            outgoing: {
                workflow: workflow,
                schedule: _createScheduleModel(workflow)
            }
        });
    }

    return {
        info: info,
        title: info.translate('Schedule'),
        content: templates.render('workflow/workflow.html', _req, context)
    };
};
