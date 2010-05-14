/** StatusNet Namespace -- maybe we should just use SN? */
function StatusNet() {}

/**
 * Live database connection for local storage, if opened.
 * Most callers should rather use getDB().
 * @access private
 */
StatusNet.db = null;

/**
 * Abstracted debug interface; for Desktop version calls Titanium's debug func.
 * @param string msg
 * @return void
 */
StatusNet.debug = function(msg) {
    Titanium.API.debug(msg);
}

/**
 * Lazy-open our local storage database.
 * @return database object
 */
StatusNet.getDB = function() {

    if (this.db === null) {

        var separator = Titanium.Filesystem.getSeparator();
        var dbFile = Titanium.Filesystem.getFile(
            Titanium.Filesystem.getApplicationDataDirectory() +
            separator +
            "statusnet.db"
        );

        StatusNet.debug(
            "Application data directory = "
            + Titanium.Filesystem.getApplicationDataDirectory()
        );

        this.db = Titanium.Database.openFile(dbFile);

        var sql = 'CREATE TABLE IF NOT EXISTS account ('
            + 'id INTEGER PRIMARY KEY AUTOINCREMENT, '
            + 'username TEXT NOT NULL, '
            + 'password TEXT NOT NULL, '
            + 'apiroot TEXT NOT NULL, '
            + 'is_default INTEGER DEFAULT 0, '
            + 'last_timeline_id INTEGER, '
            + 'profile_image_url TEXT, '
            + 'UNIQUE (username, apiroot)'
            + ')';

        this.db.execute(sql);

        sql = 'CREATE TABLE IF NOT EXISTS notice_cache ('
            + 'notice_id INTEGER, '
            + 'account_id INTEGER, '
            + 'timeline TEXT NOT NULL, '
            + 'atom_entry TEXT NOT NULL, '
            + 'PRIMARY KEY (notice_id, account_id)'
            + ')';

        this.db.execute(sql);

        sql = 'CREATE TABLE IF NOT EXISTS search_history ('
            + 'searchterm TEXT NOT NULL'
            + ')';

        this.db.execute(sql);
    }

    return this.db;
}

/**
 * Show settings dialog
 * @fixme make sure it's a singleton!
 */
StatusNet.showSettings = function() {
    var win = Titanium.UI.getCurrentWindow().createWindow({
        url: 'app:///settings.html',
        title: 'Settings',
        width: 400,
        height: 500});
    win.open();
}

/**
 * Utility function to create a prototype for the subclass
 * that inherits from the prototype of the superclass.
 */
function heir(p) {
    function f(){}
    f.prototype = p;
    return new f();
}

