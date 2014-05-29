(function() {

	//var bgjs = chrome.extension.getBackgroundPage();
	
	var d = document;
	
	window.indexedDB = window.indexedDB || window.webkitIndexedDB;
	window.IDBTransaction = window.IDBTransaction || window.webkitIDBTransaction;
	window.IDBKeyRange = window.IDBKeyRange || window.webkitIDBKeyRange;
	
	const DB_NAME = 'fym-db';
	const DB_VERSION = 1;
	const DB_STORE_NAME = 'alerts';
	
	var db = {};
	
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
	
	/**
	  * addPublication
	  *
	  * add one publication in indexedDB
	  *
	  * @params	All the necessary params for the FYM DB_STORE_NAME "alerts"
	  *
	  * @return void
	  */
	function addPublication(url, title, lang, date, countdown, preview, alarm) {
		
		//console.log("addPublication arguments:", arguments);
		
		var obj = { url: url, title: title, lang: lang, date: date, countdown: countdown, preview: preview, alarm: alarm };
	
		var store = getObjectStore(DB_STORE_NAME, 'readwrite');
		var req;
		
		try {
			req = store.put(obj);
		} catch(e) {
		  if (e.name == 'DataCloneError')
			//console.log("This engine doesn't know how to clone a Blob");
			throw e;
		}
		
		req.onsuccess = function(evt) {
			//console.log("Insertion in DB successful");
		};
		
		req.onerror = function() {
			console.error("addPublication error", this.error);
		};
	}
	
	/**
	  * renderAllPublication
	  *
	  * get and render all publications from indexedDB
	  *
	  * @return void
	  */
	function renderAllPublication() {
		
		var store = getObjectStore(DB_STORE_NAME, 'readonly');
		var req;
		var trs = '';
		
		try {
			req = store.openCursor();
		} catch(e) {
			//console.log("This engine doesn't know how to openCursor");
			throw e;
		}
		
		req.onsuccess = function(evt) {
				
			var cursor = evt.target.result;
			
			if(cursor) {
				
				//console.log("getAllPublication cursor:", cursor);
				
				req = store.get(cursor.key);
				
				req.onsuccess = function(evt) {
				  
				  var value = evt.target.result;
				  
				  var obj = new Date(value.date);
				  var localDate = value.date != 'undefined' ? obj.toLocaleString() : 'undefined';
				  
				  var obj = new Date(value.countdown);
				  var localCountdown = value.countdown != 'undefined' ? convertMS(+value.countdown - Date.now()) : 'undefined';
				  
				  var obj = new Date(value.alarm);
				  var localAlarm = obj.toLocaleString();
				  
				  var localImage = value.preview != 'undefined' ? '<img src="data:image/jpg;base64,'+value.preview+'">' : 'undefined';
					
				  trs += '\
				  <tr id="item-'+value.id+'">\
					<td class="id">'+value.id+'</td>\
					<td class="title" style="max-width: 150px; overflow:hidden">'+value.title+'</td>\
					<td class="url hidden-phone" style="max-width: 150px; overflow:hidden"><a href="'+value.url+'" title="'+value.title+'" target="new">'+value.url+'</a></td>\
					<td class="lang">'+value.lang+'</td>\
					<td class="preview hidden-phone">'+localImage+'</td>\
					<td class="date">'+localDate+'</td>\
					<td class="countdown">'+localCountdown+'</td>\
					<td class="alarm">'+localAlarm+'</td>\
					<td class="action"><a id="delete-'+value.id+'" class="del" href="#">'+chrome.i18n.getMessage("delete")+'</a></td>\
				  </tr>';
				}
				
				cursor.continue();
				
			} else {
				//console.log("No more entries");	
				render('items', trs);
			}
		}
		
		req.onerror = function() {
			console.error("getAllPublication error", this.error);
		};
	}

	/**
	  * render
	  *
	  * render for html content
	  *
	  * @param string	id of the container
	  * @param string	html content to render
	  *
	  * @return stdOut
	  */
	function render(htmlId, content) {
		d.getElementById(htmlId).innerHTML = content;
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
	
	/**
	  * Event id "populate" - populate the table list (options page)
	  *
	  * @return void
	  */
	var populate = d.getElementById('items');
	
	if(populate) {
	  		
		var s = (new Date()).getTime(); 
		openDb();
		var e = (new Date()).getTime();
		
		setTimeout(function() {
			renderAllPublication();
		}, (e-s)+200);
	}
	 
	/**
	  * Add all Events click "delete" in table-list 
	  *
	  * @return void
	  */ 
	var testExist = d.getElementById('table-list');

	if(testExist) {
		
		startAnimationTime();
		
		setTimeout(function() {
			
			var allIds = d.getElementsByTagName('a');
			var len = allIds.length;
			var each;
			
			for(var i = 0; i < len; i++) {
				
				(function () {
					
					each = allIds[i];
					
					if (each.id && each.id.indexOf("delete-") == 0) {
						
						var idInDB = each.id.split('-')[1];
						
						each.addEventListener('click', function(evt) {
							
							deletePublication(+idInDB);
							//console.log(+idInDB);
							d.getElementById('item-' + idInDB).setAttribute('style', 'display: none');
							
							evt.preventDefault();
						});
					}
					
				})();
			}
		}, 800);
	}
	
	/**
	  * Event click "add" url 
	  *
	  * @return void
	  */
	var btnAdd = d.getElementById('add');
	
	if(btnAdd) {
		
		btnAdd.innerHTML = chrome.i18n.getMessage("btnAdd");
		
		btnAdd.addEventListener('click', function() {
			
			chrome.tabs.query({
				active: true, // Select active tabs
				lastFocusedWindow: true // In the current window
			}, function(tabsArray) {
		
				var 
				tab       = tabsArray[0],
				theLink   = tab.url,
				theTitle  = tab.title;
				
				chrome.tabs.captureVisibleTab(tab.windowId, {"format":"png"}, function(thumb) {
					d.getElementById('imgData').value = thumb != 'undefined' ? thumb : 'undefined';
				});
				   
		
				chrome.tabs.detectLanguage(tab.id, function(lang) {
					d.getElementById('lang').value = lang ? lang : null;
				});
				
				//inputs
				d.getElementById('url').value = theLink ? theLink : null;
				d.getElementById('title').value = theTitle ? theTitle : null;
				
				//display
				d.getElementById('labelUrl').setAttribute('style', 'display: block');
				d.getElementById('whenBtnAddIsClicked').setAttribute('style', 'display: block');
				
			});
		});
	}
	
	/**
	  * Event change "url" url
	  *
	  * @return void
	  */
	var inputUrl = d.getElementById('url');
	
	if(inputUrl) {
		
		inputUrl.setAttribute('placeholder', chrome.i18n.getMessage("inputUrlPlaceholder"));
		
		inputUrl.addEventListener('textInput', function() {
			
			//display
			d.getElementById('labelUrl').setAttribute('style', 'display: block');
			d.getElementById('whenBtnAddIsClicked').setAttribute('style', 'display: block');
		});
	}
	
	/**
	  * Event click "clear"
	  *
	  * @return void
	  */
	var btnClear = d.getElementById('clear');
	
	if(btnClear) {
		
		btnClear.innerHTML = chrome.i18n.getMessage("btnClear");
		
		btnClear.addEventListener('click', function() {
			
			//hidden inputs reset
			d.getElementById('lang').value = null;
			d.getElementById('imgData').value = null;
			
			//inputs reset
			d.getElementById('url').value = null;
			d.getElementById('title').value = null;
			d.getElementById('date').value = null;
			d.getElementById('time').value = null;
			d.getElementById('day').value = null;
			d.getElementById('count').value = null;
			
			//displays reset
			d.getElementById('labelUrl').setAttribute('style', 'display: none');
			d.getElementById('whenBtnAddIsClicked').setAttribute('style', 'display: none');	
		});
	}
	
	/**
	  * Event click "datetime" tab
	  *
	  * @return void
	  */
	var btnDatetime = d.getElementById('datetime');
	
	if(btnDatetime) {
		
		d.getElementById('labelDateTime').innerHTML = chrome.i18n.getMessage("labelDateTime");
		
		btnDatetime.addEventListener('click', function() {
			
			d.getElementById('day').value = null;
			d.getElementById('count').value = null;
			d.getElementById('datetimer').setAttribute('style', 'display: block');
			d.getElementById('counter').setAttribute('style', 'display: none');
		});
	}
	
	/**
	  * Event click "countdown" tab
	  *
	  * @return void
	  */
	var btnCountdown = d.getElementById('countdown');
	
	if(btnCountdown) {
		
		d.getElementById('labelDayCount').innerHTML = chrome.i18n.getMessage("labelDayCount");
		d.getElementById('day').setAttribute('placeholder', chrome.i18n.getMessage("inputPlaceholderDay"));
		d.getElementById('count').setAttribute('placeholder', chrome.i18n.getMessage("inputPlaceholderCount"));
		
		btnCountdown.addEventListener('click', function() {
			
			d.getElementById('date').value = null;
			d.getElementById('time').value = null;
			d.getElementById('datetimer').setAttribute('style', 'display: none');
			d.getElementById('counter').setAttribute('style', 'display: block');
		});
	}
	
	/**
	  * Event click "validate"
	  *
	  * Add alarm and datas in indexedDB
	  *
	  * @return void
	  */
	var btnValidate = d.getElementById('validate');
	
	if(btnValidate) {
		
		d.getElementById('validate').innerHTML = chrome.i18n.getMessage("btnValidate");
		d.getElementById('labelUrl').innerHTML = chrome.i18n.getMessage("labelUrl");
		d.getElementById('title').setAttribute('placeholder', chrome.i18n.getMessage("inputTitle"));
		d.getElementById('labelTitle').innerHTML = chrome.i18n.getMessage("labelTitle");
		d.getElementById('datetime').innerHTML = chrome.i18n.getMessage("btnDatetime");
		d.getElementById('countdown').innerHTML = chrome.i18n.getMessage("btnCountdown");
		
		btnValidate.addEventListener('click', function() {
			
			if(d.getElementById('date').value) {
				
				d.getElementById('message').setAttribute('style', '');
				
				//hidden inputs
				var 
				lang    = d.getElementById('lang').value,
				imgData = d.getElementById('imgData').value,
				
				//inputs std
				url   = d.getElementById('url').value,
				title = d.getElementById('title').value,
				date  = d.getElementById('date').value,
				time  = d.getElementById('time').value,
				lang  = d.getElementById('lang').value;
				
				//saved
				var 
				date = date.split('-'),
				time = time.split(':'),
				countdown = 'undefined',
				alarm = new Date(date[0], date[1] - 1, date[2], time[0], time[1]),
				alarm = alarm.toGMTString(),
				date = alarm;
				
				var s = (new Date()).getTime(); 
				openDb();
				var e = (new Date()).getTime();
				
				setTimeout(function() {
					addPublication(url, title, lang, date, countdown, imgData, alarm);
				}, (e-s)+200);	
				
				translate('message', 'publicationAdded');
				
				setTimeout(function() {
					d.getElementById('message').setAttribute('style', 'display:none');
				}, 800);
			
			} else if(d.getElementById('day').value) {
				
				//hidden inputs
				var 
				lang    = d.getElementById('lang').value,
				imgData = d.getElementById('imgData').value,
				
				//inputs std
				url   = d.getElementById('url').value,
				title = d.getElementById('title').value,
				day   = d.getElementById('day').value,
				count = d.getElementById('count').value,
				lang  = d.getElementById('lang').value;
				
				//saved
				var 
				date = 'undefined',
				time = count.split(':'),
				countdown = Date.now() + (day * 24 * 60 * 60 * 1000) + (time[0] * 60 * 60 * 1000) + (time[1] * 60 * 1000),
				alarm = new Date(countdown),
				alarm = alarm.toGMTString();
				
				var s = (new Date()).getTime(); 
				openDb();
				var e = (new Date()).getTime();
				
				setTimeout(function() {
					addPublication(url, title, lang, date, countdown, imgData, alarm);
				}, (e-s)+200);
				
				translate('message', 'publicationAdded');
				
				setTimeout(function() {
					var elem = d.getElementById('message');
					elem.parentNode.removeChild(elem);
				}, 800);
		
			} else {
				//console.log('Error: No value specified');
			}
		});
	}
	
	/**
	  * translate
	  *
	  * translate it and display it
	  *
	  * @param string	id of the container
	  * @param string	translation id in the i18n messages.json file
	  *
	  * @return stdOut
	  */
	function translate(htmlId, jsonId) {
		d.getElementById(htmlId).innerHTML = chrome.i18n.getMessage(jsonId);
	}
	
	/**
	  * All <th id="i18n-*" exists ? translate it
	  *
	  * @return void
	  */
	var allThs = d.getElementsByTagName('th');
	
	if(allThs) {
		
		var len = allThs.length;
		var each;
		
		for(var i = 0; i < len; i++) {
				
			each = allThs[i];
			
			if (each.id && each.id.indexOf("i18n-") == 0) {
				
				var jsonId = each.id.split('-')[1];
				
				translate(each.id, jsonId);
			}
		}
	}
	
	/**
	  * startAnimationTime
	  *
	  * Simple display time function and animate it
	  *
	  */
	function startAnimationTime() {
		
		var today = new Date();
		var local = new Date(today);
		
		d.getElementById('time').innerHTML = local;
		
		setTimeout(function() {
			startAnimationTime();
		}, 1000);
	}
	
	/**
	  * convertMS
	  *
	  * Simple converter microtime to countdown
	  *
	  * @param int	the time in microsecondes to convert
	  *
	  * @return string	 the formated string "x days + x hours + x mins + x secs"
	  *
	  */
	function convertMS(ms) {
		
		var d, h, m, s;
		s = Math.floor(ms / 1000);
		m = Math.floor(s / 60);
		s = s % 60;
		h = Math.floor(m / 60);
		m = m % 60;
		d = Math.floor(h / 24);
		h = h % 24;
		
		return ((d > 0) ? d + ' day' + (d > 1 ?  's, ' : ', ') : '') 
			 + ((d > 0 && h >= 0 || d == 0 && h > 0) ? h + ' hour' + (h > 1 ?  's, ' : ', ') : '') 
			 + ((h > 0 && m >= 0 || h == 0 && m > 0) ? m + ' min' + (m > 1 ?  's, ' : ', ') : '') 
			 + ((m > 0 && s >= 0 || m == 0 && s > 0) ? s + ' sec' + (s > 1 ?  's' : '') : '');
	};
	
	/**
	  * format 
	  *
	  * Format the date obj
	  *
	  * @extend Date.prototype
	  *
	  * @param string	the desired format
	  *
	  * @return string	the formated date
	  */
	Date.prototype.format = function(format) {
	  
	  var o = {
		"M+" : this.getMonth()+1,
		"d+" : this.getDate(),
		"h+" : this.getHours(),
		"m+" : this.getMinutes(),
		"s+" : this.getSeconds(),
		"q+" : Math.floor((this.getMonth()+3)/3),
		"S" : this.getMilliseconds()
	  }
	
	  if(/(y+)/.test(format)) 
		format = format.replace(RegExp.$1,(this.getFullYear()+"").substr(4 - RegExp.$1.length));
	  
	  for(var k in o) if(new RegExp("("+ k +")").test(format))
		format = format.replace(RegExp.$1, RegExp.$1.length==1 ? o[k] : ("00"+ o[k]).substr((""+ o[k]).length));
	  
	  return format;
	}
	
	/**
	  * unixConverter
	  *
	  * Convert Unix to javascript usage (in milliseconds)
	  *
	  * @param int	 the unix time to convert
	  *
	  * @return string	the formated date + time
	  */
	function unixConverter(unix) {
		
		var a = new Date(unix * 1000);
		var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
		var year = a.getFullYear();
		var month = months[a.getMonth()];
		var day = a.getDate();
		var hour = a.getHours();
		var min = a.getMinutes();
		var sec = a.getSeconds();
		var time =  year+'-'+month+'-'+day+' '+hour+':'+min+':'+sec;
		
		return time;
	}
	
	/**
	  * get Timestamp (javascript) from a date (e.g. from 2014-12-31 00:00:00)
	  *
	  * @return string	the timestamp in milliseconds (javascript work with milliseconds)
	  */
	function getTimestamp(str) {
		
		var d = str.match(/\d+/g);
		
		return +new Date(d[0], d[1] - 1, d[2], d[3], d[4], d[5]);
	}
})();