/*
 * jQuery browserEvent - Plugin for passing events to other browser windows running the same page
 * 
 * Authors: Rodney Rehm
 * Documentation: http://code.medialize.de/jQuery/store/
 * 
 * Licensed under the MIT License:
 *   http://www.opensource.org/licenses/mit-license.php
 *
 */

/*
 * No, this utility has got nothing in common with window.postMessage() and EventSource
 * 	http://dev.w3.org/html5/postmsg/
 * 	http://dev.w3.org/html5/eventsource/
 */

// TODO: some sort of locking to avoid race-conditions in registry- and event-queue read/writes

(function($,undefined){

var _store = null,
	_winStore = null,
	browserEvent = {
	// window identification in registry
	ident: null,
	identPattern: /^browserEvent_([0-9]+)$/,

	// checking events for this window
	pollInterval: 200,
	_pollInterval: null,
	
	// registry of other windows
	registry: [],
	registryHash: null,
	registryTimeout: 600,
	
	// events to send to other windows
	queue: [],
	sending: true, // wait for ready
	
	// race-condition hack to inexstent locking problem
	registerChecks: 3,
	registerChecksDone: 0,
	
	bind: function( event, callback )
	{
		$( window )[ $.fn.bindDetached ? 'bindDetached' : 'bind' ]( event, callback );
	},
	
	unbind: function( event )
	{
		$( window ).unbind( event );
	},

	trigger: function( event, data )
	{
		this.queue.push( { event:event, data:data } );
		if( !this.sending )
			this.send();
	},
	
	send: function()
	{
		// TODO: race-condition-locking
		
		// send queue
		var that = this;
		if( this.registry )
		{
			$.each( this.registry, function( win, time )
			{
				if( win == that.ident )
					return true; // continue;
			
				var queue = _store.get( win ) || [];
				queue = queue.concat( that.queue );
				_store.set( win, queue );
			});
		}
		
		// clean queue
		this.queue = [];
		this.sending = false;
	},
	
	poll: function()
	{
		var events = _store.get( this.ident );
		
		// make sure events is an array
		if( events === null || events.length == undefined )
		{
			events = [];
			_store.set( this.ident, [] );
		}
		
		// dispatch browser events
		if( events && events.length )
		{
			_store.set( this.ident, [] );
			$.each( events, function()
			{
				$( window ).trigger( this.event, [this.data] );
			});
		}
		
		// load windows registry
		var registry = _store.get( 'browserEventRegistry' ) || {},
			registryHash = [],
			now = (new Date()).getTime(),
			altered = false;
		
		$.each( registry, function( win, time )
		{
			if( !win || time < now - this.registryTimeout )
			{
				altered = true;
				
				try
				{
					delete registry[ win ];
				}
				catch( e )
				{
					registry[ win ] = undefined;
				}
			}
			
			registryHash.push( win );
		});
		
		if( altered )
			_store.set( 'browserEventRegistry', registry );
	
		registryHash = registryHash.join( '#' );
		
		// update windows registry
		if( registryHash != this.registryHash )
		{
			this.registry = registry;
			this.registryHash = registryHash;
			$( window ).trigger( 'browserWindows', [this.registry] );
		}
	},

	register: function()
	{
		var that = this,
			registry = _store.get( 'browserEventRegistry' ) || {},
			registered = false;

		$.each( registry, function( win, value )
		{
			if( win == that.ident )
			{
				registered = true;
				return false; // break;
			}
		});
		
		if( registered )
		{
			// race-condition workaround
			if( this.registerChecksDone++ > this.registerChecks )
			{
				this.ready();
				return;
			}
		}
		else
		{
			this.registerChecksDone = 0;
			registry[ this.ident ] = (new Date()).getTime();
		
			_store.set( 'browserEventRegistry', registry );
		}
		
		// check that the register is still available
		// vary interval because of race-conditions due to missing locking
		var that = this;
		window.setTimeout( function()
		{
			that.register.call( that );
		}, Math.ceil( Math.random() * 100 ) );
	},

	ready: function()
	{
		// run poller
		this.poll();
		
		// send events that queued up during init
		if( this.queue.length )
			this.send();
		else
			this.sending = false;

		// activate poller
		var that = this;
		this._pollInterval = window.setInterval( function(){ that.poll.call( that ); }, this.pollInterval );
		
		$.browserEvent.ready.call( $.browserEvent );
	},

	init: function( storage, winStorage )
	{
		// abort if storage is incapable of inter-window communication
		if( !storage || storage.driver.scope != "browser" )
			return;
		
		_store = storage;
		_winStore = winStorage;

		// identify this window
		if( !this.ident )
		{
			// save ident in window.name to keep accross document changes
			this.ident = _winStore.get( 'browserEventIdent' );
			if( !this.ident || !this.ident.match( this.identPattern ) )
				this.ident = 'browserEvent_' + Math.floor((new Date).getTime() + Math.random() * 10000 );
			
			_winStore.set( 'browserEventIdent', this.ident );
		}

		// register this window
		this.register();
	}
};

/**********************************************************************************
 * $.browserEvemt API
 **********************************************************************************/

$.browserEvent = function( event, callback )
{
	if( callback != undefined && !$.isFunction( callback ) )
		browserEvent.bind( event, callback );
	else
		browserEvent.trigger( event, callback );
};

$.extend( $.browserEvent, {
	ready: $.noop,
	init: function( storage, winStorage ){ 
		browserEvent.init( storage, winStorage ); 
		return $.browserEvent;
	},
	bind: function( event, callback )
	{ 
		browserEvent.bind( event, callback ); 
		return $.browserEvent;
	},
	unbind: function( event )
	{ 
		browserEvent.unbind( event ); 
		return $.browserEvent;
	},
	trigger: function( event, data )
	{ 
		browserEvent.trigger( event, data ); 
		return $.browserEvent;
	},
	ident: function()
	{ 
		return browserEvent.ident 
	}
});

})(jQuery);