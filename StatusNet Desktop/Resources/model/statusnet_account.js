/**
 * Account info management constructor.
 *
 * @param string username
 * @param string password
 * @param string apiroot API base URL, eg 'http://identi.ca/api'
 * @return StatusNet.Account object
 */
StatusNet.Account = function(username, password, apiroot) {

    StatusNet.debug('in StatusNet.Account()');

    this.username = username;
    this.password = password;
    this.apiroot  = apiroot;
}

/**
 * Load up the default account's credentials from the local database,
 * if any.
 *
 * @return mixed StatusNet.Account object or null
 */
StatusNet.Account.getDefault = function(db) {

    StatusNet.debug('in StatusNet.Account.getDefault()');

    row = db.execute('select * from account where is_default = 1');

    if (row.isValidRow()) {
        StatusNet.debug('found an account');
        var acct = StatusNet.Account.fromRow(row);
        $('ul.nav li#nav_timeline_profile > img').attr('src', acct.avatar);
        row.close();
        return acct;
    } else {
        StatusNet.debug('did not find an account');
        return null;
    }
}

/**
 * Set this account as the default.
 */
StatusNet.Account.prototype.setDefault = function(db) {
    db.execute("update account set is_default=0 where is_default=1");
    db.execute("update account set is_default=1 where username=? and apiroot=?",
               this.username, this.apiroot);
}

/**
 * Load an Account object from a database row w/ info
 * @param Titanium.Database.ResultSet row
 * @return StatusNet.Account object
 */
StatusNet.Account.fromRow = function(row) {

    var ac = new StatusNet.Account(
        row.fieldByName("username"),
        row.fieldByName("password"),
        row.fieldByName("apiroot")
    );

    ac.id = row.fieldByName("id");
    ac.avatar = row.fieldByName("profile_image_url");
    ac.textLimit = row.fieldByName('text_limit');
    ac.siteLogo = row.fieldByName('site_logo');

    return ac;
}

/**
 * Load up all configured accounts from the database, if any.
 *
 * @return array of StatusNet.Account objects
 */
StatusNet.Account.listAll = function(db) {

    var accounts = [];

    result = db.execute('select * from account');
    while (result.isValidRow()) {
        accounts[accounts.length] = StatusNet.Account.fromRow(result);
        result.next();
    }
    result.close();
    return accounts;
}

/**
 * Start an asynchronous, authenticated API call.
 * Currently only supports GET requests; any needed parameters
 * must be in the method, as part of the path or query string.
 *
 * @param string method URL fragment, appended to API root to create final URL.
 * @param callable onSuccess callback function called after successful HTTP fetch: function(status, data)
 * @param callable onError callback function called if there's a low-level HTTP error: function(status, thrown)
 */
StatusNet.Account.prototype.fetchUrl = function(method, onSuccess, onError) {

    StatusNet.debug('in fetchUrl: ' + this.apiroot + method);

    var client = Titanium.Network.createHTTPClient();

    client.onload = function() {
        if (this.status == 200) {

            // @fixme Argh. responseXML is unimplemented in Titanium 1.2.1 So we have
            // to use this work-around.
            var responseXML = (new DOMParser()).parseFromString(this.responseText, "text/xml");

            onSuccess(this.status, responseXML);
        } else {
            onError(client, "HTTP status: " + this.status);
        }
    };

    client.onerror = function(e) {
        onError(client, "Error: " + e.error);
    }

    // @fixme Desktop vs Mobile auth differences HTTPClient hack
    //
    // Titanium Mobile 1.3.0 seems to lack the ability to do HTTP basic auth
    // on its HTTPClient implementation. The setBasicCredentials method
    // claims to exist (typeof client.setBasicCredentials == 'function') however
    // calling it triggers an "invalid method 'setBasicCredentials:'" error.
    // The method is also not listed in the documentation for Mobile, nor do I see
    // it in the source code for the proxy object.
    //
    // Moreover, the Titanium.Utils namespace, which contains the base 64 utility
    // functions, isn't present on Desktop. So for now, we'll check for that and
    // use the manual way assuming it's mobile. Seriously, can't the core libs be
    // synchronized better?
    StatusNet.debug("fetchUrl: Titanium.Utils is: " + typeof Titanium.Utils);
    StatusNet.debug("fetchUrl: client.setBasicCredentials is: " + typeof client.setBasicCredentials);
    if (typeof Titanium.Utils == "undefined") {
        client.setBasicCredentials(this.username, this.password);
    }

    // @fixme Hack to work around bug in the Titanium Desktop 1.2.1
    // onload will not fire unless there a function assigned to
    // onreadystatechange.
    client.onreadystatechange = function() {
        // NOP
    };

    client.open("GET", this.apiroot + method);
    // @fixme Desktop vs Mobile auth differences HTTPClient hack
    // setRequestHeader must be called between open() and send()
    if (typeof Titanium.Utils != "undefined") {
        var auth = 'Basic ' + Titanium.Utils.base64encode(this.username + ':' + this.password);
        StatusNet.debug("fetchUrl: Authorization: " + auth);
        client.setRequestHeader('Authorization', auth);
    }
    client.send();
}

