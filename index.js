#!/usr/local/bin/node

/*
 * Main entry point - instantiates commands and executes
 */

var path = require("path");
var program = require('commander');

var ExportCommand = require(path.resolve(path.join('commands', 'export')));
var pkg = require( path.join(__dirname, 'package.json') );

program
	.version(pkg.version);

var exportCmd=program.command('export')
				  .option("-u, --sfdx-user [which]", "Salesforce CLI username")
				  .option("-d, --directory [which]", "Output directory")
                  .action(function(options) {new ExportCommand(options).execute()});

program.parse(process.argv);
