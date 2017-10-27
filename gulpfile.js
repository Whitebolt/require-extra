#!/usr/bin/env node
'use strict';

// @note We are avoiding ES6 here.

const xIsJsFile = /\.js$/i;
require('./src/importSettings')('gulp', ['babel']);

const fs = require('fs');
const gulp = require('gulp');
const tasks = createTasks('./tasks');


/**
 * Get a tree structure from a directory with given root.  Returns required files if files is .js.
 *
 * @param {string} root		The starting directory.
 * @returns {Object}		The structure.
 */
function tree(root) {
	var structure = {};

	var _files = fs.readdirSync(root);
	for(var i=0; i<_files.length; i++) {
		if ((_files[i] !== '.') && (_files[i] !== '..')) {
			var stats = fs.statSync(root + '/' + _files[i]);
			if (stats.isDirectory()) {
				structure[_files[i]] = tree(root + '/' + _files[i]);
			} else if (stats.isFile() && xIsJsFile.test(_files[i])) {
				try {
					structure[_files[i]] = require(root + '/' + _files[i]);
				} catch(err) {
					console.log('Could not load task in: ' + _files[i]);
					console.error(err);
				}
			}
		}
	}

	return structure;
}

/**
 * Add an id to a parent to get a new full id.
 *
 * @param {string} parent		The parent id.
 * @param {string} id			The id.
 * @returns {string}			The full id.
 */
function parentId(parent, id) {
	return parent + id.replace(xIsJsFile, '');
}

/**
 * Given a tree structure, create an object of tasks-ids against task objects.
 *
 * @param {Object} tree				The directory tree from tree().
 * @param {string} [parent=""]		The current parent id.
 * @param {Object} [tasks={}]		The task object.
 * @returns {Object}				The flat object, tasks.
 */
function _createTasks(tree, parent, tasks) {
	parent = parent || "";
	tasks = tasks || {};

	for (var id in tree) {
		if (tree[id].deps && tree[id].fn) {
			tasks[parentId(parent, id)] = tree[id];
		} else {
			_createTasks(tree[id], parentId(parent, id) + ':', tasks)
		}
	}

	return tasks;
}

/**
 * Get the a tasks object from the given directory path.
 *
 * @param {string} root		The path to scan.
 * @returns {Object}		The tasks object created by _createTasks().
 */
function createTasks(root) {
	return _createTasks(tree(root));
}

/**
 * Create a gulp task for the given id.
 *
 * @param {string} taskId		Task id to lookup in tasks and assign.
 * @returns {Function}			The gulp function.
 */
function createTask(taskId) {
	return function (done) {
		var stream = tasks[taskId].fn(gulp, done);
		if (stream) {
			if (stream.on) stream.on('end', done);
			if (stream.then) stream.then(done);
		}
	};
}

for (var taskId in tasks) gulp.task(taskId, tasks[taskId].deps, createTask(taskId));

if (!module.parent && (process.argv.length > 2)) gulp.start([process.argv[2]]);
