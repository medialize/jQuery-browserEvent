# jQuery browserEvent #

$.browserEvent() was intended to allow passing messages between unrelated browser windows. 
So if you open a page twice, the two pages could synchronize their states. 
The plugin was written before any browser had SharedWorker implemented - which makes message passing possible natively.
But at this time only Chrome supports SharedWorkers.

Have a look at the [demo](http://medialize.github.com/jquery-browserEvent) to see it in action.

## Basic concept ##

Use localStorage as the central data exchange point. 
This of course means repeatedly reading and writing to that data point.
(Race conditions are possible, but unlikely.)

## Dependencies ##

* jQuery 1.6 (was originally written on 1.4.2)
* [jQuery.store](https://github.com/medialize/jQuery-store) (localStorage interface)
* JSON2 (for older Internet Explorers)

## Usage ##

<pre><code>
$(function(){
	// initialize storage
	$.storage = new $.store();
	$.storageWindow = new $.store('windowName');
	// let us know when we're ready
	$.browserEvent.ready = function() {
		window.console && console.log("$.browserEvent is ready for business");
	};
	// init browserEvent
	$.browserEvent
		// callback for list of connected windows
		.bind('browserWindows', handleWindowUpdate)
		// callback for proprietary message event
		.bind('message', handleMessageevent)
		// Run Forrest, Run!
		.init( $.storage, $.storageWindow );
	
	// send event to specific window (ident passed to handleWindowUpdate for registration)
	$.browserWindow.trigger('message', "some data to send", windowIdent);
	
	// send event to all windows
	$.browserWindow.trigger('message', "hello my friends");
	
	// add other events
	$.browserWindow.bind('foo', handleFooEvent);
	$.browserWindow.trigger('foo', "Bar!");
});
</code></pre>

## License ##

$.browserEvent is published under the [MIT license](http://www.opensource.org/licenses/mit-license.php).