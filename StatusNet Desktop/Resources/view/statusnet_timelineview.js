/**
 * StatusNet Desktop
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
 * Base class for Timeline view
 *
 * @param StatusNet.Client client  The controller
 */
StatusNet.TimelineView = function(client, showNotifications) {
    this.client = client;

    StatusNet.debug("TimelineView constructor");
    // XXX: Woah, it doesn't work to pass the timeline into the constructor!
    this.timeline = client.getActiveTimeline();

    this.title = "Timeline on {site}";

    var that = this;

    // Attach event listeners

    StatusNet.debug("TimelineView constructor - attaching events");

    this.timeline.updateStart.attach(
        function() {
            that.showSpinner();
        }
    );

    StatusNet.debug("TimelineView constructor - finished attaching updateStart");

    this.timeline.updateFinished.attach(
        function() {
            that.hideSpinner();
        }
    );

    this.timeline.noticeAdded.attach(
        function(args) {
            if (args) {
                that.insertNotice(args.notice);
            } else {
                StatusNet.debug("noticeAdded event with no args!");
            }
        }
    );
};

/**
 * Put together the HTML for a single notice
 *
 * @param object notice the notice
 */
StatusNet.TimelineView.prototype.renderNotice = function(notice) {

    StatusNet.debug("TimelineView.renderNotice - Entered.");

    var html = [];
    var avatar;

    var cachedAvatarPath = StatusNet.AvatarCache.lookupAvatar(notice.avatar);

    StatusNet.debug("TimelineView.renderNotice - A.");

    if (cachedAvatarPath) {
        avatar = 'file:///' + cachedAvatarPath; // Need to turn native path into a URL
    } else {
        StatusNet.debug("cachedAvatar - is false");
        avatar = notice.avatar;
    }
    StatusNet.debug("TimelineView.renderNotice - B.");

    var classes = ['notice'];

    if (notice.favorite === "true") {
        classes.push('notice-favorite');
    }

    if (notice.repeated === "true") {
        classes.push('notice-repeated');
    }

    if (notice.repeat_of) {
        classes.push('notice-repeat');
    }

    StatusNet.debug("TimelineView.renderNotice - C.");


    html.push('<div class="' + classes.join(" ") + '" id="notice-' + notice.id +'" " name="notice-' + notice.id + '">');
    html.push('<div class="avatar"><a href="' + notice.authorUri + '" rel="external"><img src="' + avatar + '"/></a>');
    html.push('</div>');
    html.push('<div><a class="author" name="author-' + notice.authorId + '" href="' + notice.authorUri + '" rel="external">' + notice.author + '</a>');
    html.push('<div class="content">'+ notice.content +'</div>');
    html.push('</div><div class="date_link"><a href="' + notice.link + '" rel="external" title="View this notice in browser">' + humane_date(notice.updated) + '</a></div>');
    if (notice.source) {
        html.push('<div class="notice_source"><span class="notice_source_inner">from ' + notice.source + '</span></div>');
    }
    if (notice.contextLink && notice.inReplyToLink) {
        html.push(
            '<div class="context_link"><a rel="external" title="View this conversation in browser" href="'
            + notice.contextLink +'">in context</a></div>'
        );
    }
    html.push('<div class="notice_links"><a href="#" class="notice_reply">Reply</a>');

    if (notice.favorite === "true") {
        html.push(' <a href="#" class="notice_unfave">Unfave</a>');
    } else {
        html.push(' <a href="#" class="notice_fave">Fave</a>')
    }

    if (notice.author === this.client.account.username) {
        html.push(' <a href="#" class="notice_delete">Delete</a>')
    } else {
        if (notice.repeated === "false") {
            html.push(' <a href="#" class="notice_repeat">Repeat</a>');
        }
    }
    StatusNet.debug("TimelineView.renderNotice - D.");

    html.push('</div></div>');
    html.push('<div class="clear"></div>');

    StatusNet.debug("TimelineView.renderNotice - exiting");

    return html.join('');
};

/**
 * Render the HTML display of a given timeline
 *
 */
StatusNet.TimelineView.prototype.show = function(notices) {

    StatusNet.debug("StatusNet.TimelineView.show() - loading cached notices");

    var notices = this.client.getActiveTimeline().loadCachedNotices();

    StatusNet.debug("StatusNet.TimelineView.show() - got " + notices.length + " notices");

    $('#notices').empty();

    if (notices.length > 0) {

        StatusNet.debug("showing notice");

        for (i = 0; i < notices.length; i++) {
            this.insertNotice(notices[i]);
        }
    }

    StatusNet.debug("StatusNet.TimelineView.show() - finished showing notices");
};

/**
 * Find the next-newer notice in our timeline after the given one, if any
 *
 * @param notice
 * @return mixed Notice or null
 */
