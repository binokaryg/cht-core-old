var lists = require('kujua-sms/lists'),
    moment = require('moment'),
    sinon = require('sinon'),
    fakerequest = require('couch-fakerequest'),
    utils = require('kujua-sms/utils'),
    definitions = require('../../test-helpers/form_definitions'),
    appinfo = require('views/lib/appinfo');

exports.setUp = function (callback) {
    utils.info = appinfo.getAppInfo.call(this);
    sinon.stub(utils.info, 'getForm').returns(definitions.forms.YYYU);
    sinon.stub(appinfo,'getAppInfo').returns(utils.info);
    callback();
};

exports.tearDown = function(callback) {
    if (utils.info.getForm.restore) {
        utils.info.getForm.restore();
    }
    if (utils.info.restore) {
        utils.info.restore();
    }
    if (appinfo.getAppInfo.restore) {
        appinfo.getAppInfo.restore();
    }
    callback();
};

exports['lists format date'] = function(test) {
    test.expect(3);
    test.same(
        "11, Mar 2012, 20:10:42 -02:00",
        lists.formatDate(1331503842461, 120)
    );
    test.same(
        "12, Mar 2012, 01:10:42 +03:00",
        lists.formatDate(1331503842461, -180)
    );
    // no tz value argument should retain browser/moment default
    // e.g. in Sao Paulo "11, Mar 2012, 19:10:42 -03:00"
    test.same(
        moment(1331503842461).format('DD, MMM YYYY, HH:mm:ss Z'),
        lists.formatDate(1331503842461)
    );
    test.done();
}

exports['requesting data records export fails if user does not have perms'] = function(test) {
    test.expect(2);
    var req = {
        query: {
            startkey: 'foo',
            endkey: 'bar',
            form: 'YYYU'
        },
        method: "GET",
        userCtx: {
            roles: ['just_some_dude']
        }
    };

    var resp = fakerequest.list(lists.export_data_records, {rows: []}, req);
    test.same(403, resp.code);
    test.same(undefined, resp.body);
    test.done();
}

exports['lists export data records csv'] = function(test) {

    var expected = '"Record UUID","Patient ID","Reported Date","Reported From","Clinic Contact Name"'
        +',"Clinic Name","Health Center Contact Name","Health Center Name","District Hospital Name"'
        +',"Ann??e","Mois","Jour","Code du RC","Type de patient","Nom","Age"'
        +',"Nom de la m??re ou de l\'accompagnant","Patient trait?? pour'
        +'","Recommandations/Conseils","Pr??cisions pour recommandations"'
        +',"Nom de l\'agent de sant??"\n'
        +'"abc123z","5594","'+moment(1331503842461).format('DD, MMM YYYY, HH:mm:ss Z')
        +'","+12229990000","Paul","Clinic 1","Eric","Health Center 1","District 1"'
        +',"2012","1","16","","","","","","","","",""\n'
        +'"ssdk23z","5595","'+moment(1331503850000).format('DD, MMM YYYY, HH:mm:ss Z')
        +'","+13331110000","Sam","Clinic 2","","","District 2","2012","1","16","","","",""'
        +',"","","","",""\n';

    // mockup the view data
    var viewdata = {rows: [
        {
            "key":[
                true,
                "YYYU",
                1331503842461],
            "value": 1,
            "doc": {
                _id: 'abc123z',
                patient_id: '5594',
                form: "YYYU",
                related_entities: {
                    clinic: {
                        name:"Clinic 1",
                        contact: { name:"Paul", phone: ""},
                        parent: {
                            name: "Health Center 1",
                            contact: { name: "Eric" },
                            parent: { name: "District 1" }}}},
                reported_date: 1331503842461,
                from: '+12229990000',
                cref_year: '2012',
                cref_month: "1",
                cref_day: 16
            }
        },
        {
            "key":[
                true,
                "YYYU",
                1331503850000],
            "locale": 'en',
            "value": 1,
            "doc": {
                _id: 'ssdk23z',
                patient_id: '5595',
                related_entities: {
                    clinic: {
                        name:"Clinic 2",
                        contact: {name:"Sam", phone: ""},
                        parent: {
                            name: "",
                            contact: { name: "" }, // empty contact name
                            parent: { name: "District 2" }}}},
                reported_date: 1331503850000,
                from: '+13331110000',
                cref_year: '2012',
                cref_month: "1",
                cref_day: 16}
        }
    ]};

    var req = {
        // locale defaults to english
        query: {
            startkey: 'foo',
            endkey: 'bar',
            form: 'YYYU'
        },
        method: "GET",
        userCtx: {
            roles: ['national_admin']
        }
    };

    var resp = fakerequest.list(lists.export_data_records, viewdata, req);

    test.same(expected, resp.body);

    test.done()
};


