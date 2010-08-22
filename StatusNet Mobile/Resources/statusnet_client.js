/**
 * StatusNet Mobile
 *
 * Copyright 2010 StatusNet, Inc.
 * Based in part on Tweetanium
 * Copyright 2008-2009 Kevin Whinnery and Appcelerator, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * Constructor for UI manager class for the client.
 *
 * @param StatusNet.Account _account
 * @return StatusNet.Client object
 */
StatusNet.Client = function(_account) {

    StatusNet.debug("Client constructor");

    if (_account) {
        StatusNet.debug("we have an account");
    } else {
        StatusNet.debug("we don't have an account");
    }

    this.account = _account;

    this.init();

    /*
    this._timeline = "friends_timeline"; // which timeline are we currently showing?

    this.switchTimeline('friends');
    */
};

StatusNet.Client.prototype.getActiveAccount = function() {
    return this.account;
};

StatusNet.Client.prototype.getActiveTimeline = function() {
    return this.timeline;
};

StatusNet.Client.prototype.getActiveView = function() {
    return this.view;
};

/**
 * Reload timeline notices
 */
StatusNet.Client.prototype.refresh = function() {
    this.timeline.update();
};

/**
 * General initialization stuff
 */
StatusNet.Client.prototype.init = function() {
    StatusNet.debug("Client init");
    var client = this;
    
    StatusNet.debug("StatusNet.Client.prototype.init - Setting up bg parser...");
    StatusNet.AtomParser.prepBackgroundParse();

    StatusNet.debug("StatusNet.Client.prototype.init - Checking for account...");
    if (!this.account) {
        StatusNet.debug("StatusNet.Client.prototype.init - No account, showing accountView");
        this.accountView = new StatusNet.SettingsView(this);
        this.accountView.init();
    } else {
        StatusNet.debug("StatusNet.Client.prototype.init - account is set...");

        StatusNet.debug("Client setting up shake event");
        Titanium.Gesture.addEventListener('shake', function(event) {
            StatusNet.debug("Shaken, not stirred.");
            if (client.timeline) {
                StatusNet.debug("Triggering update for shake gesture...");
                client.timeline.update(function() {
                    StatusNet.debug("Updated, gonna show:");
                    client.view.show();
                    StatusNet.debug("Updated and done showing.");
                });
                StatusNet.debug("Started an update, waiting...");
            }
            StatusNet.debug("Done checking out the shake.");
        });

        client.initInternalListeners();
        client.initAccountView(this.account);
    }
};

/**
 * Set up event listeners for communications from our timeline web views
 */
