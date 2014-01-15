var gulp        = require("gulp");
var fileImports = require("gulp-imports");
var pkg         = require("./package.json");
var header      = require("gulp-header");
var beautify    = require("gulp-beautify");
var hintNot     = require("gulp-hint-not");
var uglify      = require("gulp-uglify");
var rename      = require("gulp-rename");

var banner = ["/**",
    " * <%= pkg.name %> - <%= pkg.description %>",
    " * Author: <%= pkg.author %>",
    " * Version: v<%= pkg.version %>",
    " * Url: <%= pkg.homepage %>",
    " * License: <%= pkg.license %>",
    " */",
    ""].join("\n");

gulp.task("combine", function() {
    gulp.src(["./src/postal.js"])
        .pipe(header(banner, { pkg : pkg }))
        .pipe(fileImports())
        .pipe(hintNot())
        .pipe(beautify({indentSize: 4}))
        .pipe(gulp.dest("./lib/"))
        .pipe(uglify())
        .pipe(header(banner, { pkg : pkg }))
        .pipe(rename("postal.min.js"))
        .pipe(gulp.dest("./lib/"));
});

gulp.task("default", function() {
    gulp.run("combine");
});