StatusNet.TimelineView.prototype.findNextNewerNotice = function(notice) {

    var notices = this.client.getActiveTimeline().getNotices();
    var candidate = null;
    var candidateTS = null;
    var targetTS = StatusNet.strtotime(notice.updated);

    for (var i = 0; i < notices.length; i++) {
        var thisTS = StatusNet.strtotime(notices[i].updated);
        if (thisTS <= targetTS) {
            continue;
        }
        if (candidate && thisTS > candidateTS) {
            continue;
        }
        candidate = notices[i];
        candidateTS = thisTS;
    }

    return candidate;
};

StatusNet.TimelineView.prototype.insertNotice = function(notice) {

    var html = this.renderNotice(notice);
    var next = this.findNextNewerNotice(notice);

    if (next) {
        $(html).insertAfter("#notice-" + next.id);
    } else {
        $("#notices").prepend(html);
    }

    var noticeDom = $("#notice-" + notice.id);
    noticeDom.hide();
    noticeDom.fadeIn("slow");

    this.enableNoticeControls(noticeDom, notice);

};

StatusNet.TimelineView.prototype.notifyNewNotice = function(notice) {

    if (!StatusNet.Platform.nativeNotifications()) {
        return;
    }

    if (this.client.account.username === notice.author) {
        return;
    }

    var msg;

    if (notice.atomSource) {
        msg = "New notice from " + notice.atomSource;
    } else {
        msg = "New notice from " + notice.author;
    }

    var notification = Titanium.Notification.createNotification(Titanium.UI.getMainWindow());
    notification.setTitle(msg);
    notification.setMessage(notice.title);

    StatusNet.debug('notifyNewNotice - looking up avatar: ' + notice.avatar);

    var appDataDir = Titanium.Filesystem.getApplicationDataDirectory();
    var separator = Titanium.Filesystem.getSeparator();

    StatusNet.AvatarCache.lookupAvatar(notice.avatar,
        function(relativePath) {
            StatusNet.debug('notifyNewNotice - finished looking up avatar');

            if (relativePath.match(/^(http|file)/)) {
                // if it's a full URL it means the avatar isn't cached for some reason
                StatusNet.debug("notifyNewNotice - we got a non-relative URL. Bummer.");
                notification.setIcon("app://theme/default/images/default-avatar-stream.png");
            } else {
                StatusNet.debug("Setting icon to " + appDataDir + separator + relativePath);
                notification.setIcon(appDataDir + separator + relativePath);
            }

            notification.setDelay(5000);
            notification.setCallback(function () {
            // @todo Bring the app window back to focus / on top
                StatusNet.debug("i've been clicked");
            });
            notification.show();
        },
        function(avatarUrl) {
            notification.setIcon("app://theme/default/images/default-avatar-stream.png");
        },
        true
    );
};

/**
 * Determines whether the notice is local (by permalink)
 *
 * @todo This could be better...
 *
 * @param String uri the uri of the notice
 *
 * @return boolean value
 */
StatusNet.TimelineView.prototype.isLocal = function(uri) {

    // Isolate domain name from URI paths and compare
    var path = uri.split('/');
    var serverPath = this.client.server.split('/');

    if (path[2] === serverPath[2]) {
        return true;
    }
    return false;
};

StatusNet.TimelineView.prototype.enableNoticeControls = function(noticeDom, notice) {

StatusNet.debug(JSON.stringify(notice));

    var that = this;

    // Override links to external web view of the notice timelines
    // with click event handlers to display timelines within the client

    if (this.isLocal(notice.authorUri)) {

        $(noticeDom).find('div a.author').attr('href', "#");
        $(noticeDom).find('div a.author').bind('click', function(event) {
            StatusNet.debug("Switching timeline to user " + notice.authorId);
            that.client.switchUserTimeline(notice.authorId);
        });

        $(noticeDom).find('div.avatar a').attr('href', "#");
        $(noticeDom).find('div.avatar img').bind('click', function(event) {
            StatusNet.debug("Switching timeline to user " + notice.authorId);
            that.client.switchUserTimeline(notice.authorId);
        });
    }

    // Reply
    $(noticeDom).find('a.notice_reply').bind('click', function(event) {
        that.client.newNoticeDialog(notice.id, notice.author,
            function(msg) {
                StatusNet.Infobar.flashMessage(msg);
            },
            function(msg) {
                StatusNet.Infobar.flashMessage(msg);
            });
        });

    // Delete notice
    $(noticeDom).find('a.notice_delete').bind('click', function(event) {
        var r = confirm("Delete notice?");
        if (r) {
            that.client.deleteNotice(notice.id, this);
        }
    });

    // Fave notice
    $(noticeDom).find('a.notice_fave').toggle(
        function(event) {
            that.client.faveNotice(notice.id, this);
        },
        function(event) {
            that.client.unFaveNotice(notice.id, this);
        }
    );

    $(noticeDom).find('a.notice_unfave').toggle(
        function(event) {
            that.client.unFaveNotice(notice.id, this);
        },
        function(event) {
            that.client.faveNotice(notice.id, this);
        }
    );

    // Repeat
    $(noticeDom).find('a.notice_repeat').bind('click', function(event) {
        that.client.repeatNotice(notice.id, this);
    });

    // Override external web links to local users and groups in-content
    $(noticeDom).find('div.content span.vcard a').each(function() {
        var href = $(this).attr('href');

        if (that.isLocal(href)) {
            $(this).attr('href', '#');
            // group
            var result = href.match(/group\/(\d+)\/id/);
            if (result) {
                $(this).click(function() {
                    that.client.showGroupTimeline(result[1]); // group id
                });
            // user
            } else {
                result = href.match(/(\d)+$/);
                if (result) {
                    $(this).click(function() {
                        that.client.switchUserTimeline(result[0]); // user id
                    });
                }
            }
        }
    });

    // Override external web links to tags
    $(noticeDom).find("div.content span.tag a").each(function() {
        $(this).attr('href', '#');
        $(this).click(function() {
            // strip punctuation from hashtag string
            that.client.showTagTimeline($(this).text().replace(/\W/, ''));
        });
    });

    $('div.content a', noticeDom).attr('rel', 'external');
};