StatusNet.Client.prototype.initInternalListeners = function() {
    var that = this;

    Ti.App.addEventListener('StatusNet_timelineReady', function(event) {
        StatusNet.debug('YAY GOT StatusNet_timelineReady EVENT! ' + event);
    });

    Ti.App.addEventListener('StatusNet_externalLink', function(event) {
        // Open external links in system default browser...
        // Note: on iPhone this will launch Safari and may cause us to close.
        Titanium.Platform.openURL(event.url);
    });

    Ti.App.addEventListener('StatusNet_switchUserTimeline', function(event) {
        that.switchUserTimeline(event.authorId);
    });

    Ti.App.addEventListener('StatusNet_replyToNotice', function(event) {
        //noticeId: noticeId, noticeAuthor: noticeAuthor
        that.newNoticeDialog(event.noticeId, event.noticeAuthor);
    });

    Ti.App.addEventListener('StatusNet_faveNotice', function(event) {
        StatusNet.debug('Event: ' + event.name);
        that.faveNotice(event.noticeId);
    });

    Ti.App.addEventListener('StatusNet_unfaveNotice', function(event) {
        StatusNet.debug('Event: ' + event.name);
        that.unFaveNotice(event.noticeId);
    });

    Ti.App.addEventListener('StatusNet_repeatNotice', function(event) {
        StatusNet.debug('Event: ' + event.name);
        that.repeatNotice(event.noticeId);
    });

    Ti.App.addEventListener('StatusNet_deleteNotice', function(event) {
        StatusNet.debug('Event: ' + event.name);

        // Delete dialog looks better on Android with a confirm message,
        // but it looks better on iPhone without one

        if (StatusNet.Platform.isAndroid()) {
            that.getActiveView().showConfirmDialog('Really delete notice?', function() {
                that.deleteNotice(event.noticeId);
            }, null, 'Yes', 'No');
        } else {
            that.getActiveView().showConfirmDialog(null, function() {
                that.deleteNotice(event.noticeId);
            }, null, 'Delete Notice', 'Cancel');
        }
    });

    Ti.App.addEventListener('StatusNet_tabSelected', function(event) {
        StatusNet.debug('Event: ' + event.name);
        that.switchView(event.tabName);
    });

    Ti.App.addEventListener('StatusNet_subscribe', function(event) {
        StatusNet.debug('Event: ' + event);
        that.subscribe(event.userId, function() {
            Titanium.App.fireEvent('StatusNet_subscribeComplete', {user: event.userId});
        });
    });

    Ti.App.addEventListener('StatusNet_unsubscribe', function(event) {
        StatusNet.debug('Event: ' + event);
        that.unsubscribe(event.userId, function() {
            Titanium.App.fireEvent('StatusNet_unsubscribeComplete', {user: event.userId});
        });
    });

    Ti.App.addEventListener('StatusNet_block', function(event) {
        StatusNet.debug('Event: ' + event);
        that.block(event.userId, function() {
            Titanium.App.fireEvent('StatusNet_blockComplete', {user: event.userId});
        });
    });

    Ti.App.addEventListener('StatusNet_unblock', function(event) {
        StatusNet.debug('Event: ' + event);
        that.unblock(event.userId, function() {
            Titanium.App.fireEvent('StatusNet_unblockComplete', {user: event.userId});
        });
    });
};

/**
 * Switch the view to a specified timeline
 *
 * @param String timeline   the timeline to show
 */
StatusNet.Client.prototype.switchView = function(view) {

    StatusNet.debug("StatusNet.Client.prototype.switchView - view = " + view);

    if (this.account) {
        StatusNet.debug("we still have an account");
    } else {
        StatusNet.debug('we lost our account somehow');
    }

    var that = this;

    switch (view) {

        case 'public':
            this.timeline = new StatusNet.TimelinePublic(this);
            this.view = new StatusNet.TimelineViewPublic(this);
            break;
        case 'user':
            this.switchUserTimeline();
            return;
        case "friends":
            this.timeline = new StatusNet.TimelineFriends(this);
            this.view = new StatusNet.TimelineViewFriends(this);
            break;
        case 'mentions':
            this.timeline = new StatusNet.TimelineMentions(this);
            this.view = new StatusNet.TimelineViewMentions(this);
            break;
        case 'favorites':
            this.timeline = new StatusNet.TimelineFavorites(this);
            this.view = new StatusNet.TimelineViewFavorites(this);
            break;
        case 'inbox':
            this.timeline = new StatusNet.TimelineInbox(this);
            this.view = new StatusNet.TimelineViewInbox(this);
            break;
        case 'allgroups':
            this.timeline = new StatusNet.TimelineAllGroups(this);
            StatusNet.debug("finished making allgroups timeline");
            this.view = new StatusNet.TimelineViewAllGroups(this);
            StatusNet.debug("finished making allgroups view");
            break;
        case 'search':
            this.timeline = new StatusNet.TimelineSearch(this);
            this.view = new StatusNet.TimelineViewSearch(this);
            break;
        default:
            throw "Gah wrong timeline";
    }

    StatusNet.debug("Initializing view...");
    this.view.init();

    StatusNet.debug('telling the view to show...');
    this.view.show();

    StatusNet.debug('Telling timeline to update:');

    this.timeline.update(function() {
        that.timeline.noticeAdded.attach(
            function(args) {
                if (args.notifications) {
                    that.view.notifyNewNotice(args.notice);
                } else {
                    StatusNet.debug("noticeAdded event with no args!");
                }
            },
            false
        );
    });

    StatusNet.debug('timeline updated.');
};


