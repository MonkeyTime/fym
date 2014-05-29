chrome.alarms.create("fymbgjs", {"periodInMinutes": 1});
chrome.alarms.onAlarm.addListener(callAlarm);
	
	var d = document;
	
	window.indexedDB = window.indexedDB || window.webkitIndexedDB;
	window.IDBTransaction = window.IDBTransaction || window.webkitIDBTransaction;
	window.IDBKeyRange = window.IDBKeyRange || window.webkitIDBKeyRange;
	
	const DB_NAME = 'fym-db';
	const DB_VERSION = 1;
	const DB_STORE_NAME = 'alerts';
	
	var db = {};
	
	
	/**
	  * callAlarm
	  *
	  * listener attached to chrome.alarms.onAlarm
	  *
	  * @return void
	  */
	function callAlarm() {

		var s = (new Date()).getTime(); 
		openDb();
		var e = (new Date()).getTime();
		
		setTimeout(function() {
			filterAllPublication();
		}, (e-s)+200);
	}
	
	/**
	  * openDb
	  *
	  * Open indexedDB local database
	  *
	  * @return void
	  */
	function openDb() {
		 
		//console.log("openDb...");
		
		var req = indexedDB.open(DB_NAME, DB_VERSION);
		
		req.onsuccess = function(evt) {
			db = this.result;
			//console.log("openDb DONE");
		};
		
		req.onerror = function(evt) {
			console.error("openDb:", evt.target.errorCode);
		};
		
		req.onupgradeneeded = function(evt) {
			//console.log("openDb.onupgradeneeded");
			closeDb();
			var store = evt.currentTarget.result.createObjectStore(
			DB_STORE_NAME, { keyPath: 'id', autoIncrement: true });
			store.createIndex('url', 'url', { unique: false });
			store.createIndex('title', 'title', { unique: false });
			store.createIndex('lang', 'lang', { unique: false });
			store.createIndex('date', 'date', { unique: false });
			store.createIndex('countdown', 'countdown', { unique: false });
			store.createIndex('preview', 'preview', { unique: false });
			store.createIndex('alarm', 'alarm', { unique: false });
		};
	}
	
	/**
	  * closeDb
	  *
	  * Close indexedDB local database
	  *
	  * @return void
	  */
	function closeDb() {
		//console.log("closeDb...");
		indexedDB.close();
		//console.log("closeDb DONE");
	}
	
	/**
	  * get Object Store
	  *
	  * @param string 	storename
	  * @param string 	mode
	  *
	  * @return object 	current objectStore
	  */
	function getObjectStore(store_name, mode) {
		
		var tx = db.transaction(store_name, mode);
		
		return tx.objectStore(store_name);
	}

	function filterAllPublication() {
		
		var store = getObjectStore(DB_STORE_NAME, 'readonly');
		var req;
		var arr = new Array();
		
		req = store.openCursor();
		
		req.onsuccess = function(evt) {
				
			var cursor = evt.target.result;

			if(cursor) {
				
				//console.log("filterAllPublication cursor:", cursor);
				
				req = store.get(cursor.key);
				
				req.onsuccess = function(evt) {
				  
					var 
					//std
					value = evt.target.result,
					
					//verif
					objid   = ""+value.id+"",
					objtime = (new Date(value.alarm)).getTime() - 60000,
					curtime = Date.now();
					
					//console.log(objtime + " < " + curtime);
					
					if(+objtime < +curtime) {
						arr.push(objid+","+value.title+","+value.url);
					}			  
				}
				
				cursor.continue();
				
			} else {
				
				//console.log("No more entries");
				
				for (var i in arr) {
					
					(function() {
						
						var
						obj = arr[i],
						obj = obj.split(","),
						id  = obj[0];
						if(obj[1].length > 21) {
							obj[1] = obj[1].substring(0,  21) + '...';
						}
						
						if(typeof db == 'undefined') {
							
							var s = (new Date()).getTime(); 
							openDb();
							var e = (new Date()).getTime();
							
							setTimeout(function() {
								deletePublication(+id);
							}, (e-s)+200);
							
						} else {
							deletePublication(+id);
						}
	
						var 
						opts = {
							type: "basic",
							title: obj[1],
							message: chrome.i18n.getMessage("yourEvent") + ' "' + obj[1] + '" ' + chrome.i18n.getMessage("startEvent") + '. ' + chrome.i18n.getMessage("infoEvent"),
							iconUrl: "notify128.png"
						}
						
						chrome.notifications.create(id, opts, function(){});
						
						chrome.notifications.onClicked.addListener(function(id) {
							window.open(obj[2]);
							chrome.notifications.clear(id, function(){});
						});
						
					})();
				}
			}
		}
		
		req.onerror = function() {
			console.error("filterAllPublication error", this.error);
		};
	}

	/**
	  * deletePublication
	  *
	  * delete publication in indexedDB
	  *
	  * @param string	id of the element in DB
	  *
	  * @return void
	  */
	function deletePublication(key) {
		
		//console.log("deletePublication:", arguments);

		store = getObjectStore(DB_STORE_NAME, 'readwrite');
	
		var req = store.delete(key);
		
		req.onsuccess = function(evt) {
			//console.log("evt:", evt);
			//console.log("evt.target:", evt.target);
			//console.log("delete successful"); 
		};
			
		req.onerror = function(evt) {
			console.error("deletePublication:", evt.target.errorCode);
		};
	};