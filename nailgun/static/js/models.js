define(function() {
    'use strict';

    var models = {};
    var collections = {};

    models.Release = Backbone.Model.extend({
        constructorName: 'Release',
        urlRoot: '/api/releases'
    });

    models.Releases = Backbone.Collection.extend({
        constructorName: 'Releases',
        model: models.Release,
        url: '/api/releases'
    });

    models.Cluster = Backbone.Model.extend({
        constructorName: 'Cluster',
        urlRoot: '/api/clusters',
        validate: function(attrs) {
            var errors = {};
            if (!$.trim(attrs.name) || $.trim(attrs.name).length == 0) {
                errors.name = 'Installation name cannot be empty';
            }
            if (!attrs.release) {
                errors.release = 'Please choose OpenStack release';
            }
            return _.isEmpty(errors) ? null : errors;
        },
        task: function(taskName, status) {
            var options = {name: taskName};
            if (status) {
                options.status = status;
            }
            return this.get('tasks') && this.get('tasks').where(options)[0];
        },
        hasChanges: function() {
            return this.get('nodes').hasChanges();
        },
        canChangeMode: function() {
            return !this.get('nodes').nodesAfterDeployment().length;
        },
        canChangeType: function(typeToChangeTo) {
            // FIXME: algorithmic complexity is very high
            var canChange;
            if (!typeToChangeTo) {
                canChange = false;
                _.each(this.availableTypes(), function(type) {
                    if (type == this.get('type')) {return;}
                    canChange = canChange || this.canChangeType(type);
                }, this);
            } else {
                canChange = true;
                var clusterTypesToNodesRoles = {'both': [], 'compute': ['storage'], 'storage': ['compute']};
                _.each(clusterTypesToNodesRoles[typeToChangeTo], function(nodeRole) {
                    if (this.get('nodes').where({role: nodeRole}).length) {
                        canChange = false;
                    }
                }, this);
                if (canChange && this.get('nodes').where({role: 'controller'}).length > 1) {
                    canChange = false;
                }
            }
            return canChange;
        },
        availableModes: function() {
            return ['singlenode', 'multinode', 'ha'];
        },
        availableTypes: function() {
            return ['compute', 'storage', 'both'];
        },
        availableRoles: function() {
            var roles = [];
            if (this.get('mode') == 'singlenode') {
                roles = ['controller'];
            } else if (this.get('type') == 'storage') {
                roles = ['controller', 'storage'];
            } else if (this.get('type') == 'compute') {
                roles = ['controller', 'compute'];
            } else {
                roles = ['controller', 'compute', 'storage'];
            }
            return roles;
        },
        parse: function(response) {
            response.release = new models.Release(response.release);
            response.nodes = new models.Nodes(response.nodes);
            response.nodes.cluster = this;
            response.tasks = new models.Tasks(response.tasks);
            response.tasks.cluster = this;
            return response;
        }
    });

    models.Clusters = Backbone.Collection.extend({
        constructorName: 'Clusters',
        model: models.Cluster,
        url: '/api/clusters'
    });

    models.Node = Backbone.Model.extend({
        constructorName: 'Node',
        urlRoot: '/api/nodes',
        fullProductName: function() {
            return (this.get('manufacturer') ? this.get('manufacturer') + ' ' + this.get('platform_name') : this.get('platform_name')) || 'Unknown Platform';
        },
        resource: function(resourceName) {
            return this.get('info')[resourceName];
        }
    });

    models.Nodes = Backbone.Collection.extend({
        constructorName: 'Nodes',
        model: models.Node,
        url: '/api/nodes',
        hasChanges: function() {
            return !!this.filter(function(node) {
                return node.get('pending_addition') || node.get('pending_deletion');
            }).length;
        },
        currentNodes: function() {
            return this.filter(function(node) {return !node.get('pending_addition');});
        },
        nodesAfterDeployment: function() {
            return this.filter(function(node) {return node.get('pending_addition') || !node.get('pending_deletion');});
        },
        resources: function(resourceName) {
            var resources = this.map(function(node) {return node.resource(resourceName);});
            return _.reduce(resources, function(sum, n) {return sum + n;}, 0);
        }
    });

    models.Task = Backbone.Model.extend({
        constructorName: 'Task',
        urlRoot: '/api/tasks'
    });

    models.Tasks = Backbone.Collection.extend({
        constructorName: 'Tasks',
        model: models.Task,
        url: '/api/tasks',
        toJSON: function(options) {
            return this.pluck('id');
        }
    });

    models.Notification = Backbone.Model.extend({
        constructorName: 'Notification',
        urlRoot: '/api/notifications'
    });

    models.Notifications = Backbone.Collection.extend({
        constructorName: 'Notifications',
        model: models.Notification,
        url: '/api/notifications'
    });

    models.Settings = Backbone.Model.extend({
        constructorName: 'Settings',
        urlRoot: '/api/clusters/'
    });

    models.Network = Backbone.Model.extend({
        constructorName: 'Network',
        urlRoot: '/api/networks',
        validate: function(attrs) {
            var errors = {};
            if (_.isString(attrs.cidr)) {
                var cidrRegexp = /^(?:(?:[0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\.){3}(?:[0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\/([1-9]|[1-2]\d|3[0-2])$/;
                var match = attrs.cidr.match(cidrRegexp);
                if (match) {
                    var prefix = parseInt(match[1], 10);
                    if (prefix < 2) {
                        errors.cidr = 'Network is too large';
                    } else if (prefix > 31) {
                        errors.cidr = 'Network is too small';
                    }
                } else {
                    errors.cidr = 'Invalid CIDR';
                }
            } else {
                errors.cidr = 'Invalid CIDR';
            }
            if (_.isNaN(attrs.vlan_id) || !_.isNumber(attrs.vlan_id) || attrs.vlan_id < 1 || attrs.vlan_id > 4094) {
                errors.vlan_id = 'Invalid VLAN ID';
            }
            return _.isEmpty(errors) ? null : errors;
        }
    });

    models.Networks = Backbone.Collection.extend({
        constructorName: 'Networks',
        model: models.Network,
        url: '/api/networks'
    });

    models.LogSource = Backbone.Model.extend({
        constructorName: 'LogSource',
        urlRoot: '/api/logs/sources'
    });

    models.LogSources = Backbone.Collection.extend({
        constructorName: 'LogSources',
        model: models.LogSource,
        url: '/api/logs/sources'
    });

    return models;
});