StatusNet.Client.prototype.switchUserTimeline = function(id) {

    StatusNet.debug("in switchUserTimeline - user id = " + id);

    if (id) {
        StatusNet.debug("user id: " + id);
        timeline = 'user' + '-' + id;
        this.timeline = new StatusNet.TimelineUser(this, id);
    } else {
        StatusNet.debug("id is undefined");
        this.timeline = new StatusNet.TimelineUser(this);
    }

    this.view = new StatusNet.TimelineViewUser(this);
    this.view.init();

    var that = this;

    this.timeline.update(
        function() {
            that.view.showHeader();
            that.view.show();
        },
        false
    );
};

StatusNet.Client.prototype.setMainWindowTitle = function(title) {
    this.mainwin.title = title;
};

StatusNet.Client.prototype.initAccountView = function(acct) {
    StatusNet.debug('initAccountView entered...');

    this.account = acct;

    var that = this;

    if (this.mainwin) {
        this.mainwin.close();
    }
    this.mainwin = Titanium.UI.createWindow({
        backgroundColor:'#fff'
    });

    this.navbar = StatusNet.Platform.createNavBar(this.mainwin);

    var accountsButton = Titanium.UI.createView({
        width: 240,
        height: 44
    });
    if (acct.avatar) {
        var selfAvatar = Titanium.UI.createImageView({
            image: acct.avatar,
            width: 40,
            height: 40,
            top: 2,
            left: 0,
            canScale: true,
            enableZoomControl: false
        });
        accountsButton.add(selfAvatar);
    }
    var selfLabel = Titanium.UI.createLabel({
        text: acct.username + '@' + acct.getHost(),
        left: 44,
        right: 0,
        top: 0,
        bottom: 0,
        color: "white",
        font: {
            fontSize: 18
        },
        minimumFontSize: 8
    });
    accountsButton.add(selfLabel);

    accountsButton.addEventListener('click', function() {
        StatusNet.debug('showSettings!');
        var settingsView = new StatusNet.SettingsView(that);
        settingsView.init();
    });

    this.navbar.setLeftNavButton(accountsButton);

    var updateButton = Titanium.UI.createButton({
        title: "New",
        systemButton: Titanium.UI.iPhone.SystemButton.COMPOSE
    });

    updateButton.addEventListener('click', function() {
        that.newNoticeDialog();
    });

    this.navbar.setRightNavButton(updateButton);

    var tabinfo = {
        'public': {deselectedImage: 'images/tabs/new/public.png', selectedImage: 'images/tabs/new/public_on.png', name: 'public'},
        'friends': {deselectedImage: 'images/tabs/new/friends.png', selectedImage: 'images/tabs/new/friends_on.png', name: 'friends'},
        'mentions': {deselectedImage: 'images/tabs/new/mentions.png', selectedImage: 'images/tabs/new/mentions_on.png', name: 'mentions'},
        'profile': {deselectedImage: 'images/tabs/new/profile.png', selectedImage: 'images/tabs/new/profile_on.png', name: 'user'},
        'favorites': {deselectedImage: 'images/tabs/new/favorites.png', selectedImage: 'images/tabs/new/favorites_on.png', name: 'favorites'},
        'inbox': {deselectedImage: 'images/tabs/new/inbox.png', selectedImage: 'images/tabs/new/inbox_on.png', name: 'inbox'},
        'search': {deselectedImage: 'images/tabs/new/search.png', selectedImage: 'images/tabs/new/search_on.png', name: 'search'}
    };

    this.toolbar = StatusNet.createTabbedBar(tabinfo, this.mainwin, 1);

    this.webview = Titanium.UI.createWebView({
        top: that.navbar.height,
        left: 0,
        right: 0,
        bottom: this.toolbar.height,
        scalesPageToFit: false,
        url: "timeline.html",
        backgroundColor: 'black'
    });

    this.mainwin.add(this.webview);

    setTimeout(function() {
        that.mainwin.open();
    }, 1000);

    this.switchView('friends');

    StatusNet.debug('initAccountView done.');
};


