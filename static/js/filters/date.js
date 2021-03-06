(function () {

  'use strict';

  var module = angular.module('inboxFilters');

  var getRelativeDate = function(date, FormatDate, content) {
    content = content || '';
    if (!date) {
      return '<span>' + content + '</span>';
    }
    return  content +
      '<span class="relative-date" title="' + FormatDate.datetime(date) + '">' +
      '<span class="relative-date-content">' + FormatDate.relative(date) + '</span>' +
      '</span>';
  };

  var getTaskDate = function(task) {
    if (task.state === 'scheduled') {
      return task.due;
    }
    if (task.state_history && task.state_history.length) {
      return task.state_history[task.state_history.length - 1].timestamp;
    }
    return task.due || task.reported_date;
  };

  module.filter('autoreply', ['FormatDate',
    function (FormatDate) {
      return function (task) {
        if (!task || !task.state) {
          return '';
        }
        var content = '<span class="state ' + task.state + '">' + task.state + '</span>&nbsp;' +
          '<span class="autoreply" title="' + task.messages[0].message +
          '"><span class="autoreply-content">autoreply</span></span>&nbsp';
        return getRelativeDate(getTaskDate(task), FormatDate, content);
      };
    }
  ]);

  module.filter('state', ['FormatDate',
    function (FormatDate) {
      return function (task) {
        if (!task) {
          return '';
        }
        var state = (task.state || 'received');
        var content = '<span class="state ' + state + '">' + state + '</span>&nbsp;';
        return getRelativeDate(
          getTaskDate(task), FormatDate, content
        );
      };
    }
  ]);

  module.filter('relativeDate', ['FormatDate',
    function (FormatDate) {
      return function (date) {
        return getRelativeDate(date, FormatDate);
      };
    }
  ]);

  module.filter('simpleDate', ['FormatDate',
    function (FormatDate) {
      return function (date) {
        return FormatDate.date(date);
      };
    }
  ]);

  module.filter('simpleDateTime', ['FormatDate',
    function (FormatDate) {
      return function (date) {
        return FormatDate.datetime(date);
      };
    }
  ]);

  module.filter('fullDate', ['FormatDate',
    function (FormatDate) {
      return function (date) {
        if (!date) {
          return '';
        }
        return  '<div class="relative-date-content">' + FormatDate.relative(date) + '</div>' +
                '<div class="full-date">' + FormatDate.datetime(date) + '</div>';
      };
    }
  ]);

  module.filter('weeksPregnant', ['FormatDate',
    function () {
      return function (weeks) {
        if (!weeks || !weeks.number) {
          return '';
        }
        var classes = [];
        if (weeks.number >= 37) {
          classes.push('upcoming-edd');
        }
        if (weeks.approximate) {
          classes.push('approximate');
        }
        var attr = classes.length ? ' class="' + classes.join(' ') + '"' : '';
        return  '<span' + attr + '>' + weeks.number + '</span>';
      };
    }
  ]);

}());
