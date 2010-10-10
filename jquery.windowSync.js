(function($,undefined){

var $buttons;

var log = function( m )
{
	$('<p>'+ m +'</p>').insertAfter( $buttons );
}

var poll = function()
{
	log( $.store.get( 'event' ) );
}

var push = function()
{
	$.store.set( 'event', new Date() );
}

$(function()
{
	$buttons = $( '<div></div>' ).appendTo( $( document.body ) );

	$( '<button type="button">push</button>' ).appendTo( $buttons ).bind( 'click', function()
	{
		window.setInterval( push, 500 );
	});
	
	$( '<button type="button">poll</button>' ).appendTo( $buttons ).bind( 'click', function()
	{
		window.setInterval( poll, 1000 );
	});
	
//	log( "Detected storage method: <strong>" + ssw.implementation.name + "</strong>" );
	
});






})(jQuery);