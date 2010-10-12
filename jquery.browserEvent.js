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

// TODO: registry must be cleaned after a window has not updated itself...

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
		// TODO: acquire lock
		
		// send queue
		var that = this;
		if( this.registry && this.registry.length )
		{
			$.each( this.registry, function( i, win )
			{
				if( win == that.ident )
					return true; // continue;
			
				var windowQueue = _store.get( win ) || [];
		
				windowQueue = queue.concat( that.queue );
				_store.set( win, windowQueue );
			});
		}
		
		// clean queue
		this.queue = [];
		this.sending = false;
	},
	
	poll: function()
	{
		var events = _store.get( this.ident );
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
		var registry = _store.get( 'browserEventRegistry' ) || [],
			registryHash = registry.join( '#' );
		
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
		var register = _store.get( 'browserEventRegistry' );
		if( !register )
			register = [];

		var that = this,
			registry = false;

		$.each( register, function( key, value ){
			if( value == that.ident )
			{
				registry = true;
				return false; // break;
			}
		});
		
		if( registry )
		{
			if( this.registerChecksDone++ > this.registerChecks )
			{
				this.ready();
				return;
			}
		}
		else
		{
			this.registerChecksDone = 0;
			register.push( this.ident );
			register[ this.ident ] = 1;
		
			_store.set( 'browserEventRegistry', register );
		}
		
		// check that the register is still available
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