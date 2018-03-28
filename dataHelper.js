(function () {
    try {
        // Test webStorage existence.
        // noinspection JSAnnotator
        if (!window.localStorage || !window.sessionStorage) throw "exception";
        // Test webStorage accessibility - Needed for Safari private browsing.
        localStorage.setItem('storage_test', 1);
        localStorage.removeItem('storage_test');
    } catch(e) {
        (function () {
            var Storage = function (type) {
                function createCookie(name, value, days) {
                    var date, expires;

                    if (days) {
                        date = new Date();
                        date.setTime(date.getTime()+(days*24*60*60*1000));
                        expires = "; expires="+date.toGMTString();
                    } else {
                        expires = "";
                    }
                    document.cookie = name+"="+value+expires+"; path=/";
                }

                function readCookie(name) {
                    var nameEQ = name + "=",
                        ca = document.cookie.split(';'),
                        i, c;

                    for (i=0; i < ca.length; i++) {
                        c = ca[i];
                        while (c.charAt(0)===' ') {
                            c = c.substring(1,c.length); 2480
                        }

                        if (c.indexOf(nameEQ) === 0) {
                            return c.substring(nameEQ.length,c.length);
                        }
                    }
                    return null;
                }

                function setData(data) {
                    // Convert data into JSON and encode to accommodate for special characters.
                    data = encodeURIComponent(JSON.stringify(data));
                    // Create cookie.
                    if (type === 'session') {
                        createCookie(getSessionName(), data, 365);
                    } else {
                        createCookie('localStorage', data, 365);
                    }
                }

                function clearData() {
                    if (type === 'session') {
                        createCookie(getSessionName(), '', 365);
                    } else {
                        createCookie('localStorage', '', 365);
                    }
                }

                function getData() {
                    // Get cookie data.
                    var data = type === 'session' ? readCookie(getSessionName()) : readCookie('localStorage');
                    // If we have some data decode, parse and return it.
                    return data ? JSON.parse(decodeURIComponent(data)) : {};
                }

                function getSessionName() {
                    // If there is no name for this window, set one.
                    // To ensure it's unquie use the current timestamp.
                    if(!window.name) {
                        window.name = new Date().getTime();
                    }
                    return 'sessionStorage' + window.name;
                }

                // Initialise if there's already data.
                var data = getData();

                return {
                    length: 0,
                    clear: function () {
                        data = {};
                        this.length = 0;
                        clearData();
                    },
                    getItem: function (key) {
                        return data[key] === undefined ? null : data[key];
                    },
                    key: function (i) {
                        // not perfect, but works
                        var ctr = 0;
                        for (var k in data) {
                            if (ctr === i) return k;
                            else ctr++;
                        }
                        return null;
                    },
                    removeItem: function (key) {
                        delete data[key];
                        this.length--;
                        setData(data);
                    },
                    setItem: function (key, value) {
                        data[key] = value+''; // forces the value to a string
                        this.length++;
                        setData(data);
                    }
                };
            };

            // Replace window.localStorage and window.sessionStorage with out custom
            // implementation.
            var localStorage = new Storage('local');
            var sessionStorage = new Storage('session');
            // noinspection JSAnnotator
            window.localStorage = localStorage;
            // noinspection JSAnnotator
            window.sessionStorage = sessionStorage;
            // For Safari private browsing need to also set the proto value.
            window.localStorage.__proto__ = localStorage;
            window.sessionStorage.__proto__ = sessionStorage;
        })();
    }

    window.dataHelper = {
        apiUrl: '',
        hash: {
            continent: '/analytics/dns/continents',
            country: '/analytics/dns/countries',
            cdn_country: '/analytics/cdn/countries',
            provider: '/analytics/dns/provider',
            cdn_provider: '/analytics/cdn/provider',
            resolver: '/analytics/dns/resolver',
            node: '/node'
        },
        loading: {},
        host: '',
        /**
         * Init Helper
         * @param apiUrl string
         * @param hash Object
         */
        init: function (apiUrl, hash) {
          this.apiUrl = apiUrl || 'api.perfops.net';
            if(typeof hash !== 'undefined') {
                $.extend(this.hash, hash);
            }
            this.host = window.location.host;
        },
        /**
         * Get Data
         * @param target ['continent','country','cdn_country','provider','cdn_provider','resolver','node']
         * @param callback(data, target)
         * @param apiUrl
         * @param expire data expire in milliseconds
         * @param toArray boolean, convert object to array
         * @callback (data, target)
         * @returns {Array}
         */
        getData: function(target, callback, apiUrl, expire, toArray){
            var _self = this;
            //Set default apiUrl
            if(typeof apiUrl === 'undefined') apiUrl = dataHelper.apiUrl;
            //Set default expire to 24 hours
            if(typeof expire === 'undefined') expire = 60 * 60 * 1000;
            //Get data from local storage and parse JSON
            var localData = JSON.parse(localStorage.getItem(dataHelper.getSaveKey(target)));
            //Get expire date of local data
            var localDataExpire = (new Date(localStorage.getItem(dataHelper.getSaveKey(target)+'_expire'))).getTime();
            //If local data is 'OK' run callback function
            if(localData &&  localDataExpire >= (new Date()).getTime() ){
                if(typeof callback === 'function') callback.apply(_self,[localData, target]);
            } else {//Else get data from external url
                if(!dataHelper.loading[target]) {
                    if(dataHelper.hash[target]){
                        dataHelper.loading[target] = {
                            ajax: $.getJSON(apiUrl + dataHelper.hash[target]),
                            finished: false
                        };

                    } else {
                        console.log('hash of "' + target + '" not found');
                        return localData;
                    }
                }
                dataHelper.loading[target].ajax.then(function(data){
                    if(toArray === true && typeof data === 'object') {
                        data = $.map(data, function(item){ return item;});
                    }
                    if($.inArray(target,['continent','country', 'provider','resolver', 'cdn_country', 'cdn_provider']) !== -1) {
                        data = dataHelper.sortDataByField(data,'name');
                    }
                    //Save data to local storage
                    localStorage.setItem(dataHelper.getSaveKey(target),JSON.stringify(data));
                    //Save expire date of data
                    localStorage.setItem(dataHelper.getSaveKey(target)+'_expire', (new Date((new Date()).getTime()  + expire)).toString());
                    //run callback with data
                    if(typeof callback === 'function') {
                        callback.apply(_self,[data, target]);
                    }

                    dataHelper.loading[target].finished = true;
                });
            }
            //return local data
            return localData;
        },
        /**
         *
         * @param data
         * @param field
         */
        sortDataByField: function(data, field) {
            if(data && $.isArray(data) && data.length && data[0][field]) {
                data.sort(function (a, b) { return (b[field] < a[field])? 1 : (b[field] > a[field]) ? -1 : 0; });
            }
            return data;
        },
        /**
         * Get Static data
         * @param target
         * @param checkExpire
         * @returns {null|*}
         */
        getStaticData: function(target, checkExpire){
            if(typeof checkExpire !== 'undefined' && checkExpire === true) {
                var localData = JSON.parse(localStorage.getItem(dataHelper.getSaveKey(target)));
                var localDataExpire = (new Date(localStorage.getItem(dataHelper.getSaveKey(target)+'_expire'))).getTime();
                if(localDataExpire >= (new Date()).getTime()) {
                    return localData
                } else {
                    return null;
                }
            } else {
                return JSON.parse(localStorage.getItem(dataHelper.getSaveKey(target)));
            }
        },
        /**
         *
         * @param target
         * @param data
         * @param setExpire
         * @param expire
         * @returns {*}
         */
        setStaticData: function(target, data, setExpire, expire) {
            //Save data to local storage
            localStorage.setItem(dataHelper.getSaveKey(target),JSON.stringify(data));
            if(typeof setExpire !== 'undefined' && setExpire === true) {
                if(typeof expire === 'undefined' ) expire = 24 * 60 * 60 * 1000;
                localStorage.setItem(dataHelper.getSaveKey(target)+'_expire', (new Date((new Date()).getTime()  + expire)).toString());
            }
            return target;
        },
        /**
         * Run callback when everything is loaded
         * @param callback
         */
        everythingIsLoaded: function(callback) {
            var _self = this;
            var loading = $.map(_self.loading, function(n){ return n;}).filter(function(item){ if(item.finished === false) return item; });
            if(loading.length) {
                loading[0].ajax.then(function(){
                    _self.everythingIsLoaded(callback);
                });
            } else {
                callback();
            }

        },
        getSaveKey: function(target) {
            return this.host + '_' + target;
        }
    };
})();