StatusNet.Account.prototype.postUrl = function(method, data, onSuccess, onError) {

    StatusNet.debug('in postUrl');

    var client = Titanium.Network.createHTTPClient();

    client.onload = function() {
        if (this.status == 200) {
            var json = JSON.parse(this.responseText)
            onSuccess(this.status, json);
        } else {
            onError(client, 'HTTP status: ' + this.status);
        }
    };

    client.onerror = function(e) {
        onError(client, "Error: " + e.error);
    }

    client.setBasicCredentials(this.username, this.password);

    // @fixme Hack to work around bug in the Titanium Desktop 1.2.1
    // onload will not fire unless there a function assigned to
    // onreadystatechange.
    client.onreadystatechange = function() {
        // NOP
    };

    client.open("POST", this.apiroot + method);
    client.send(data);
}

/**
 * Make sure we've recorded account credentials to the local database.
 * If not already done, saves them.
 *
 * @return boolean success
 */
StatusNet.Account.prototype.ensure = function(db) {

    StatusNet.debug('in Account.ensure');

    StatusNet.debug("Avatar = " + this.avatar);
    StatusNet.debug("textLimit = " + this.textLimit);
    StatusNet.debug("siteLogo = " + this.siteLogo);

    var rs = db.execute("select * from account where username=? " +
                        "and apiroot=?",
                        this.username, this.apiroot);

    if (StatusNet.rowCount(rs) === 0) {

        rs = db.execute("INSERT INTO account " +
                        "(username, password, apiroot, is_default, profile_image_url, text_limit, site_logo) " +
                        "VALUES (?, ?, ?, 0, ?, ?, ?)",
                        this.username,
                        this.password,
                        this.apiroot,
                        this.avatar,
                        this.textLimit,
                        this.siteLogo);

        StatusNet.debug('inserted ' + db.rowsAffected + 'rows');

    }

    return true;
}

/**
 * Is this the same?
 *
 * @param mixed other a StatusNet.Account or null
 * @return boolean
 */
StatusNet.Account.prototype.equals = function(other) {
    if (other == null || typeof other != "object") {
        return false;
    }
    return (typeof other == "object" &&
            this.username == other.username &&
            this.password == other.password &&
            this.apiroot == other.apiroot);
}

/**
 * Remove this account from the database, should it exist!
 * If we removed the default account, we'll set the first next available
 * account as the new default.
 */
StatusNet.Account.prototype.deleteAccount = function() {
    var db = StatusNet.getDB();

    StatusNet.debug("deleting...");
    db.execute("delete from account where username=? and apiroot=?",
               this.username, this.apiroot);
    StatusNet.debug("deleted.");

    StatusNet.debug("checking default...");
    if (StatusNet.Account.getDefault(db) == null) {
        StatusNet.debug("setting new default...");
        // Set the first one we find as default if we removed the default...
        db.execute("update account set is_default=1 limit 1");
        StatusNet.debug("new default set!");
    }
    StatusNet.debug("done deleting!");
}

/**
 * Get an attractive description of the hostname
 * @return string
 */
StatusNet.Account.prototype.getHost = function() {
    var matches = this.apiroot.match(/^(http|https):\/\/([^\/]+)/);
    if (matches) {
        return matches[2];
    } else {
        // hmmm
        return this.apiroot;
    }
}

/**
 * Is this account set up with a secure connection?
 * @return boolean
 */
StatusNet.Account.prototype.isSecure = function() {
    return (this.apiroot.match(/^https:/));
}
