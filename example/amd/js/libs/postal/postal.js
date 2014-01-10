/*
 postal
 Author: Jim Cowart (http://freshbrewedcode.com/jimcowart)
 License: Dual licensed MIT (http://www.opensource.org/licenses/mit-license) & GPL (http://www.opensource.org/licenses/gpl-license)
 Version 0.8.9
 */
/*jshint -W098 */
(function ( root, factory ) {
	if ( typeof module === "object" && module.exports ) {
		// Node, or CommonJS-Like environments
		module.exports = function ( _ ) {
			_ = _ || require( "underscore" );
			return factory( _ );
		};
	} else if ( typeof define === "function" && define.amd ) {
		// AMD. Register as an anonymous module.
		define( ["underscore"], function ( _ ) {
			return factory( _, root );
		} );
	} else {
		// Browser globals
		root.postal = factory( root._, root );
	}
}( this, function ( _, global, undefined ) {

	var postal;

	var Strategy = function( options ) {
	    var _target = options.owner[options.prop];
	    if ( typeof _target !== "function" ) {
	        throw new Error( "Strategies can only target methods." );
	    }
	    var _strategies = [];
	    var _context = options.context || options.owner;
	    var strategy = function() {
	        var idx = 0;
	        var next = function next() {
	            var args = Array.prototype.slice.call( arguments, 0 );
	            var thisIdx = idx;
	            var strategy;
	            idx += 1;
	            if ( thisIdx < _strategies.length ) {
	                strategy = _strategies[thisIdx];
	                strategy.fn.apply( strategy.context || _context, [next].concat( args ) );
	            } else {
	                _target.apply( _context, args );
	            }
	        };
	        next.apply( this, arguments );
	    };
	    strategy.target = function() {
	        return _target;
	    };
	    strategy.context = function( ctx ) {
	        if ( arguments.length === 0 ) {
	            return _context;
	        } else {
	            _context = ctx;
	        }
	    };
	    strategy.strategies = function() {
	        return _strategies;
	    };
	    strategy.useStrategy = function( strategy ) {
	        var idx = 0,
	            exists = false;
	        while ( idx < _strategies.length ) {
	            if ( _strategies[idx].name === strategy.name ) {
	                _strategies[idx] = strategy;
	                exists = true;
	                break;
	            }
	            idx += 1;
	        }
	        if ( !exists ) {
	            _strategies.push( strategy );
	        }
	    };
	    strategy.reset = function() {
	        _strategies = [];
	    };
	    if ( options.lazyInit ) {
	        _target.useStrategy = function() {
	            options.owner[options.prop] = strategy;
	            strategy.useStrategy.apply( strategy, arguments );
	        };
	        _target.context = function() {
	            options.owner[options.prop] = strategy;
	            return strategy.context.apply( strategy, arguments );
	        };
	        return _target;
	    } else {
	        return strategy;
	    }
	};
	/* global DistinctPredicate,ConsecutiveDistinctPredicate */
	var strats = {
	    setTimeout: function(ms) {
	        return {
	            name: "setTimeout",
	            fn: function (next, data, envelope) {
	                setTimeout(function () {
	                    next(data, envelope);
	                }, ms);
	            }
	        };
	    },
	    after: function(maxCalls, callback) {
	        var dispose = _.after(maxCalls, callback);
	        return {
	            name: "after",
	            fn: function (next, data, envelope) {
	                dispose();
	                next(data, envelope);
	            }
	        };
	    },
	    throttle : function(ms) {
	        return {
	            name: "throttle",
	            fn: _.throttle(function(next, data, envelope) {
	                next(data, envelope);
	            }, ms)
	        };
	    },
	    debounce: function(ms, immediate) {
	        return {
	            name: "debounce",
	            fn: _.debounce(function(next, data, envelope) {
	                next(data, envelope);
	            }, ms, !!immediate)
	        };
	    },
	    predicate: function(pred) {
	        return {
	            name: "predicate",
	            fn: function(next, data, envelope) {
	                if(pred.call(this, data, envelope)) {
	                    next.call(this, data, envelope);
	                }
	            }
	        };
	    },
	    distinct : function(options) {
	        options = options || {};
	        var accessor = function(args) {
	            return args[0];
	        };
	        var check = options.all ?
	            new DistinctPredicate(accessor) :
	            new ConsecutiveDistinctPredicate(accessor);
	        return {
	            name : "distinct",
	            fn : function(next, data, envelope) {
	                if(check(data)) {
	                    next(data, envelope);
	                }
	            }
	        };
	    }
	};
	/*jshint -W098 */
	var ConsecutiveDistinctPredicate = function (argsAccessor) {
		var previous;
		return function () {
	        var data = argsAccessor(arguments);
			var eq = false;
			if ( _.isString( data ) ) {
				eq = data === previous;
				previous = data;
			}
			else {
				eq = _.isEqual( data, previous );
				previous = _.clone( data );
			}
			return !eq;
		};
	};
	/*jshint -W098 */
	var DistinctPredicate = function (argsAccessor) {
		var previous = [];
	
		return function () {
	        var data = argsAccessor(arguments);
			var isDistinct = !_.any( previous, function ( p ) {
				if ( _.isObject( data ) || _.isArray( data ) ) {
					return _.isEqual( data, p );
				}
				return data === p;
			} );
			if ( isDistinct ) {
				previous.push( data );
			}
	        return isDistinct;
		};
	};
	/* global postal, SubscriptionDefinition */
	var ChannelDefinition = function ( channelName ) {
		this.channel = channelName || postal.configuration.DEFAULT_CHANNEL;
	};
	
	ChannelDefinition.prototype.subscribe = function () {
		return arguments.length === 1 ?
		       new SubscriptionDefinition( this.channel, arguments[0].topic, arguments[0].callback ) :
		       new SubscriptionDefinition( this.channel, arguments[0], arguments[1] );
	};
	
	ChannelDefinition.prototype.publish = function () {
		var envelope = arguments.length === 1 ?
		               ( Object.prototype.toString.call( arguments[0] ) === "[object String]" ?
		                { topic : arguments[0] } :
		                arguments[0] ) :
		               { topic : arguments[0], data : arguments[1] };
		envelope.channel = this.channel;
		return postal.configuration.bus.publish( envelope );
	};
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
	/*jshint -W098 */
	var bindingsResolver = {
		cache : {},
		regex : {},
	
		compare : function ( binding, topic ) {
			var pattern, rgx, prevSegment, result = ( this.cache[ topic ] && this.cache[ topic ][ binding ] );
			if ( typeof result !== "undefined" ) {
				return result;
			}
			if ( !( rgx = this.regex[ binding ] )) {
				pattern = "^" + _.map( binding.split( "." ),function ( segment ) {
					var res = "";
					if ( !!prevSegment ) {
						res = prevSegment !== "#" ? "\\.\\b" : "\\b";
					}
					if ( segment === "#" ) {
						res += "[\\s\\S]*";
					} else if ( segment === "*" ) {
						res += "[^.]+";
					} else {
						res += segment;
					}
					prevSegment = segment;
					return res;
				} ).join( "" ) + "$";
				rgx = this.regex[ binding ] = new RegExp( pattern );
			}
			this.cache[ topic ] = this.cache[ topic ] || {};
			this.cache[ topic ][ binding ] = result = rgx.test( topic );
			return result;
		},
	
		reset : function () {
			this.cache = {};
			this.regex = {};
		}
	};
	/* global postal */
	var fireSub = function ( subDef, envelope ) {
		if ( !subDef.inactive && postal.configuration.resolver.compare( subDef.topic, envelope.topic ) ) {
	        subDef.callback.call( subDef.callback.context ? subDef.callback.context() : this, envelope.data, envelope );
		}
	};
	
	var pubInProgress = 0;
	var unSubQueue = [];
	var clearUnSubQueue = function () {
		while ( unSubQueue.length ) {
			unSubQueue.shift().unsubscribe();
		}
	};
	
	var localBus = {
		addWireTap : function ( callback ) {
			var self = this;
			self.wireTaps.push( callback );
			return function () {
				var idx = self.wireTaps.indexOf( callback );
				if ( idx !== -1 ) {
					self.wireTaps.splice( idx, 1 );
				}
			};
		},
	
		publish : function ( envelope ) {
			++pubInProgress;
			envelope.timeStamp = new Date();
			_.each( this.wireTaps, function ( tap ) {
				tap( envelope.data, envelope );
			} );
			if ( this.subscriptions[envelope.channel] ) {
				_.each( this.subscriptions[envelope.channel], function ( subscribers ) {
					var idx = 0, len = subscribers.length, subDef;
					while ( idx < len ) {
						if ( subDef = subscribers[idx++] ) {
							fireSub( subDef, envelope );
						}
					}
				} );
			}
			if ( --pubInProgress === 0 ) {
				clearUnSubQueue();
			}
			return envelope;
		},
	
		reset : function () {
			if ( this.subscriptions ) {
				_.each( this.subscriptions, function ( channel ) {
					_.each( channel, function ( topic ) {
						while ( topic.length ) {
							topic.pop().unsubscribe();
						}
					} );
				} );
				this.subscriptions = {};
			}
		},
	
		subscribe : function ( subDef ) {
			var channel = this.subscriptions[subDef.channel], subs;
			if ( !channel ) {
				channel = this.subscriptions[subDef.channel] = {};
			}
			subs = this.subscriptions[subDef.channel][subDef.topic];
			if ( !subs ) {
				subs = this.subscriptions[subDef.channel][subDef.topic] = [];
			}
			subs.push( subDef );
			return subDef;
		},
	
		subscriptions : {},
	
		wireTaps : [],
	
		unsubscribe : function ( config ) {
			if ( pubInProgress ) {
				unSubQueue.push( config );
				return;
			}
			if ( this.subscriptions[config.channel][config.topic] ) {
				var len = this.subscriptions[config.channel][config.topic].length,
					idx = 0;
				while ( idx < len ) {
					if ( this.subscriptions[config.channel][config.topic][idx] === config ) {
						this.subscriptions[config.channel][config.topic].splice( idx, 1 );
						break;
					}
					idx += 1;
				}
			}
		}
	};
	/* global localBus, bindingsResolver, ChannelDefinition, SubscriptionDefinition, postal */
	/*jshint -W020 */
	postal = {
		configuration : {
			bus             : localBus,
			resolver        : bindingsResolver,
			DEFAULT_CHANNEL : "/",
			SYSTEM_CHANNEL  : "postal",
			strategies      : strats
		},
	
		ChannelDefinition      : ChannelDefinition,
		SubscriptionDefinition : SubscriptionDefinition,
	
		channel : function ( channelName ) {
			return new ChannelDefinition( channelName );
		},
	
		subscribe : function ( options ) {
			return new SubscriptionDefinition( options.channel || postal.configuration.DEFAULT_CHANNEL, options.topic, options.callback );
		},
	
		publish : function ( envelope ) {
			envelope.channel = envelope.channel || postal.configuration.DEFAULT_CHANNEL;
			return postal.configuration.bus.publish( envelope );
		},
	
		addWireTap : function ( callback ) {
			return this.configuration.bus.addWireTap( callback );
		},
	
		linkChannels : function ( sources, destinations ) {
			var result = [];
			sources = !_.isArray( sources ) ? [ sources ] : sources;
			destinations = !_.isArray( destinations ) ? [destinations] : destinations;
			_.each( sources, function ( source ) {
				var sourceTopic = source.topic || "#";
				_.each( destinations, function ( destination ) {
					var destChannel = destination.channel || postal.configuration.DEFAULT_CHANNEL;
					result.push(
						postal.subscribe( {
							channel  : source.channel || postal.configuration.DEFAULT_CHANNEL,
							topic    : sourceTopic,
							callback : function ( data, env ) {
								var newEnv = _.clone( env );
								newEnv.topic = _.isFunction( destination.topic ) ? destination.topic( env.topic ) : destination.topic || env.topic;
								newEnv.channel = destChannel;
								newEnv.data = data;
								postal.publish( newEnv );
							}
						} )
					);
				} );
			} );
			return result;
		},
	
		utils : {
			getSubscribersFor : function () {
				var channel = arguments[ 0 ],
					tpc = arguments[ 1 ];
				if ( arguments.length === 1 ) {
					channel = arguments[ 0 ].channel || postal.configuration.DEFAULT_CHANNEL;
					tpc = arguments[ 0 ].topic;
				}
				if ( postal.configuration.bus.subscriptions[ channel ] &&
				     Object.prototype.hasOwnProperty.call( postal.configuration.bus.subscriptions[ channel ], tpc ) ) {
					return postal.configuration.bus.subscriptions[ channel ][ tpc ];
				}
				return [];
			},
	
			reset : function () {
				postal.configuration.bus.reset();
				postal.configuration.resolver.reset();
			}
		}
	};
	localBus.subscriptions[postal.configuration.SYSTEM_CHANNEL] = {};

	/*jshint -W106 */
	if ( global && global.hasOwnProperty( "__postalReady__" ) && _.isArray( global.__postalReady__ ) ) {
		while(global.__postalReady__.length) {
			global.__postalReady__.shift().onReady(postal);
		}
	}
	/*jshint +W106 */

	return postal;
} ));