/**
 * Show notice input dialog
 */
StatusNet.Client.prototype.newNoticeDialog = function(replyToId, replyToUsername) {
    var that = this;
    var view = new StatusNet.NewNoticeView({
        replyToId: replyToId,
        replyToUsername: replyToUsername
    });
    view.sent.attach(function() {
        // @fixme load just the posted message, and prepend it
        StatusNet.debug('gonna re-load');
        that.view.showHeader();
        that.view.showSpinner();
        that.timeline.update(function() {
            that.view.show();
        });
        StatusNet.debug('ALL DONE waiting');
    });
    view.init();
};

/**
 * Delete a notice from the timeline
 *
 * @param int noticeId  the ID of the notice to delete
 */
StatusNet.Client.prototype.deleteNotice = function(noticeId) {

    var method = 'statuses/destroy/' + noticeId + '.xml';

    StatusNet.debug("StatusNet.Client.deleteNotice() - deleting notice " + noticeId);

    var params = "gar=gar"; // XXX: we have to pass something to get web client to work

    var that = this;

    this.account.apiPost(method, params,
        function(status, response) {
            StatusNet.debug("Deleted notice " + noticeId);
            StatusNet.Infobar.flashMessage("Deleted notice " + noticeId);
            Titanium.App.fireEvent('StatusNet_deleteNoticeComplete', {noticeId: noticeId});
            that.timeline.decacheNotice(noticeId);
         },
         function(status, response) {
             var msg = $(response).find('error').text();
             if (msg) {
                 StatusNet.debug("Error deleting notice " + noticeId + " - " + msg);
                 alert("Error deleting notice " + noticeId + " - " + msg);
             } else {
                 StatusNet.debug("Error deleting notice " + noticeId + " - " + status + " - " + response);
                 alert("Error deleting notice: " + status + " - " + response);
             }
         }
    );
};

/**
 * Favorite a notice
 *
 * Change the class on the notice's fave link from notice_fave to
 * notice_unfave and refresh the notice entry in the cache so it has
 * the right state
 *
 * @param int noticeId  the ID of the notice to delete
 *
 */
StatusNet.Client.prototype.faveNotice = function(noticeId)
{
    var method = 'favorites/create/' + noticeId + '.xml';

    StatusNet.debug("StatusNet.Client.faveNotice() - faving notice " + noticeId);

    var params = "gar=gar"; // XXX: we have to pass something to get web client to work

    var that = this;

    this.account.apiPost(method, params,
        function(status, response) {
            StatusNet.debug("Faved notice" + noticeId);
            Titanium.App.fireEvent('StatusNet_faveNoticeComplete', {noticeId: noticeId});
            that.timeline.refreshNotice(noticeId);
        },
        function(status, response) {
            // @fixme notify the timeline to update its view
            var msg = $(response).find('error').text();
            if (msg) {
                StatusNet.debug("Error favoriting notice " + noticeId + " - " + msg);
                alert("Error favoriting notice " + noticeId + " - " + msg);
            } else {
                StatusNet.debug("Error favoriting notice " + noticeId + " - " + status + " - " + response);
                alert("Error favoriting notice " + noticeId + " - " + status + " - " + response);
            }
        }
    );
};

