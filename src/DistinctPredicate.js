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