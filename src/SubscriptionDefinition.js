/* global postal */
/*jshint -W117 */
var SubscriptionDefinition = function ( channel, topic, callback ) {
	this.channel = channel;
	this.topic = topic;
    this.subscribe(callback);
	postal.configuration.bus.publish( {
		channel : postal.configuration.SYSTEM_CHANNEL,
		topic   : "subscription.created",
		data    : {
			event   : "subscription.created",
			channel : channel,
			topic   : topic
		}
	} );
	postal.configuration.bus.subscribe( this );
};

SubscriptionDefinition.prototype = {
	unsubscribe : function () {
		if ( !this.inactive ) {
			this.inactive = true;
			postal.configuration.bus.unsubscribe( this );
			postal.configuration.bus.publish( {
				channel : postal.configuration.SYSTEM_CHANNEL,
				topic   : "subscription.removed",
				data    : {
					event   : "subscription.removed",
					channel : this.channel,
					topic   : this.topic
				}
			} );
		}
	},

	defer : function () {
        this.callback.useStrategy(postal.configuration.strategies.setTimeout(0));
		return this;
	},

	disposeAfter : function ( maxCalls ) {
		if ( _.isNaN( maxCalls ) || maxCalls <= 0 ) {
			throw "The value provided to disposeAfter (maxCalls) must be a number greater than zero.";
		}
        var self = this;
        self.callback.useStrategy(postal.configuration.strategies.after(maxCalls, function() {
            self.unsubscribe.call(self);
        }));
		return self;
	},

	distinctUntilChanged : function () {
        this.callback.useStrategy(postal.configuration.strategies.distinct());
		return this;
	},

	distinct : function () {
        this.callback.useStrategy(postal.configuration.strategies.distinct({ all: true }));
		return this;
	},

	once : function () {
		this.disposeAfter( 1 );
		return this;
	},

	withConstraint : function ( predicate ) {
		if ( !_.isFunction( predicate ) ) {
			throw "Predicate constraint must be a function";
		}
        this.callback.useStrategy(postal.configuration.strategies.predicate(predicate));
		return this;
	},

	withContext : function ( context ) {
		this.callback.context(context);
		return this;
	},

	withDebounce : function ( milliseconds, immediate ) {
		if ( _.isNaN( milliseconds ) ) {
			throw "Milliseconds must be a number";
		}
		var fn = this.callback;
		this.callback = _.debounce( fn, milliseconds, !!immediate );
		return this;
	},

	withDelay : function ( milliseconds ) {
		if ( _.isNaN( milliseconds ) ) {
			throw "Milliseconds must be a number";
		}
        this.callback.useStrategy(postal.configuration.strategies.setTimeout(milliseconds));
		return this;
	},

	withThrottle : function ( milliseconds ) {
		if ( _.isNaN( milliseconds ) ) {
			throw "Milliseconds must be a number";
		}
        this.callback.useStrategy(postal.configuration.strategies.throttle(milliseconds));
		return this;
	},

	subscribe : function ( callback ) {
		this.callback = callback;
        this.callback = new Strategy({
            owner    : this,
            prop     : "callback",
            context  : this, // TODO: is this the best option?
            lazyInit : true
        });
		return this;
	}
};