/**
 * Unfavorite a notice
 *
 * Change the class on the notice's unfave link from notice_unfave
 * to notice_fave and refresh the notice entry in the cache so it has
 * the right state.
 *
 * @param int noticeId  the ID of the notice to delete
 *
 */
StatusNet.Client.prototype.unFaveNotice = function(noticeId)
{
    var method = 'favorites/destroy/' + noticeId + '.xml';

    StatusNet.debug("StatusNet.Client.unFaveNotice() - unfaving notice " + noticeId);

    var params = "gar=gar"; // XXX: we have to pass something to get web client to work

    var that = this;

    this.account.apiPost(method, params,
        function(status, response) {
            StatusNet.debug("Unfaved notice " + noticeId);
            Titanium.App.fireEvent('StatusNet_unFaveNoticeComplete', {noticeId: noticeId});
            that.timeline.refreshNotice(noticeId);
        },
        function(status, response) {
            var msg = $(response).find('error').text();
            if (msg) {
                StatusNet.debug("Error unfavoriting notice " + noticeId + " - " + msg);
                alert("Error unfavoriting notice " + noticeId + " - " + msg);
            } else {
                StatusNet.debug("Error unfavoriting notice " + noticeId + " - " + status + " - " + $(response).text());
                alert("Error unfavoriting notice " + noticeId + " - " + status + " - " + $(response).text());
            }
        }
    );
};

/**
 * Repeat a notice
 *
 * @param int noticeId  the ID of the notice to delete
 *
 * On success, removes the repeat link and refreshes the notice entry
 * in the cache so it has the right state.
 */
StatusNet.Client.prototype.repeatNotice = function(noticeId, linkDom)
{
    var method = 'statuses/retweet/' + noticeId + '.xml';

    StatusNet.debug("StatusNet.Client.repeatNotice() - repeating notice " + noticeId);

    var params = "gar=gar"; // XXX: we have to pass something to get web client to work

    var that = this;

    this.account.apiPost(method, params,
        function(status, response) {
            // @fixme load just the posted message, and prepend it
            StatusNet.debug("Repeated notice " + noticeId);
            that.timeline.refreshNotice(noticeId);
            that.timeline.update();
        },
        function(status, response) {
            var msg = $(response).find('error').text();
            if (msg) {
                StatusNet.debug("Error repeating notice " + noticeId + " - " + msg);
                alert.flashMessage("Error repeating notice " + noticeId + " - " + msg);
            } else {
                StatusNet.debug("Error repeating notice " + noticeId + " - " + status + " - " + response);
                alert.flashMessage("Error repeating notice " + noticeId + " - " + status + " - " + response);
            }
        }
    );
};

/**
 * Subscribe to a profile
 *
 * @param int profileId  the ID of the profile to subscribe to
 *
 * On success changes the link to an unsubscribe link
 */
StatusNet.Client.prototype.subscribe = function(profileId, onSuccess)
{

    StatusNet.debug("StatusNet.Client.prototype.subscribe - user id " + profileId);

    var method = 'friendships/create/' + profileId + '.xml';

    StatusNet.debug("StatusNet.Client.subscribe() - subscribing to " + profileId);

    var params = "gar=gar"; // XXX: we have to pass something to get web client to work

    var that = this;

    this.account.apiPost(method, params,
        function(status, response) {
            StatusNet.debug("Subscribed to profile " + profileId);
            StatusNet.Infobar.flashMessage("Subscribed to profile " + profileId);
            if (onSuccess) {
                onSuccess();
            }
        },
        function(method, response) {
            var msg = $(response).find('error').text();
            if (msg) {
                StatusNet.debug("Error subscribing to profile " + profileId + " - " + msg);
                StatusNet.Infobar.flashMessage("Error subscribing to profile " + profileId + " - " + msg);
            } else {
                StatusNet.debug("Error subscribing to profile " + profileId + " - " + status + " - " + response);
                StatusNet.Infobar.flashMessage("Error subscribing to profile " + profileId + " - " + status + " - " + response);
            }
        }
    );

};

