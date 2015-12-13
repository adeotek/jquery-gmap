/**
 * jQuery plug-in for rendering google maps
 *
 * Markers structure: [lat: 0, lng: 0, address: '', byAddress: false, title: '', desc: '', icon: '']
 */
(function($) {
	"use strict";

	$.fn.gMap = function(options) {
		if(typeof(google.maps)!=='object') { return false; }
		var args = Array.prototype.slice.call(arguments,1); // for a possible method call
		var res = this; // what this function will return (this jQuery object by default)
		this.each(function(i,_element) { // loop each DOM element involved
			var element = $(_element);
			var map = element.data('gMap'); // get the existing gMap object (if any)
			var result; // the returned value of this single method call
			if(typeof(options)==='string') {// a method call
				console.log('METHOD');
				if(map && $.isFunction(map[options])) {
					console.log(options);
					result = map[options].apply(map,args);
					if(!i) { res = result; }
					if(options==='destroy') {
						console.log('DESTROY');
						element.removeData('gMap');
						element.innerHTML = '';
					}//if(options==='destroy')
				}//if(map && $.isFunction(map[options]))
			} else if(!map) {// initialization
				map = new gMap(element,options,_element);
				element.data('gMap',map);
				map['show'].apply(map,args);
			}//if(typeof(options)==='string')
		});
		return res;
	};//END $.fn.gMap = function(options)

	// overcome sucky view-option-hash and option-merging behavior messing with options it shouldn't
	function isForcedAtomicOption(name) {
		// Any option that ends in "Time" or "Duration" is probably a Duration,
		// and these will commonly be specified as plain objects, which we don't want to mess up.
		return /(Time|Duration)$/.test(name);
	}//function isForcedAtomicOption
	/**
	 * Recursively combines option hash-objects.
	 * Better than `$.extend(true, ...)` because arrays are not traversed/copied.
	 * called like: mergeOptions(target, obj1, obj2, ...)
	 */
	function mergeOptions(target) {
		function mergeIntoTarget(name,value) {
			if($.isPlainObject(value) && $.isPlainObject(target[name]) && !isForcedAtomicOption(name)) {
				// merge into a new object to avoid destruction
				target[name] = mergeOptions({}, target[name], value); // combine. `value` object takes precedence
			} else if (value !== undefined) { // only use values that are set and not undefined
				target[name] = value;
			}//END if
		}//END function mergeIntoTarget

		for(var i=1;i<arguments.length;i++) { $.each(arguments[i],mergeIntoTarget); }
		return target;
	}//END function mergeOptions

	var defaultOptions = {
		zoom: 7,
		center: new google.maps.LatLng(45.899912,24.797944),
		backgroundColor: '#ffffff',
		mapTypeId: google.maps.MapTypeId.ROADMAP,
		centerOnWindowResize: true,
		markers: []
	};

	function gMap(element,iOptions,_element) {
		var t = this;
		t.map = null;
		t._element = _element;
		t.options = mergeOptions(defaultOptions,(iOptions || {}));
		t.markers = t.options.markers;
		t.options.markers = null;

		t.getLatLng = function(lat,lng) {
			if(is_numeric(lat) && is_numeric(lng)) { return new google.maps.LatLng(lat,lng); }
			return null;
		};//END getLatLng

		t.getLatLngFromAdderss = function(address) {
			if(address && address.length) {
				var geocoder = new google.maps.Geocoder();
				geocoder.geocode({'address': address},function(results,status) {
					if(status==google.maps.GeocoderStatus.OK) {
						return results[0].geometry.location;
					} else {
						return null;
					}//if(status==google.maps.GeocoderStatus.OK)
				});
			}//if(address && address.length)
			return null;
		};//END getLatLngFromAdderss

		t.addMarker = function(marker) {
			var newMarker = prepareMarker(marker);
			if(typeof(newMarker)!='object') { return false; }
			var gMarker = new google.maps.Marker({
				position: newMarker.position,
				title: newMarker.infoTitle,
				icon: newMarker.icon,
				map: t.map
			});
			if(newMarker.infoTitle || newMarker.infoContent) {
				var infoString = (newMarker.infoTitle ? '<h5 class="small">'+newMarker.infoTitle+'</h5>' : '')
					+(newMarker.infoContent ? '<p class="remove-bottom">'+newMarker.infoContent+'</p>' : '');
				var infowindow = new google.maps.InfoWindow({
					content: infoString,
					maxWidth: newMarker.infoMaxWidth
				});
				google.maps.event.addListener(gMarker,'click',function() {
					infowindow.open(t.map,gMarker);
				});
			}//if(newMarker.infoTitle || newMarker.infoContent)
		};//END addMarker

		t.show = function(zoom,marker) {
			if(is_numeric(zoom)) { t.options.zoom = zoom; }
			if(typeof(marker)=='object') {
				t.markers[t.markers.length] = marker;
				if(is_numeric(marker.lat) && is_numeric(marker.lng)) {
					t.options.center = t.getLatLng(marker.lat,marker.lng);
				}//if(is_numeric(marker.lat) && is_numeric(marker.lng))
			} else if(typeof(t.markers)=='object' && t.markers.length>0) {
				t.options.center = getCenter(t.markers);
			}//if(typeof(marker)=='object')
			google.maps.event.addDomListener(window,'load',initialize);
			if(t.options.centerOnWindowResize && typeof(t.options.center)=='object') {
				$(window).on('resize',function() {
					var timer = window.setTimeout(function() {
						window.clearTimeout(timer);
						gMap.map.panTo(t.options.center);
					},30);
				});
			}//if(t.options.centerOnWindowResize && typeof(t.options.center)=='object')
		};//END show

		t.claerMarkers = function() {
			t.markers = {};
		};//END claerMarkers

		t.mapOptions = function() {
			return getMapOptions(t.options);
		};//END mapOptions

		function getMapOptions(options) {
			if(typeof(options)!='object') { return null; }
			return {
				zoom: options.zoom,
				center: options.center,
				backgroundColor: options.backgroundColor,
				mapTypeId: options.mapTypeId
			};
		}//END function getMapOptions

		function prepareMarker(marker) {
			if(typeof(marker)!='object') { return false; }
			if(marker.byAddress===true || marker.byAddress===1) {
				var position = t.getLatLngFromAdderss(marker.address);
			} else {
				var position = t.getLatLng(marker.lat,marker.lng);
			}//if(marker.byAddress===true || marker.byAddress===1)
			if(typeof(position)!='object') { return false; }
			var infoTitle = (marker.title && marker.title.length) ? marker.title : null;
			var infoContent = (marker.desc && marker.desc.length) ? marker.desc : null;
			var pMarket = {
				position: position,
				icon: marker.icon,
				infoTitle: infoTitle,
				infoContent: infoContent,
				infoMaxWidth: 300
			};
			return pMarket;
		}//END function prepareMarker

		function getCenter(markers) {
			if((typeof(markers)!='array' && typeof(markers)!='object') || markers.length<=0) { return null; }
			var minLat = 0, maxLat = 0, minLng = 0, maxLng = 0, cLat = 0, cLng = 0;
			for(var i=0;i<markers.length;i++) {
				var pMarker = prepareMarker(markers[i]);
				if(typeof(pMarker)!='object' || pMarker.length<=0) { continue; }
				if(i==0) {
					minLat = pMarker.position.lat();
					maxLat = pMarker.position.lat();
					minLng = pMarker.position.lng();
					maxLng = pMarker.position.lng();
				} else {
					minLat = Math.min(minLat,pMarker.position.lat());
					maxLat = Math.max(maxLat,pMarker.position.lat());
					minLng = Math.min(minLng,pMarker.position.lng());
					maxLng = Math.max(maxLng,pMarker.position.lng());
				}//if(i==0)
			}//END for
			cLat = (minLat+maxLat)/2;
			cLng = (minLng+maxLng)/2;
			if(cLat>0 && cLng>0) { return t.getLatLng(cLat,cLng); }
			return null;
		}//END function getCenter

		function initialize() {
			t.map = new google.maps.Map(t._element,t.mapOptions());
			if((typeof(t.markers)=='array' || typeof(t.markers)=='object') && t.markers.length>0) {
				for(var i=0;i<t.markers.length;i++) { t.addMarker(t.markers[i]); }
			}//if((typeof(t.markers)=='array' || typeof(t.markers)=='object') && t.markers.length>0)
		}//END initialize
	};//END gMap
})(jQuery);