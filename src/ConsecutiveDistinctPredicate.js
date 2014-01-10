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