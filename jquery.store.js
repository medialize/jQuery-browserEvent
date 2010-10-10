/*
 * jQuery store - Plugin for persistent data storage using localStorage, userData (and window.name)
 * 
 * Authors: Rodney Rehm
 * Documentation: http://code.medialize.de/jQuery/store/
 * 
 * Licensed under the MIT License:
 *   http://www.opensource.org/licenses/mit-license.php
 *
 */

/*
 * USAGE EXAMPLES:
 *	$.store( key ) and $.store.get( key ) retrieve a value
 *	$.store( key, value ) and $.store.set( key, value ) save a value
 *	$.store.del( key ) deletes a value
 *	$.store.flush() deletes aall values
 */

(function($,undefined){

/**********************************************************************************
 * $.store base and convinience accessor
 **********************************************************************************/

$.store = function( key, value )
{
	if( value == undefined )
		return $.store.get( key );
	else
		$.store.set( key, value );
};


/**********************************************************************************
 * $.store API
 **********************************************************************************/

$.extend( $.store, {
	get: function( key )
	{
		var value = this.driver.get( key );
		return this.unserialize( value );
	},
	set: function( key, value )
	{
		this.driver.set( key, this.serialize( value ) );
	},
	del: function( key )
	{
		this.driver.del( key );
	},
	flush: function()
	{
		this.driver.flush();
	},
	driver : undefined,
	init: function()
	{
		// intialize serializers
		$.each( $.store.serializers, function()
		{
			// skip invalid processors
			if( !$.isFunction( this.init ) )
				return true; // continue;
			
			this.init();
		});
		
		// detect and initialize storage driver
		$.each( $.store.drivers, function()
		{
			// skip unavailable drivers
			if( !$.isFunction( this.available ) || !this.available() )
				return true; // continue;
			
			$.store.driver = this;
			$.store.driver.init();
			return false; // break;
		});
	},
	serialize: function( value )
	{
		$.each( $.store.encodeOrder, function()
		{
			var serializer = $.store.serializers[ this + "" ];
			if( !serializer || !serializer.encode )
				return true; // continue;

			value = serializer.encode( value );
		});

		return value;
	},
	unserialize: function( value )
	{
		$.each( $.store.decodeOrder, function()
		{
			var serializer = $.store.serializers[ this + "" ];
			if( !serializer || !serializer.decode )
				return true; // continue;

			value = serializer.decode( value );
		});

		return value;
	}
});


/**********************************************************************************
 * $.store drivers
 **********************************************************************************/

$.store.drivers = {
	// Firefox 3.5, Safari 4.0, Chrome 5, Opera 10.5, IE8
	'localStorage': {
		// see https://developer.mozilla.org/en/dom/storage#localStorage
		ident: "$.store.drivers.localStorage",
		scope: 'browser',
		available: function()
		{
			try
			{
				return !!window.localStorage;
			}
			catch(e)
			{
				// Firefox won't allow localStorage if cookies are disabled
				return false;
			}
		},
		init: $.noop,
		get: function( key )
		{
			return window.localStorage.getItem( key );
		},
		set: function( key, value )
		{
			window.localStorage.setItem( key, value );
		},
		del: function( key )
		{
			window.localStorage.removeItem( key );
		},
		flush: function()
		{
			window.localStorage.clear();
		}
	},
	
	// IE6, IE7
	'userData': {
		// see http://msdn.microsoft.com/en-us/library/ms531424.aspx
		ident: "$.store.drivers.userData",
		element: null,
		nodeName: 'userdatadriver',
		scope: 'browser',
		available: function()
		{
			try
			{
				return !!( document.documentElement && document.documentElement.addBehavior );
			}
			catch(e)
			{
				return false;
			}
		},
		init: function()
		{
			// Create a non-existing element and append it to the root element (html)
			this.element = document.createElement( this.nodeName );
			document.documentElement.appendChild( this.element );
			// Apply userData behavior
			this.element.addBehavior( "#default#userData" );
		},
		get: function( key )
		{
			this.element.load( this.nodeName );
			return this.element.getAttribute( key );
		},
		set: function( key, value )
		{
			this.element.setAttribute( key, value );
			this.element.save( this.nodeName );
		},
		del: function( key )
		{
			this.element.removeAttribute( key );
			this.element.save( this.nodeName );
			
		},
		flush: function()
		{
			// flush by expiration
			this.element.expires = (new Date).toUTCString();
			this.element.save( this.nodeName );
		}
	},
	
	// most other browsers
	'windowName': {
		ident: "$.store.drivers.windowName",
		scope: 'window',
		cache: {},
		available: function()
		{
			return true;
		},
		init: function()
		{
			this.load();
		},
		save: function()
		{
			window.name = $.store.serialize( this.cache );
		},
		load: function()
		{
			try
			{
				this.cache = $.store.unserialize( window.name );
			}
			catch(e)
			{
				this.cache = {};
				window.name = "{}";
			}
		},
		get: function( key )
		{
			return this.cache[ key ];
		},
		set: function( key, value )
		{
			this.cache[ key ] = value;
			this.save();
		},
		del: function( key )
		{
			try
			{
				delete this.cache[ key ];
			}
			catch(e)
			{
				this.cache[ key ] = undefined;
			}
			
			this.save();
		},
		flush: function()
		{
			window.name = "{}";
		}
	}
};

/**********************************************************************************
 * $.store serializers
 **********************************************************************************/

$.store.encodeOrder = [];
$.store.decodeOrder = [];

$.store.serializers = {
	
	'json': {
		ident: "$.store.serializers.json",
		init: function()
		{
			$.store.encodeOrder.push( "json" );
			$.store.decodeOrder.push( "json" );
			// encode to JSON (taken from $.jStorage, MIT License)
			this.encode = $.toJSON || Object.toJSON || ( window.JSON && ( JSON.encode || JSON.stringify ) );
			// decode from JSON (taken from $.jStorage, MIT License)
			this.decode = $.evalJSON || ( window.JSON && ( JSON.decode || JSON.parse ) );
		},
		encode: $.noop,
		decode: $.noop
	},
	
	// TODO: html serializer
	// 'html' : {},
	
	'xml': {
		ident: "$.store.serializers.xml",
		init: function()
		{
			$.store.encodeOrder.unshift( "xml" );
			$.store.decodeOrder.push( "xml" );
		},
		
		// wouldn't be necessary if jQuery exposed this function
		isXML: function( value )
		{
			var documentElement = ( value ? value.ownerDocument || value : 0 ).documentElement;
			return documentElement ? documentElement.nodeName.toLowerCase() !== "html" : false;
		},

		// encodes a XML node to string (taken from $.jStorage, MIT License)
		encode: function( value )
		{
			if( !value || value._serialized || !this.isXML( value ) )
				return value;

			var _value = { _serialized: this.ident, value: value };
			
			try
			{
				// Mozilla, Webkit, Opera
				_value.value = new XMLSerializer().serializeToString( value );
				return _value;
			}
			catch(E1)
			{
				try
				{
					// Internet Explorer
					_value.value = value.xml;
					return _value;
				}
				catch(E2){}
			}
			
			return value;
		},
		
		// decodes a XML node from string (taken from $.jStorage, MIT License)
		decode: function( value )
		{
			if( !value || !value._serialized || value._serialized != this.ident )
				return value;

			var dom_parser = ( "DOMParser" in window && (new DOMParser()).parseFromString );
			if( !dom_parser && window.ActiveXObject )
			{
				dom_parser = function( _xmlString )
				{
					var xml_doc = new ActiveXObject( 'Microsoft.XMLDOM' );
					xml_doc.async = 'false';
					xml_doc.loadXML( _xmlString );
					return xml_doc;
				}
			}

			if( !dom_parser )
			{
				return undefined;
			}
			
			value.value = dom_parser.call(
				"DOMParser" in window && (new DOMParser()) || window, 
				value.value, 
				'text/xml'
			);
			
			return this.isXML( value.value ) ? value.value : undefined;
		}
	}
}


$.store.init();

})(jQuery);