var _ = require('underscore'),
    tour = require('../modules/tour'),
    sendMessage = require('../modules/send-message');

(function () {

  'use strict';

  var inboxControllers = angular.module('inboxControllers');

  inboxControllers.controller('MessagesCtrl', 
    ['$scope', '$route', '$animate', '$location', 'MessageContact', 'ContactConversation', 'MarkAllRead', 'Changes', 'RememberService', 'UserCtxService',
    function ($scope, $route, $animate, $location, MessageContact, ContactConversation, MarkAllRead, Changes, RememberService, UserCtxService) {

      $scope.loadingContent = false;
      $scope.allLoaded = false;

      var markAllRead = function() {
        var docs = _.pluck($scope.selected.messages, 'doc');
        MarkAllRead(docs, true, function(err) {
          if (err) {
            return console.log('Error marking all as read', err);
          }
          $scope.updateReadStatus();
        });
      };

      var scrollToUnread = function() {
        var content = $('.item-content');
        var markers = content.find('.marker');
        var scrollTo;
        if (markers.length) {
          scrollTo = markers.filter(':first').offset().top - 150;
        } else {
          scrollTo = content[0].scrollHeight;
        }
        content.scrollTop(scrollTo);
        $('#message-content').on('scroll', _checkScroll);
      };

      var findMostRecentFacility = function(messages) {
        var message = _.find(messages, function(message) {
          return message.value.facility;
        });
        if (message) {
          return [{ doc: message.value.facility }];
        }
        message = _.find(messages, function(message) {
          return message.value.name;
        });
        if (message) {
          return [{ doc: { contact: { phone: message.value.name } } }];
        }
        return [];
      };

      var selectContact = function(id) {
        if (!id) {
          $scope.error = false;
          $scope.loadingContent = false;
          $scope.setSelected();
          return;
        }
        $('#message-content').off('scroll', _checkScroll);
        $scope.loadingContent = true;
        $scope.setSelected({ id: id });
        ContactConversation({ id: id, districtAdmin: $scope.permissions.districtAdmin }, function(err, data) {
          if (err) {
            $scope.loadingContent = false;
            $scope.error = true;
            console.log('Error fetching contact conversation', err);
            return;
          }
          if ($scope.selected && $scope.selected.id !== id) {
            // ignore response for previous request
            return;
          }
          var facility = findMostRecentFacility(data);
          sendMessage.setRecipients(facility);
          $scope.loadingContent = false;
          $scope.error = false;
          $animate.enabled(false);
          $scope.firstUnread = _.min(data, function(message) {
            return $scope.isRead(message.doc) ? Infinity : message.doc.reported_date;
          });
          $scope.selected.messages = data;
          markAllRead();
          window.setTimeout(scrollToUnread, 1);
        });
      };

      var updateContact = function(options) {
        var selectedId = $scope.selected && $scope.selected.id;
        if (selectedId) {
          options = options || {};
          if (options.changes && options.changes.length) {
            $animate.enabled(true);
            for (var i = $scope.selected.messages.length - 1; i >= 0; i--) {
              var msgId = $scope.selected.messages[i].id;
              if (_.findWhere(options.changes, { id: msgId, deleted: true })) {
                $scope.selected.messages.splice(i, 1);
              }
            }
          }
          var opts = {
            id: selectedId,
            districtAdmin: $scope.permissions.districtAdmin
          };
          if (options.skip) {
            opts.skip = $scope.selected.messages.length;
            $scope.loadingContent = true;
          }
          ContactConversation(opts, function(err, data) {
            if (err) {
              return console.log('Error fetching contact conversation', err);
            }
            $animate.enabled(!options.skip);
            $scope.loadingContent = false;
            var contentElem = $('#message-content');
            var scrollToBottom = contentElem.scrollTop() + contentElem.height() + 30 > contentElem[0].scrollHeight;
            var first = $('.item-content .body > ul > li').filter(':first');
            _.each(data, function(updated) {
              var match = _.findWhere($scope.selected.messages, { id: updated.id });
              if (match) {
                angular.extend(match, updated);
              } else {
                $scope.selected.messages.push(updated);
                if (updated.doc.sent_by === UserCtxService().name) {
                  scrollToBottom = true;
                }
              }
            });
            $scope.allLoaded = data.length === 0;
            if (options.skip) {
              $scope.firstUnread = undefined;
            }
            if (first.length && scrollToBottom) {
              window.setTimeout(function() {
                $('#message-content').scrollTop($('#message-content')[0].scrollHeight);
              }, 1);
            }
            markAllRead();
          });
        }
      };

      var updateContacts = function(options) {
        options = options || {};
        MessageContact({ districtAdmin: $scope.permissions.districtAdmin }, function(err, data) {
          if (err) {
            return console.log('Error fetching contact', err);
          }
          options.contacts = data;
          $scope.setContacts(options);
          if (data.length && !$scope.isSelected() && !$('#back').is(':visible')) {
            window.setTimeout(function() {
              var id = $('.inbox-items li').first().attr('data-record-id');
              selectContact(id);
            }, 1);
          }
        });
      };

      var _checkScroll = function() {
        if (this.scrollTop === 0 && !$scope.allLoaded) {
          updateContact({ skip: true });
        }
      };

      if (!$scope.contacts || !$route.current.params.doc) {
        updateContacts();
      }

      if (!$route.current.params.doc) {
        RememberService.scrollTop = {};
      }
      $('.tooltip').remove();

      $scope.filterModel.type = 'messages';
      selectContact($route.current.params.doc);

      Changes(function(data) {
        updateContacts({ changes: data });
        updateContact({ changes: data });
      });

      tour.start($route.current.params.tour);
      $location.url($location.path());
    }
  ]);

}());