exports.facilities = {
    map: function (doc) {
        if (doc.type === 'clinic' ||
            doc.type === 'health_center' ||
            doc.type === 'district_hospital' ||
            doc.type === 'national_office') {

            var phone = doc.contact && doc.contact.phone,
                rc_code = doc.contact && doc.contact.rc_code;
            emit(
                [doc.type],
                {
                    name:doc.name,
                    contact: doc.contact,
                    rc_code:rc_code,
                    phone:phone
                }
            );
        }
    }
};

exports.facilities_by_district = {
    map: function (doc) {

        var dh_id = null;

        if (doc.type === 'clinic' && doc.parent && doc.parent.parent) {
            dh_id = doc.parent.parent._id;
        } else if (doc.type === 'health_center' && doc.parent) {
            dh_id = doc.parent._id;
        } else if (doc.type === 'district_hospital') {
            dh_id = doc._id;
        }
        if (dh_id !== null) {
            var phone = doc.contact && doc.contact.phone,
                rc_code = doc.contact && doc.contact.rc_code;
            emit(
                [dh_id, doc.type],
                {
                    name: doc.name,
                    contact: doc.contact,
                    rc_code: rc_code,
                    phone: phone
                }
            );
        }
    }
};

exports.reminders = {
  map: function(doc) {
    var phone,
        refid,
        tasks,
        dh_id = doc.related_entities && doc.related_entities.clinic && doc.related_entities.clinic.parent &&
          doc.related_entities.clinic.parent.parent && doc.related_entities.clinic.parent.parent._id;

    if (doc.type === 'data_record' && doc.form && doc.week_number && doc.year) {
        phone = doc.related_entities && doc.related_entities.clinic && doc.related_entities.clinic.contact &&
          doc.related_entities.clinic.contact.phone;
        refid = doc.related_entities && doc.related_entities.clinic && doc.related_entities.clinic.contact &&
          doc.related_entities.clinic.contact.rc_code;
        if (phone || (refid && refid !== null)) {
          emit([dh_id, doc.year, doc.week_number, phone, refid], 'report received');
        }
    } else if (doc.type === 'weekly_reminder' && doc.related_form && doc.week && doc.year && doc.phone) {
        tasks = doc.tasks;
        state = tasks.length ? tasks[0].state : 'unknown';
        emit([dh_id, doc.year, doc.week, doc.phone, doc.refid], 'reminder ' + state);
    }
  },
  reduce: function(keys, values) {
      return values.reduce(function(memo, value) {
          if (memo === 'report received') {
              return memo;
          } else if (memo === 'reminder sent') {
              return memo;
          } else {
              return value;
          }
      }, 'unknown');
  }
}

exports.delivery_reports_by_district_and_code = {
    map: function(doc) {
        if (doc.type === 'data_record' &&
              doc.form === 'D' &&
              doc.errors.length === 0 &&
              doc.delivery_code) {
            var objectpath = require('views/lib/objectpath');
            var dh = objectpath.get(doc, 'related_entities.clinic.parent.parent._id');
            var code = doc.delivery_code.toUpperCase();
            emit([dh, code], 1);
            emit(['_admin', code], 1);
        }
    },
    reduce: function(key, counts) {
        return sum(counts);
    }
};

exports.visits_by_district_and_patient = {
    map: function(doc) {
        if (doc.type === 'data_record' &&
              doc.form === 'V' &&
              doc.errors.length === 0) {
            var objectpath = require('views/lib/objectpath');
            var dh = objectpath.get(doc, 'related_entities.clinic.parent.parent._id');
            emit([dh, doc.patient_id], 1);
            emit(['_admin', doc.patient_id], 1);
        }
    },
    reduce: function(key, counts) {
        return sum(counts);
    }
};

exports.feedback = {
    map: function(doc) {
        if (doc.type === 'feedback') {
            emit([new Date(doc.meta.time).valueOf()], 1);
        }
    }
};