exports['lists export data records csv with excluded columns'] = function(test) {

    var expected = '"Reported Date","Clinic Contact Name"'
        +',"Clinic Name","Health Center Contact Name","Health Center Name","District Hospital Name"'
        +',"Ann??e","Mois","Jour","Code du RC","Type de patient","Nom","Age"'
        +',"Nom de la m??re ou de l\'accompagnant","Patient trait?? pour'
        +'","Recommandations/Conseils","Pr??cisions pour recommandations"'
        +',"Nom de l\'agent de sant??"\n'
        +'"'+moment(1331503842461).format('DD, MMM YYYY, HH:mm:ss Z')
        +'","Paul","Clinic 1","Eric","Health Center 1","District 1"'
        +',"2012","1","16","","","","","","","","",""\n'
        +'"'+moment(1331503850000).format('DD, MMM YYYY, HH:mm:ss Z')
        +'","Sam","Clinic 2","","","District 2","2012","1","16","","","",""'
        +',"","","","",""\n';

    // mockup the view data
    var viewdata = {rows: [
        {
            "key":[
                true,
                "YYYU",
                1331503842461],
            "value": 1,
            "doc": {
                _id: 'abc123z',
                patient_id: '5595',
                form: "YYYU",
                related_entities: {
                    clinic: {
                        name:"Clinic 1",
                        contact: { name:"Paul", phone: ""},
                        parent: {
                            name: "Health Center 1",
                            contact: { name: "Eric" },
                            parent: { name: "District 1" }}}},
                reported_date: 1331503842461,
                from: '+12229990000',
                cref_year: '2012',
                cref_month: "1",
                cref_day: 16
            }
        },
        {
            "key":[
                true,
                "YYYU",
                1331503850000],
            "value": 1,
            "doc": {
                _id: 'ssdk23z',
                patient_id: '5596',
                related_entities: {
                    clinic: {
                        name:"Clinic 2",
                        contact: {name:"Sam", phone: ""},
                        parent: {
                            name: "",
                            contact: { name: "" }, // empty contact name
                            parent: { name: "District 2" }}}},
                reported_date: 1331503850000,
                from: '+13331110000',
                cref_year: '2012',
                cref_month: "1",
                cref_day: 16}
        }
    ]};

    var req = {
        // locale defaults to english
        query: {
            startkey: 'foo',
            endkey: 'bar',
            form: 'YYYU',
            exclude_cols: '1,2,4'
        },
        method: "GET",
        userCtx: {
            roles: ['national_admin']
        }
    };

    var resp = fakerequest.list(lists.export_data_records, viewdata, req);
    test.same(expected, resp.body);

    test.done()
};

exports['lists export data records fr'] = function(test) {

    var expected = '"Record UUID";"Patient ID";"Date envoy??";"Envoy?? par";"Personne-ressource Clinique"'
        +';"Villages";"Nom de la sant?? Contact Center";"Nom du centre de sant??";"Nom de l\'h??pital de district"'
        +';"Ann??e";"Mois";"Jour";"Code du RC";"Type de patient";"Nom";"Age"'
        +';"Nom de la m??re ou de l\'accompagnant";"Patient trait?? pour"'
        +';"Recommandations/Conseils";"Pr??cisions pour recommandations"'
        +';"Nom de l\'agent de sant??"\n'
        +'"abc123z";"5597";"'+moment(1331503842461).format('DD, MMM YYYY, HH:mm:ss Z')+'"'
        +';"+12229990000";"Paul";"Clinic 1";"Eric";"Health Center 1";"District 1"'
        +';"2012";"1";"16";"";"";"";"";"";"";"";"";""\n'
        +'"ssdk23z";"5598";"'+moment(1331503850000).format('DD, MMM YYYY, HH:mm:ss Z')+'"'
        +';"+13331110000";"Sam";"Clinic 2";"";"";"District 2";"2012";"1";"16";"";"";"";""'
        +';"";"";"";"";""\n';

    // mockup the view data
    var viewdata = {rows: [
        {
            "key": [true, "YYYU", 1331503842461],
            "value": 1,
            "doc": {
                _id: 'abc123z',
                patient_id: '5597',
                related_entities: {
                    clinic: {
                        name:"Clinic 1",
                        contact: { name:"Paul", phone: ""},
                        parent: {
                            name: "Health Center 1",
                            contact: { name: "Eric" },
                            parent: { name: "District 1" }}}},
                reported_date: 1331503842461,
                from: '+12229990000',
                cref_year: '2012',
                cref_month: "1",
                cref_day: 16
            }
        },
        {
            "key": [true, "YYYU", 1331503850000],
            "value": 1,
            "doc": {
                _id: 'ssdk23z',
                patient_id: '5598',
                related_entities: {
                    clinic: {
                        name:"Clinic 2",
                        contact: {name:"Sam", phone: ""},
                        parent: {
                            name: "",
                            contact: { name:""},
                            parent: { name: "District 2" }}}},
                reported_date: 1331503850000,
                from: '+13331110000',
                cref_year: '2012',
                cref_month: "1",
                cref_day: 16}
        }
    ]};

    var req = {
        //locale is passed in to request
        query: {
            startkey: 'foo',
            endkey: 'bar',
            form: 'YYYU',
            locale: 'fr'
        },
        method: "GET",
        userCtx: {
            roles: ['national_admin']
        }
    };

    var resp = fakerequest.list(lists.export_data_records, viewdata, req);

    test.same(expected, resp.body);

    test.done()
};

