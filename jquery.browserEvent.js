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
	
	// locking, some sort of
	lock: false,
	lockTimeout: 100,
	lockInterval: 10,
	_lockInterval: null,
	
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
	},

	
	requestLock: function( callback )
	{
		try
		{
			if( this._lockInterval )
				window.clearTimeout( this._lockInterval );
		}
		catch(e){}
		
		var that = this,
			lock = _store.get( 'browserEventLock' ),
			now = (new Date()).getTime();
		
		// retry if there's a lock that has not timed out
		if( lock && lock > now - that.lockTimeout )
		{
			this._lockInterval = window.setTimeout( function()
			{
				that.requestLock.call( that ); 
			}, this.lockInterval );
		}
		
		_store.set( 'browserEventLock', now );
		this.lock = true;
		callback.call( this );
	},
	
	releaseLock: function()
	{
		if( !this.lock )
			return;
		
		_store.del( 'browserEventLock' );
		this.lock = true;
	},

	poll: function()
	{
		try
		{
			if( this._pollInterval )
				window.clearTimeout( this._pollInterval );
		}
		catch(e){}
		
		var that = this;
		
		// TODO: acquire lock

		this.dispatchEvents();
		this.updateRegistry();
		this.send();

		this.releaseLock();
		
		// renew poll
		this._pollInterval = window.setTimeout( function()
		{
			that.requestLock.call( that, that.poll ); 
		}, this.pollInterval );
	},
		
	send: function()
	{
		// send queue
		var that = this;
		if( this.registry && this.queue.length )
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
	
	dispatchEvents: function()
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
	},
	
	updateRegistry: function()
	{
		// load windows registry
		var that = this,
			registry = _store.get( 'browserEventRegistry' ) || {},
			registryHash = [],
			now = (new Date()).getTime(),
			altered = false;
		
		$.each( registry, function( win, time )
		{
			if( !win || time < now - that.registryTimeout )
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
		
		registry[ this.ident ] = now;
		_store.set( 'browserEventRegistry', registry );
	
		registryHash.sort()
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
		var registry = _store.get( 'browserEventRegistry' ) || {};

		this.registerChecksDone = 0;
		registry[ this.ident ] = (new Date()).getTime();
		_store.set( 'browserEventRegistry', registry );
		
		this.releaseLock();
		this.ready();
	},

	ready: function()
	{
		$.browserEvent.ready.call( $.browserEvent );
		
		// run poller
		this.requestLock( this.poll );
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
		this.requestLock( this.register );
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