/**
 * Unsubscribe from a profile
 *
 * @param int profileId  the ID of the profile to unsubscribe from
 *
 * On success changes the link to a subscribe link
 *
 */
StatusNet.Client.prototype.unsubscribe = function(profileId, onSuccess)
{
    StatusNet.debug("StatusNet.Client.prototype.unsubscribe - user id " + profileId);

    var method = 'friendships/destroy/' + profileId + '.xml';

    StatusNet.debug("StatusNet.Client.unsubscribe() - unsubscribing from " + profileId);

    var params = "gar=gar"; // XXX: we have to pass something to get web client to work

    var that = this;

    this.account.apiPost(method, params,
        function(status, data) {
            StatusNet.debug("Unsubscribed from profile " + profileId);
            StatusNet.Infobar.flashMessage("Unsubscribed from profile " + profileId);
            if (onSuccess) {
                onSuccess();
            }
        },
        function(client, responseText) {
            var msg = $(response).find('error').text();
            if (msg) {
                StatusNet.debug("Error unsubscribing from profile " + profileId + " - " + msg);
                StatusNet.Infobar.flashMessage("Error unsubscribing from profile " + profileId + " - " + msg);
            } else {
                StatusNet.debug("Error unsubscribing from profile " + profileId + " - " + status + " - " + response);
                StatusNet.Infobar.flashMessage("Error unsubscribing from profile " + profileId + " - " + status + " - " + response);
            }
        }
    );
};

/**
 * Block to a profile
 *
 * @param int profileId  the ID of the profile to block
 *
 * On success changes the link to an unblock link
 */
StatusNet.Client.prototype.block = function(profileId, onSuccess)
{
    var method = 'blocks/create/' + profileId + '.xml';

    StatusNet.debug("StatusNet.Client.block() - blocking " + profileId);

    var params = "gar=gar"; // XXX: we have to pass something to get web client to work

    var that = this;

    this.account.apiPost(method, params,
        function(status, response) {
            StatusNet.debug("Blocked profile " + profileId);
            StatusNet.Infobar.flashMessage("Blocked profile " + profileId);
            if (onSuccess) {
                onSuccess();
            }
        },
        function(status, response) {
            if (msg) {
                StatusNet.debug("Error blocking profile " + profileId + " - " + msg);
                StatusNet.Infobar.flashMessage("Error blocking profile " + profileId + " - " + msg);
            } else {
                StatusNet.debug("Error blocking profile " + profileId + " - " + response);
                StatusNet.Infobar.flashMessage("Error blocking profile " + profileId + " - " + response);
            }
        }
    );
};

/**
 * Unblock to a profile
 *
 * @param int profileId  the ID of the profile to unblock
 *
 * On success changes the link to an unblock link
 */
StatusNet.Client.prototype.unblock = function(profileId, onSuccess)
{
    var method = 'blocks/destroy/' + profileId + '.xml';

    StatusNet.debug("StatusNet.Client.block() - unblocking " + profileId);

    var params = "gar=gar"; // XXX: we have to pass something to get web client to work

    var that = this;

    this.account.apiPost(method, params,
        function(status, response) {
            StatusNet.debug("Unblocked profile " + profileId);
            StatusNet.Infobar.flashMessage("Unblocked profile " + profileId);
            if (onSuccess) {
                onSuccess();
            }
        },
        function(status, response) {
            $(linkDom).removeAttr('disabled');
            if (msg) {
                StatusNet.debug("Error unblocking profile " + profileId + " - " + msg);
                StatusNet.Infobar.flashMessage("Error unblocking profile " + profileId + " - " + msg);
            } else {
                StatusNet.debug("Error unblocking profile " + profileId + " - " + response);
                StatusNet.Infobar.flashMessage("Error unblocking profile " + profileId + " - " + response);
            }
        }
    );
};