exports['lists export data records skip header row'] = function(test) {

    var expected = '"abc123z","5545","'+moment(1331503842461).format('DD, MMM YYYY, HH:mm:ss Z')+'"'
        +',"+12229990000","Paul","Clinic 1","Eric","Health Center 1","District 1"'
        +',"2012","1","16","","","","","","","","",""\n'
        +'"ssdk23z","5546","'+moment(1331503850000).format('DD, MMM YYYY, HH:mm:ss Z')+'"'
        +',"+13331110000","Sam","Clinic 2","","","District 2","2012","1","16","","","",""'
        +',"","","","",""\n';

    // mockup the view data
    var viewdata = {rows: [
        {
            "key": [true, "YYYU", 1331503842461],
            "value": 1,
            "doc": {
                _id: 'abc123z',
                patient_id: '5545',
                related_entities: {
                    clinic: {
                        name:"Clinic 1",
                        contact: { name:"Paul", phone: ""},
                        parent: {
                            name: "Health Center 1",
                            contact: { name: "Eric" },
                            parent: { name: "District 1" }}}},
                reported_date: 1331503842461,
                from: '+12229990000',
                cref_year: '2012',
                cref_month: "1",
                cref_day: 16
            }
        },
        {
            "key": [true, "YYYU", 1331503850000],
            "value": 1,
            "doc": {
                _id: 'ssdk23z',
                patient_id: '5546',
                related_entities: {
                    clinic: {
                        name:"Clinic 2",
                        contact: {name:"Sam", phone: ""},
                        parent: {
                            name: "",
                            contact: { name:""},
                            parent: { name: "District 2" }}}},
                reported_date: 1331503850000,
                from: '+13331110000',
                cref_year: '2012',
                cref_month: "1",
                cref_day: 16}
        }
    ]};

    var req = {
        //locale is passed in to request
        query: {
            form: 'YYYU',
            skip_header_row: '1',
            startkey: 'foo',
            endkey: 'bar'
        },
        method: "GET",
        userCtx: {
            roles: ['national_admin']
        }
    };

    var resp = fakerequest.list(lists.export_data_records, viewdata, req);

    test.same(expected, resp.body);

    test.done()
};