/**
 * Remove notice from the visible timeline
 *
 * @param int noticeId  the ID of the notice to make go away
 */
StatusNet.TimelineView.prototype.removeNotice = function(noticeId) {
    StatusNet.debug("TimelineView.removeNotice() - removing notice " + noticeId);
    $('#notices div.notice[name=notice-' + noticeId + ']').fadeOut("slow");
};

/**
 * Set up anything that should go in the header section...
 */
StatusNet.TimelineView.prototype.showHeader = function () {
    var title = this.title.replace("{name}", this.client.account.username)
                           .replace("{site}", this.client.account.getHost());
    StatusNet.debug("StatusNet.TimelineView.showHeader() - title = " + title);
    $("#header").html("<h1></h1>");
    $("#header h1").text(title);
    StatusNet.debug("StatusNet.TimelineView.showHeader() - finished");
};

/**
 * Show wait cursor
 */
StatusNet.TimelineView.prototype.showSpinner = function() {
    StatusNet.debug("showSpinner");
    var spinner = this.client.getTheme().getSpinner();
    $('#notices').prepend('<img id="spinner" src="' + spinner + '" />');
};

/**
 * Hide wait cursor
 */
StatusNet.TimelineView.prototype.hideSpinner = function() {
    StatusNet.debug("hideSpinner");
    $('#spinner').remove();
};

/**
 * Show this if the timeline is empty
 */
StatusNet.TimelineView.prototype.showEmptyTimeline = function() {
    $('#notices').empty();
    $('#notices').append('<div id="empty_timeline">No notices in this timeline yet.</div>');
};

/**
 * Constructor for a view for a friends timeline
 */
StatusNet.TimelineViewFriends = function(client) {
    StatusNet.TimelineView.call(this, client);
    this.title = "{name} and friends on {site}";
};

// Make StatusNet.TimelineViewFriends inherit TimelineView's prototype
StatusNet.TimelineViewFriends.prototype = heir(StatusNet.TimelineView.prototype);


/**
 * Constructor for a view for mentions timeline
 */
StatusNet.TimelineViewMentions = function(client) {
    StatusNet.TimelineView.call(this, client);
    this.title = "Replies to {name} on {site}";
};

// Make StatusNet.TimelineViewMentions inherit TimelineView's prototype
StatusNet.TimelineViewMentions.prototype = heir(StatusNet.TimelineView.prototype);

/**
 * Constructor for a view for public timeline
 */
StatusNet.TimelineViewPublic = function(client) {
    StatusNet.TimelineView.call(this, client);
    this.title = "Public timeline on {site}";
};

// Make StatusNet.TimelineViewPublic inherit TimelineView's prototype
StatusNet.TimelineViewPublic.prototype = heir(StatusNet.TimelineView.prototype);

/**
 * Constructor for a view for favorites timeline
 */
StatusNet.TimelineViewFavorites = function(client) {
    StatusNet.TimelineView.call(this, client);
    this.title = "{name}'s favorite notices on {site}";
};

// Make StatusNet.TimelineViewFavorites inherit TimelineView's prototype
StatusNet.TimelineViewFavorites.prototype = heir(StatusNet.TimelineView.prototype);

/**
 * Constructor for a view for tag timeline
 */
StatusNet.TimelineViewTag = function(client) {
    StatusNet.TimelineView.call(this, client);
    StatusNet.debug("TimelineViewTag constructor");
    this.title = "Notices tagged #{tag} on {site}";
};

// Make StatusNet.TimelineViewTag inherit TimelineView's prototype
StatusNet.TimelineViewTag.prototype = heir(StatusNet.TimelineView.prototype);

/**
 * Override to show tag name
 */
StatusNet.TimelineViewTag.prototype.showHeader = function () {
    StatusNet.debug("TimelineViewTag.showHeader()");
    var title = this.title.replace("{tag}", this.timeline.tag)
                           .replace("{site}", this.client.account.getHost());
    StatusNet.debug("StatusNet.TimelineViewTag.showHeader() - title = " + title);
    $("#header").html("<h1></h1>");
    $("#header h1").text(title);
    StatusNet.debug("StatusNet.TimelineViewTag.showHeader() - finished");
};