exports['lists export data records with tz'] = function(test) {

    var expected = '"Record UUID","Patient ID","Reported Date","Reported From","Clinic Contact Name"'
        +',"Clinic Name","Health Center Contact Name","Health Center Name","District Hospital Name"'
        +',"Ann??e","Mois","Jour","Code du RC","Type de patient","Nom","Age"'
        +',"Nom de la m??re ou de l\'accompagnant","Patient trait?? pour'
        +'","Recommandations/Conseils","Pr??cisions pour recommandations"'
        +',"Nom de l\'agent de sant??"\n'
        +'"abc123z","5545","12, Mar 2012, 03:10:42 +05:00"'
        +',"+12229990000","Paul","Clinic 1","Eric","Health Center 1","District 1"'
        +',"2012","1","16","","","","","","","","",""\n'
        +'"ssdk23z","5547","12, Mar 2012, 03:10:50 +05:00"'
        +',"+13331110000","Sam","Clinic 2","","","District 2","2012","1","16","","","",""'
        +',"","","","",""\n';

    // mockup the view data
    var viewdata = {rows: [
        {
            "key":[
                true,
                "YYYU",
                1331503842461
            ],
            "value": 1,
            "doc": {
                _id: 'abc123z',
                patient_id: '5545',
                related_entities: {
                    clinic: {
                        name:"Clinic 1",
                        contact: { name:"Paul", phone: ""},
                        parent: {
                            name: "Health Center 1",
                            contact: { name: "Eric" },
                            parent: { name: "District 1" }}}},
                reported_date: 1331503842461,
                from: '+12229990000',
                cref_year: '2012',
                cref_month: "1",
                cref_day: 16
            }
        },
        {
            "key":[
                true,
                "YYYU",
                1331503850000
            ],
            "value": 1,
            "doc": {
                _id: 'ssdk23z',
                patient_id: '5547',
                related_entities: {
                    clinic: {
                        name:"Clinic 2",
                        contact: {name:"Sam", phone: ""},
                        parent: {
                            name: "",
                            contact: { name: "" }, // empty contact name
                            parent: { name: "District 2" }}}},
                reported_date: 1331503850000,
                from: '+13331110000',
                cref_year: '2012',
                cref_month: "1",
                cref_day: 16}
        }
    ]};

    var req = {
        // locale defaults to english
        query: {
            startkey: 'foo',
            endkey: 'bar',
            form: 'YYYU',
            tz: "-300"
        },
        method: "GET",
        userCtx: {
            roles: ['national_admin']
        }
    };

    var resp = fakerequest.list(lists.export_data_records, viewdata, req);
    test.same(expected, resp.body);

    test.done()
};

exports['lists export data records with external facility id'] = function(test) {

    var expected = '"Reported Date","Reported From"'
        + ',"Clinic Name","Clinic External ID","Record UUID"' 
        + ',"Ann??e","Mois","Jour","Code du RC","Type de patient","Nom","Age"'
        + ',"Nom de la m??re ou de l\'accompagnant","Patient trait?? pour'
        + '","Recommandations/Conseils","Pr??cisions pour recommandations"'
        + ',"Nom de l\'agent de sant??"\n'
        + '"' + moment(1331503842461).format('DD, MMM YYYY, HH:mm:ss Z') + '"'
        + ',"+12229990000","Clinic 1","ZYX","abc123z"'
        + ',"2012","1","16","","","","","","","","",""\n'
        + '"' + moment(1331503850000).format('DD, MMM YYYY, HH:mm:ss Z') + '"'
        + ',"+13331110000","Clinic 2","ASD","ssdk23z"'
        + ',"2012","1","16","","","","","","","","",""\n'

    // mockup the view data
    var viewdata = {rows: [
        {
            "key": [true, "YYYU", 1331503842461],
            "value": 1,
            "doc": {
                _id: 'abc123z',
                patient_id: '5545',
                related_entities: {
                    clinic: {
                        name:"Clinic 1",
                        external_id: "ZYX",
                        contact: { name:"Paul", phone: ""},
                        parent: {
                            name: "Health Center 1",
                            external_id: "ABC",
                            contact: { name: "Eric" },
                            parent: { 
                                name: "District 1",
                                external_id: "QWE"
                            }}}},
                reported_date: 1331503842461,
                from: '+12229990000',
                cref_year: '2012',
                cref_month: "1",
                cref_day: 16
            }
        },
        {
            "key": [true, "YYYU", 1331503850000],
            "value": 1,
            "doc": {
                _id: 'ssdk23z',
                patient_id: '5548',
                related_entities: {
                    clinic: {
                        name:"Clinic 2",
                        external_id: "ASD",
                        contact: {name:"Sam", phone: ""},
                        parent: {
                            name: "",
                            contact: { name:""},
                            parent: { name: "District 2", external_id: "ZXC" }}}},
                reported_date: 1331503850000,
                from: '+13331110000',
                cref_year: '2012',
                cref_month: "1",
                cref_day: 16}
        }
    ]};

    var req = {
        //locale is passed in to request
        query: {
            form: 'YYYU',
            locale: 'en',
            include_facility_external_id: true,
            startkey: 'foo',
            endkey: 'bar',
            columns: '["reported_date","from","related_entities.clinic.name","related_entities.clinic.external_id","_id"]'
        },
        method: 'GET',
        userCtx: {
            roles: ['national_admin']
        }
    };

    var resp = fakerequest.list(lists.export_data_records, viewdata, req);

    test.same(expected, resp.body);

    test.done()
};

