/// Copyright 2014-2015 Red Hat, Inc. and/or its affiliates
/// and other contributors as indicated by the @author tags.
///
/// Licensed under the Apache License, Version 2.0 (the "License");
/// you may not use this file except in compliance with the License.
/// You may obtain a copy of the License at
///
///   http://www.apache.org/licenses/LICENSE-2.0
///
/// Unless required by applicable law or agreed to in writing, software
/// distributed under the License is distributed on an "AS IS" BASIS,
/// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
/// See the License for the specific language governing permissions and
/// limitations under the License.




var Dashboard;
(function (Dashboard) {
    Dashboard.log = Logger.get('Dashboard');
    function cleanDashboardData(item) {
        var cleanItem = {};
        angular.forEach(item, function (value, key) {
            if (!angular.isString(key) || (!key.startsWith("$") && !key.startsWith("_"))) {
                cleanItem[key] = value;
            }
        });
        return cleanItem;
    }
    Dashboard.cleanDashboardData = cleanDashboardData;
    function decodeURIComponentProperties(hash) {
        if (!hash) {
            return hash;
        }
        var decodeHash = {};
        angular.forEach(hash, function (value, key) {
            decodeHash[key] = value ? decodeURIComponent(value) : value;
        });
        return decodeHash;
    }
    Dashboard.decodeURIComponentProperties = decodeURIComponentProperties;
    function onOperationComplete(result) {
        console.log("Completed adding the dashboard with response " + JSON.stringify(result));
    }
    Dashboard.onOperationComplete = onOperationComplete;
})(Dashboard || (Dashboard = {}));

var Dashboard;
(function (Dashboard) {
    Dashboard.templatePath = 'plugins/dashboard/html/';
    Dashboard.pluginName = 'dashboard';
    Dashboard._module = angular.module(Dashboard.pluginName, []);
    Dashboard._module.config(["$routeProvider", "$provide", function ($routeProvider, $provide) {
        $provide.decorator('HawtioDashboard', ['$delegate', function ($delegate) {
            $delegate['hasDashboard'] = true;
            $delegate['getAddLink'] = function (title, size_x, size_y) {
                var target = new URI('/dashboard/add');
                var currentUri = new URI();
                var widgetUri = new URI(currentUri.path());
                widgetUri.query(currentUri.query(true));
                target.query(function (query) {
                    query.href = widgetUri.toString().escapeURL();
                    if (title) {
                        query.title = title.escapeURL();
                    }
                    if (size_x && size_y) {
                        query.size = angular.toJson({ size_x: size_x, size_y: size_y }).escapeURL();
                    }
                });
                return target.toString();
            };
            return $delegate;
        }]);
        $routeProvider.when('/dashboard/add', { templateUrl: Dashboard.templatePath + 'addToDashboard.html' }).when('/dashboard/edit', { templateUrl: Dashboard.templatePath + 'editDashboards.html' }).when('/dashboard/idx/:dashboardIndex', { templateUrl: Dashboard.templatePath + 'dashboard.html', reloadOnSearch: false }).when('/dashboard/id/:dashboardId', { templateUrl: Dashboard.templatePath + 'dashboard.html', reloadOnSearch: false }).when('/dashboard/id/:dashboardId/share', { templateUrl: Dashboard.templatePath + 'share.html' }).when('/dashboard/import', { templateUrl: Dashboard.templatePath + 'import.html' });
    }]);
    Dashboard._module.value('ui.config', {
        jq: {
            gridster: {
                widget_margins: [10, 10],
                widget_base_dimensions: [140, 140]
            }
        }
    });
    var tab = undefined;
    function setSubTabs(builder, dashboards, $rootScope) {
        Dashboard.log.debug("Updating sub-tabs");
        if (!tab.tabs) {
            tab.tabs = [];
        }
        else {
            tab.tabs.length = 0;
        }
        _.forEach(dashboards, function (dashboard) {
            var child = builder.id('dashboard-' + dashboard.id).title(function () { return dashboard.title || dashboard.id; }).href(function () {
                var uri = new URI(UrlHelpers.join('/dashboard/id', dashboard.id));
                uri.search({
                    'main-tab': Dashboard.pluginName,
                    'sub-tab': 'dashboard-' + dashboard.id
                });
                return uri.toString();
            }).build();
            tab.tabs.push(child);
        });
        var manage = builder.id('dashboard-manage').title(function () { return '<i class="fa fa-pencil"></i>&nbsp;Manage'; }).href(function () { return '/dashboard/edit?main-tab=dashboard&sub-tab=dashboard-manage'; }).build();
        tab.tabs.push(manage);
        tab.tabs.forEach(function (tab) {
            tab.isSelected = function () {
                var id = tab.id.replace('dashboard-', '');
                var uri = new URI();
                return uri.query(true)['sub-tab'] === tab.id || _.endsWith(uri.path(), id);
            };
        });
        Core.$apply($rootScope);
    }
    Dashboard.setSubTabs = setSubTabs;
    Dashboard._module.run(["HawtioNav", "dashboardRepository", "$rootScope", "HawtioDashboard", "$timeout", function (nav, dashboards, $rootScope, dash, $timeout) {
        if (!dash.inDashboard) {
            var builder = nav.builder();
            tab = builder.id(Dashboard.pluginName).href(function () { return '/dashboard/idx/0'; }).title(function () { return 'Dashboard'; }).build();
            nav.add(tab);
            $timeout(function () {
                dashboards.getDashboards(function (dashboards) {
                    setSubTabs(builder, dashboards, $rootScope);
                });
            }, 500);
        }
    }]);
    hawtioPluginLoader.addModule(Dashboard.pluginName);
})(Dashboard || (Dashboard = {}));

var Dashboard;
(function (Dashboard) {
    Dashboard._module.factory('dashboardRepository', ['DefaultDashboards', function (defaults) {
        return new LocalDashboardRepository(defaults);
    }]);
    Dashboard._module.factory('DefaultDashboards', [function () {
        var defaults = [];
        var answer = {
            add: function (dashboard) {
                defaults.push(dashboard);
            },
            remove: function (id) {
                return _.remove(defaults, function (dashboard) { return dashboard.id === id; });
            },
            getAll: function () { return defaults; }
        };
        return answer;
    }]);
    var LocalDashboardRepository = (function () {
        function LocalDashboardRepository(defaults) {
            this.defaults = defaults;
            this.localStorage = null;
            this.localStorage = Core.getLocalStorage();
        }
        LocalDashboardRepository.prototype.loadDashboards = function () {
            var answer = angular.fromJson(localStorage['userDashboards']);
            if (!answer || answer.length === 0) {
                answer = this.defaults.getAll();
            }
            Dashboard.log.debug("returning dashboards: ", answer);
            return answer;
        };
        LocalDashboardRepository.prototype.storeDashboards = function (dashboards) {
            Dashboard.log.debug("storing dashboards: ", dashboards);
            localStorage['userDashboards'] = angular.toJson(dashboards);
            return this.loadDashboards();
        };
        LocalDashboardRepository.prototype.putDashboards = function (array, commitMessage, fn) {
            var dashboards = this.loadDashboards();
            array.forEach(function (dash) {
                var existing = dashboards.findIndex(function (d) {
                    return d.id === dash.id;
                });
                if (existing >= 0) {
                    dashboards[existing] = dash;
                }
                else {
                    dashboards.push(dash);
                }
            });
            fn(this.storeDashboards(dashboards));
        };
        LocalDashboardRepository.prototype.deleteDashboards = function (array, fn) {
            var dashboards = this.loadDashboards();
            angular.forEach(array, function (item) {
                dashboards.remove(function (i) {
                    return i.id === item.id;
                });
            });
            fn(this.storeDashboards(dashboards));
        };
        LocalDashboardRepository.prototype.getDashboards = function (fn) {
            fn(this.loadDashboards());
        };
        LocalDashboardRepository.prototype.getDashboard = function (id, fn) {
            var dashboards = this.loadDashboards();
            var dashboard = dashboards.find(function (dashboard) {
                return dashboard.id === id;
            });
            fn(dashboard);
        };
        LocalDashboardRepository.prototype.createDashboard = function (options) {
            var answer = {
                title: "New Dashboard",
                group: "Personal",
                widgets: []
            };
            answer = angular.extend(answer, options);
            answer['id'] = Core.getUUID();
            return answer;
        };
        LocalDashboardRepository.prototype.cloneDashboard = function (dashboard) {
            var newDashboard = Object.clone(dashboard);
            newDashboard['id'] = Core.getUUID();
            newDashboard['title'] = "Copy of " + dashboard.title;
            return newDashboard;
        };
        LocalDashboardRepository.prototype.getType = function () {
            return 'container';
        };
        return LocalDashboardRepository;
    })();
    Dashboard.LocalDashboardRepository = LocalDashboardRepository;
})(Dashboard || (Dashboard = {}));

var Dashboard;
(function (Dashboard) {
    Dashboard._module.controller("Dashboard.EditDashboardsController", ["$scope", "$routeParams", "$route", "$location", "$rootScope", "dashboardRepository", "HawtioNav", "$timeout", "$templateCache", "$modal", function ($scope, $routeParams, $route, $location, $rootScope, dashboardRepository, nav, $timeout, $templateCache, $modal) {
        $scope._dashboards = [];
        $rootScope.$on('dashboardsUpdated', dashboardLoaded);
        $scope.hasUrl = function () {
            return ($scope.url) ? true : false;
        };
        $scope.hasSelection = function () {
            return $scope.gridOptions.selectedItems.length !== 0;
        };
        $scope.gridOptions = {
            selectedItems: [],
            showFilter: false,
            showColumnMenu: false,
            filterOptions: {
                filterText: ''
            },
            data: '_dashboards',
            selectWithCheckboxOnly: true,
            showSelectionCheckbox: true,
            columnDefs: [
                {
                    field: 'title',
                    displayName: 'Dashboard',
                    cellTemplate: $templateCache.get(UrlHelpers.join(Dashboard.templatePath, 'editDashboardTitleCell.html'))
                },
                {
                    field: 'group',
                    displayName: 'Group'
                }
            ],
        };
        var doUpdate = _.debounce(updateData, 10);
        $timeout(doUpdate, 10);
        $scope.$on("$routeChangeSuccess", function (event, current, previous) {
            $timeout(doUpdate, 10);
        });
        $scope.addViewToDashboard = function () {
            var nextHref = null;
            var selected = $scope.gridOptions.selectedItems;
            var currentUrl = new URI();
            var config = currentUrl.query(true);
            var href = config['href'];
            var iframe = config['iframe'];
            var type = 'href';
            if (href) {
                href = href.unescapeURL();
                href = Core.trimLeading(href, '#');
            }
            else if (iframe) {
                iframe = iframe.unescapeURL();
                type = 'iframe';
            }
            var widgetURI = undefined;
            switch (type) {
                case 'href':
                    Dashboard.log.debug("href: ", href);
                    widgetURI = new URI(href);
                    break;
                case 'iframe':
                    Dashboard.log.debug("iframe: ", iframe);
                    widgetURI = new URI(iframe);
                    break;
                default:
                    Dashboard.log.debug("type unknown");
                    return;
            }
            var sizeStr = config['size'];
            if (sizeStr) {
                sizeStr = sizeStr.unescapeURL();
            }
            var size = angular.fromJson(sizeStr) || { size_x: 1, size_y: 1 };
            var title = (config['title'] || '').unescapeURL();
            var templateWidget = {
                id: Core.getUUID(),
                row: 1,
                col: 1,
                size_x: size.size_x,
                size_y: size.size_y,
                title: title
            };
            angular.forEach(selected, function (selectedItem) {
                var widget = _.cloneDeep(templateWidget);
                if (!selectedItem.widgets) {
                    selectedItem.widgets = [];
                }
                switch (type) {
                    case 'iframe':
                        widget = _.extend({
                            iframe: iframe
                        }, widget);
                        break;
                    case 'href':
                        var text = widgetURI.path();
                        var search = widgetURI.query(true);
                        if ($route && $route.routes) {
                            var value = $route.routes[text];
                            if (value) {
                                var templateUrl = value["templateUrl"];
                                if (templateUrl) {
                                    widget = _.extend({
                                        path: text,
                                        include: templateUrl,
                                        search: search,
                                        hash: ""
                                    }, widget);
                                }
                            }
                            else {
                                return;
                            }
                        }
                        break;
                }
                var gridWidth = 0;
                selectedItem.widgets.forEach(function (w) {
                    var rightSide = w.col + w.size_x;
                    if (rightSide > gridWidth) {
                        gridWidth = rightSide;
                    }
                });
                var found = false;
                var left = function (w) {
                    return w.col;
                };
                var right = function (w) {
                    return w.col + w.size_x - 1;
                };
                var top = function (w) {
                    return w.row;
                };
                var bottom = function (w) {
                    return w.row + w.size_y - 1;
                };
                var collision = function (w1, w2) {
                    return !(left(w2) > right(w1) || right(w2) < left(w1) || top(w2) > bottom(w1) || bottom(w2) < top(w1));
                };
                if (selectedItem.widgets.isEmpty()) {
                    found = true;
                }
                while (!found) {
                    widget.col = 1;
                    if (widget.col + widget.size_x > gridWidth) {
                        selectedItem.widgets.forEach(function (w, idx) {
                            if (widget.row <= w.row) {
                                widget.row++;
                            }
                        });
                        found = true;
                    }
                    for (; (widget.col + widget.size_x) <= gridWidth; widget.col++) {
                        if (!selectedItem.widgets.any(function (w) {
                            var c = collision(w, widget);
                            return c;
                        })) {
                            found = true;
                            break;
                        }
                    }
                    if (!found) {
                        widget.row = widget.row + 1;
                    }
                    if (widget.row > 50) {
                        found = true;
                    }
                }
                if ($scope.routeParams) {
                    widget['routeParams'] = $scope.routeParams;
                }
                selectedItem.widgets.push(widget);
                if (!nextHref && selectedItem.id) {
                    nextHref = new URI().path("/dashboard/id/" + selectedItem.id).query({
                        'main-tab': 'dashboard',
                        'sub-tab': 'dashboard-' + selectedItem.id
                    }).removeQuery('href').removeQuery('title').removeQuery('iframe').removeQuery('size');
                }
            });
            var commitMessage = "Add widget";
            dashboardRepository.putDashboards(selected, commitMessage, function (dashboards) {
                if (nextHref) {
                    $location.path(nextHref.path()).search(nextHref.query(true));
                    Core.$apply($scope);
                }
            });
        };
        $scope.create = function () {
            var counter = dashboards().length + 1;
            var title = "Untitled" + counter;
            var modal = $modal.open({
                templateUrl: UrlHelpers.join(Dashboard.templatePath, 'createDashboardModal.html'),
                controller: ['$scope', '$modalInstance', function ($scope, $modalInstance) {
                    $scope.entity = {
                        title: title
                    };
                    $scope.config = {
                        properties: {
                            'title': {
                                type: 'string',
                            }
                        }
                    };
                    $scope.ok = function () {
                        modal.close();
                        var title = $scope.entity.title;
                        var newDash = dashboardRepository.createDashboard({ title: title });
                        dashboardRepository.putDashboards([newDash], "Created new dashboard: " + title, function (dashboards) {
                            deselectAll();
                            Dashboard.setSubTabs(nav.builder(), dashboards, $rootScope);
                            dashboardLoaded(null, dashboards);
                        });
                    };
                    $scope.cancel = function () {
                        modal.dismiss();
                    };
                }]
            });
        };
        $scope.duplicate = function () {
            var newDashboards = [];
            var commitMessage = "Duplicated dashboard(s) ";
            angular.forEach($scope.gridOptions.selectedItems, function (item, idx) {
                var commitMessage = "Duplicated dashboard " + item.title;
                var newDash = dashboardRepository.cloneDashboard(item);
                newDashboards.push(newDash);
            });
            deselectAll();
            commitMessage = commitMessage + newDashboards.map(function (d) {
                return d.title;
            }).join(',');
            dashboardRepository.putDashboards(newDashboards, commitMessage, function (dashboards) {
                Dashboard.setSubTabs(nav.builder(), dashboards, $rootScope);
                dashboardLoaded(null, dashboards);
            });
        };
        $scope.renameDashboard = function () {
            if ($scope.gridOptions.selectedItems.length === 1) {
                var selected = _.first($scope.gridOptions.selectedItems);
                var modal = $modal.open({
                    templateUrl: UrlHelpers.join(Dashboard.templatePath, 'renameDashboardModal.html'),
                    controller: ['$scope', '$modalInstance', function ($scope, $modalInstance) {
                        $scope.config = {
                            properties: {
                                'title': {
                                    type: 'string',
                                    default: selected.title
                                }
                            }
                        };
                        $scope.selected = selected;
                        $scope.ok = function () {
                            modal.close();
                            dashboardRepository.putDashboards([$scope.selected], 'renamed dashboard', function (dashboards) {
                                deselectAll();
                                Dashboard.setSubTabs(nav.builder(), dashboards, $rootScope);
                                dashboardLoaded(null, dashboards);
                            });
                        };
                        $scope.cancel = function () {
                            modal.dismiss();
                        };
                    }]
                });
            }
        };
        $scope.deleteDashboard = function () {
            if ($scope.hasSelection()) {
                var selected = $scope.gridOptions.selectedItems;
                var modal = $modal.open({
                    templateUrl: UrlHelpers.join(Dashboard.templatePath, 'deleteDashboardModal.html'),
                    controller: ['$scope', '$modalInstance', function ($scope, $modalInstance) {
                        $scope.selected = selected;
                        $scope.ok = function () {
                            modal.close();
                            dashboardRepository.deleteDashboards($scope.selected, function (dashboards) {
                                deselectAll();
                                Dashboard.setSubTabs(nav.builder(), dashboards, $rootScope);
                                dashboardLoaded(null, dashboards);
                            });
                        };
                        $scope.cancel = function () {
                            modal.dismiss();
                        };
                    }]
                });
            }
        };
        $scope.gist = function () {
            if ($scope.gridOptions.selectedItems.length > 0) {
                var id = $scope.selectedItems[0].id;
                $location.path("/dashboard/id/" + id + "/share");
            }
        };
        function updateData() {
            var url = $routeParams["href"];
            if (url) {
                $scope.url = decodeURIComponent(url);
            }
            var routeParams = $routeParams["routeParams"];
            if (routeParams) {
                $scope.routeParams = decodeURIComponent(routeParams);
            }
            var size = $routeParams["size"];
            if (size) {
                size = decodeURIComponent(size);
                $scope.preferredSize = angular.fromJson(size);
            }
            var title = $routeParams["title"];
            if (title) {
                title = decodeURIComponent(title);
                $scope.widgetTitle = title;
            }
            dashboardRepository.getDashboards(function (dashboards) {
                dashboardLoaded(null, dashboards);
            });
        }
        function dashboardLoaded(event, dashboards) {
            dashboards.forEach(function (dashboard) {
                dashboard.hash = '?main-tab=dashboard&sub-tab=dashboard-' + dashboard.id;
            });
            $scope._dashboards = dashboards;
            if (event === null) {
                $scope.$emit('dashboardsUpdated', dashboards);
            }
            Core.$apply($rootScope);
        }
        function dashboards() {
            return $scope._dashboards;
        }
        function deselectAll() {
            $scope.gridOptions.selectedItems.length = 0;
        }
    }]);
})(Dashboard || (Dashboard = {}));

var Dashboard;
(function (Dashboard) {
    var RectangleLocation = (function () {
        function RectangleLocation(delegate, path, search, hash) {
            var _this = this;
            this.delegate = delegate;
            this._path = path;
            this._search = search;
            this._hash = hash;
            this.uri = new URI(path);
            this.uri.search(function (query) {
                return _this._search;
            });
        }
        RectangleLocation.prototype.absUrl = function () {
            return this.protocol() + this.host() + ":" + this.port() + this.path() + this.search();
        };
        RectangleLocation.prototype.hash = function (newHash) {
            if (newHash === void 0) { newHash = null; }
            if (newHash) {
                this.uri.search(newHash);
                return this;
            }
            return this._hash;
        };
        RectangleLocation.prototype.host = function () {
            return this.delegate.host();
        };
        RectangleLocation.prototype.path = function (newPath) {
            if (newPath === void 0) { newPath = null; }
            if (newPath) {
                this.uri.path(newPath);
                return this;
            }
            return this._path;
        };
        RectangleLocation.prototype.port = function () {
            return this.delegate.port();
        };
        RectangleLocation.prototype.protocol = function () {
            return this.delegate.port();
        };
        RectangleLocation.prototype.replace = function () {
            return this;
        };
        RectangleLocation.prototype.search = function (parametersMap) {
            if (parametersMap === void 0) { parametersMap = null; }
            if (parametersMap) {
                this.uri.search(parametersMap);
                return this;
            }
            return this._search;
        };
        RectangleLocation.prototype.url = function (newValue) {
            if (newValue === void 0) { newValue = null; }
            if (newValue) {
                this.uri = new URI(newValue);
                return this;
            }
            return this.absUrl();
        };
        return RectangleLocation;
    })();
    Dashboard.RectangleLocation = RectangleLocation;
})(Dashboard || (Dashboard = {}));

var Dashboard;
(function (Dashboard) {
    var modules = undefined;
    Dashboard._module.directive('hawtioDashboard', function () {
        modules = hawtioPluginLoader['modules'].filter(function (name) {
            return _.isString(name) && name !== 'ng';
        });
        return new Dashboard.GridsterDirective();
    });
    var GridsterDirective = (function () {
        function GridsterDirective() {
            this.restrict = 'A';
            this.replace = true;
            this.controller = ["$scope", "$element", "$attrs", "$location", "$routeParams", "$templateCache", "dashboardRepository", "$compile", "$templateRequest", "$interpolate", "$modal", "$sce", function ($scope, $element, $attrs, $location, $routeParams, $templateCache, dashboardRepository, $compile, $templateRequest, $interpolate, $modal, $sce) {
                var gridSize = 150;
                var gridMargin = 6;
                var gridHeight;
                $scope.gridX = gridSize;
                $scope.gridY = gridSize;
                $scope.widgetMap = {};
                $scope.$on('$destroy', function () {
                    angular.forEach($scope.widgetMap, function (value, key) {
                        if ('scope' in value) {
                            var scope = value['scope'];
                            scope.$destroy();
                        }
                    });
                });
                setTimeout(updateWidgets, 10);
                function removeWidget(widget) {
                    var gridster = getGridster();
                    var widgetElem = null;
                    var widgetData = $scope.widgetMap[widget.id];
                    if (widgetData) {
                        delete $scope.widgetMap[widget.id];
                        widgetElem = widgetData.widget;
                    }
                    if (!widgetElem) {
                        widgetElem = $("div").find("[data-widgetId='" + widget.id + "']").parent();
                    }
                    if (gridster && widgetElem) {
                        gridster.remove_widget(widgetElem);
                    }
                    if ($scope.dashboard) {
                        var widgets = $scope.dashboard.widgets;
                        if (widgets) {
                            widgets.remove(widget);
                        }
                    }
                    updateDashboardRepository("Removed widget " + widget.title);
                }
                ;
                function changeWidgetSize(widget, sizefunc, savefunc) {
                    if (!widget) {
                        Dashboard.log.debug("widget undefined");
                        return;
                    }
                    var gridster = getGridster();
                    Dashboard.log.debug("Widget ID: ", widget.id, " widgetMap: ", $scope.widgetMap);
                    var entry = $scope.widgetMap[widget.id];
                    var w = entry.widget;
                    sizefunc(entry);
                    gridster.resize_widget(w, entry.size_x, entry.size_y);
                    gridster.set_dom_grid_height();
                    setTimeout(function () {
                        savefunc(widget);
                    }, 50);
                }
                function onWidgetRenamed(widget) {
                    updateDashboardRepository("Renamed widget to " + widget.title);
                }
                ;
                function updateWidgets() {
                    $scope.id = $routeParams["dashboardId"];
                    $scope.idx = $routeParams["dashboardIndex"];
                    if ($scope.id) {
                        $scope.$emit('loadDashboards');
                        dashboardRepository.getDashboard($scope.id, onDashboardLoad);
                    }
                    else {
                        dashboardRepository.getDashboards(function (dashboards) {
                            $scope.$emit('dashboardsUpdated', dashboards);
                            var idx = $scope.idx ? parseInt($scope.idx) : 0;
                            var id = null;
                            if (dashboards.length > 0) {
                                var dashboard = dashboards.length > idx ? dashboards[idx] : dashboard[0];
                                id = dashboard.id;
                            }
                            if (id) {
                                $location.path("/dashboard/id/" + id);
                            }
                            else {
                                $location.path("/dashboard/edit");
                            }
                            Core.$apply($scope);
                        });
                    }
                }
                function onDashboardLoad(dashboard) {
                    $scope.dashboard = dashboard;
                    var widgets = ((dashboard) ? dashboard.widgets : null) || [];
                    var minHeight = 10;
                    var minWidth = 6;
                    angular.forEach(widgets, function (widget) {
                        if (!widget) {
                            Dashboard.log.debug("Undefined widget, skipping");
                            return;
                        }
                        if (angular.isDefined(widget.row) && minHeight < widget.row) {
                            minHeight = widget.row + 1;
                        }
                        if (angular.isDefined(widget.size_x && angular.isDefined(widget.col))) {
                            var rightEdge = widget.col + widget.size_x;
                            if (rightEdge > minWidth) {
                                minWidth = rightEdge + 1;
                            }
                        }
                    });
                    var gridster = $element.gridster({
                        widget_margins: [gridMargin, gridMargin],
                        widget_base_dimensions: [$scope.gridX, $scope.gridY],
                        extra_rows: minHeight,
                        extra_cols: minWidth,
                        max_size_x: minWidth,
                        max_size_y: minHeight,
                        draggable: {
                            stop: function (event, ui) {
                                if (serializeDashboard()) {
                                    updateDashboardRepository("Changing dashboard layout");
                                }
                            }
                        }
                    }).data('gridster');
                    var template = $templateCache.get("widgetTemplate");
                    var remaining = widgets.length;
                    function maybeFinishUp() {
                        remaining = remaining - 1;
                        if (remaining === 0) {
                            makeResizable();
                            getGridster().enable();
                            Core.$apply($scope);
                        }
                    }
                    function doRemoveWidget($modal, widget) {
                        Dashboard.log.debug("Remove widget: ", widget);
                        var modal = $modal.open({
                            templateUrl: UrlHelpers.join(Dashboard.templatePath, 'deleteWidgetModal.html'),
                            controller: ['$scope', '$modalInstance', function ($scope, $modalInstance) {
                                $scope.widget = widget;
                                $scope.ok = function () {
                                    modal.close();
                                    removeWidget($scope.widget);
                                };
                                $scope.cancel = function () {
                                    modal.dismiss();
                                };
                            }]
                        });
                    }
                    function doRenameWidget($modal, widget) {
                        Dashboard.log.debug("Rename widget: ", widget);
                        var modal = $modal.open({
                            templateUrl: UrlHelpers.join(Dashboard.templatePath, 'renameWidgetModal.html'),
                            controller: ['$scope', '$modalInstance', function ($scope, $modalInstance) {
                                $scope.widget = widget;
                                $scope.config = {
                                    properties: {
                                        'title': {
                                            type: 'string',
                                            default: widget.title
                                        }
                                    }
                                };
                                $scope.ok = function () {
                                    modal.close();
                                    onWidgetRenamed($scope.widget);
                                };
                                $scope.cancel = function () {
                                    modal.dismiss();
                                };
                            }]
                        });
                    }
                    angular.forEach(widgets, function (widget) {
                        var type = 'internal';
                        if ('iframe' in widget) {
                            type = 'external';
                        }
                        switch (type) {
                            case 'external':
                                var scope = $scope.$new();
                                scope.widget = widget;
                                scope.removeWidget = function (widget) { return doRemoveWidget($modal, widget); };
                                scope.renameWidget = function (widget) { return doRenameWidget($modal, widget); };
                                var widgetBody = angular.element($templateCache.get('iframeWidgetTemplate.html'));
                                var outerDiv = angular.element($templateCache.get('widgetBlockTemplate.html'));
                                widgetBody.find('iframe').attr('src', widget.iframe);
                                outerDiv.append($compile(widgetBody)(scope));
                                var w = gridster.add_widget(outerDiv, widget.size_x, widget.size_y, widget.col, widget.row);
                                $scope.widgetMap[widget.id] = {
                                    widget: w
                                };
                                maybeFinishUp();
                                break;
                            case 'internal':
                                var path = widget.path;
                                var search = null;
                                if (widget.search) {
                                    search = Dashboard.decodeURIComponentProperties(widget.search);
                                }
                                if (widget.routeParams) {
                                    _.extend(search, angular.fromJson(widget.routeParams));
                                }
                                var hash = widget.hash;
                                var location = new Dashboard.RectangleLocation($location, path, search, hash);
                                if (!widget.size_x || widget.size_x < 1) {
                                    widget.size_x = 1;
                                }
                                if (!widget.size_y || widget.size_y < 1) {
                                    widget.size_y = 1;
                                }
                                var tmpModuleName = 'dashboard-' + widget.id;
                                var tmpModule = angular.module(tmpModuleName, modules);
                                tmpModule.config(['$provide', function ($provide) {
                                    $provide.decorator('HawtioDashboard', ['$delegate', '$rootScope', function ($delegate, $rootScope) {
                                        $delegate.inDashboard = true;
                                        return $delegate;
                                    }]);
                                    $provide.decorator('$location', ['$delegate', function ($delegate) {
                                        return location;
                                    }]);
                                    $provide.decorator('$route', ['$delegate', function ($delegate) {
                                        return $delegate;
                                    }]);
                                    $provide.decorator('$routeParams', ['$delegate', function ($delegate) {
                                        return search;
                                    }]);
                                }]);
                                tmpModule.controller('HawtioDashboard.Title', ["$scope", "$modal", function ($scope, $modal) {
                                    $scope.widget = widget;
                                    $scope.removeWidget = function (widget) { return doRemoveWidget($modal, widget); };
                                    $scope.renameWidget = function (widget) { return doRenameWidget($modal, widget); };
                                }]);
                                var div = $(template);
                                div.attr({ 'data-widgetId': widget.id });
                                var body = div.find('.widget-body');
                                var widgetBody = $templateRequest(widget.include);
                                widgetBody.then(function (widgetBody) {
                                    var outerDiv = angular.element($templateCache.get('widgetBlockTemplate.html'));
                                    body.html(widgetBody);
                                    outerDiv.html(div);
                                    angular.bootstrap(div, [tmpModuleName]);
                                    var w = gridster.add_widget(outerDiv, widget.size_x, widget.size_y, widget.col, widget.row);
                                    $scope.widgetMap[widget.id] = {
                                        widget: w
                                    };
                                    maybeFinishUp();
                                });
                                break;
                        }
                    });
                }
                function serializeDashboard() {
                    var gridster = getGridster();
                    if (gridster) {
                        var data = gridster.serialize();
                        var widgets = $scope.dashboard.widgets || [];
                        angular.forEach(widgets, function (widget, idx) {
                            var value = data[idx];
                            if (value && widget) {
                                angular.forEach(value, function (attr, key) { return widget[key] = attr; });
                            }
                        });
                        return true;
                    }
                    return false;
                }
                function makeResizable() {
                    var blocks = $('.grid-block');
                    blocks.resizable('destroy');
                    blocks.resizable({
                        grid: [gridSize + (gridMargin * 2), gridSize + (gridMargin * 2)],
                        animate: false,
                        minWidth: gridSize,
                        minHeight: gridSize,
                        autoHide: false,
                        start: function (event, ui) {
                            gridHeight = getGridster().$el.height();
                        },
                        resize: function (event, ui) {
                            var g = getGridster();
                            var delta = gridSize + gridMargin * 2;
                            if (event.offsetY > g.$el.height()) {
                                var extra = Math.floor((event.offsetY - gridHeight) / delta + 1);
                                var newHeight = gridHeight + extra * delta;
                                g.$el.css('height', newHeight);
                            }
                        },
                        stop: function (event, ui) {
                            var resized = $(this);
                            setTimeout(function () {
                                resizeBlock(resized);
                            }, 300);
                        }
                    });
                    $('.ui-resizable-handle').hover(function () {
                        getGridster().disable();
                    }, function () {
                        getGridster().enable();
                    });
                }
                function resizeBlock(elmObj) {
                    var area = elmObj.find('.widget-area');
                    var w = elmObj.width() - gridSize;
                    var h = elmObj.height() - gridSize;
                    for (var grid_w = 1; w > 0; w -= (gridSize + (gridMargin * 2))) {
                        grid_w++;
                    }
                    for (var grid_h = 1; h > 0; h -= (gridSize + (gridMargin * 2))) {
                        grid_h++;
                    }
                    var widget = {
                        id: area.attr('data-widgetId')
                    };
                    changeWidgetSize(widget, function (widget) {
                        widget.size_x = grid_w;
                        widget.size_y = grid_h;
                    }, function (widget) {
                        if (serializeDashboard()) {
                            updateDashboardRepository("Changed size of widget: " + widget.id);
                        }
                    });
                }
                function updateDashboardRepository(message) {
                    if ($scope.dashboard) {
                        var commitMessage = message;
                        if ($scope.dashboard && $scope.dashboard.title) {
                            commitMessage += " on dashboard " + $scope.dashboard.title;
                        }
                        dashboardRepository.putDashboards([$scope.dashboard], commitMessage, Dashboard.onOperationComplete);
                    }
                }
                function getGridster() {
                    return $element.gridster().data('gridster');
                }
            }];
        }
        return GridsterDirective;
    })();
    Dashboard.GridsterDirective = GridsterDirective;
})(Dashboard || (Dashboard = {}));

var Dashboard;
(function (Dashboard) {
    Dashboard._module.controller("Dashboard.ImportController", ["$scope", "$location", "$routeParams", "dashboardRepository", function ($scope, $location, $routeParams, dashboardRepository) {
        $scope.placeholder = "Paste the JSON here for the dashboard configuration to import...";
        $scope.source = $scope.placeholder;
        var options = {
            mode: {
                name: "javascript"
            }
        };
        $scope.isValid = function () { return $scope.source && $scope.source !== $scope.placeholder; };
        $scope.importJSON = function () {
            var json = [];
            try {
                json = JSON.parse($scope.source);
            }
            catch (e) {
                json = [];
            }
            var array = [];
            if (angular.isArray(json)) {
                array = json;
            }
            else if (angular.isObject(json)) {
                array.push(json);
            }
            if (array.length) {
                angular.forEach(array, function (dash, index) {
                    angular.copy(dash, dashboardRepository.createDashboard(dash));
                });
                dashboardRepository.putDashboards(array, "Imported dashboard JSON", Dashboard.onOperationComplete);
                $location.path("/dashboard/edit");
            }
        };
    }]);
})(Dashboard || (Dashboard = {}));

var Dashboard;
(function (Dashboard) {
    Dashboard._module.controller("Dashboard.NavBarController", ["$scope", "$routeParams", "$rootScope", "dashboardRepository", function ($scope, $routeParams, $rootScope, dashboardRepository) {
        $scope._dashboards = [];
        $scope.activeDashboard = $routeParams['dashboardId'];
        $scope.$on('loadDashboards', loadDashboards);
        $scope.$on('dashboardsUpdated', dashboardLoaded);
        $scope.dashboards = function () {
            return $scope._dashboards;
        };
        $scope.onTabRenamed = function (dash) {
            dashboardRepository.putDashboards([dash], "Renamed dashboard", function (dashboards) {
                dashboardLoaded(null, dashboards);
            });
        };
        function dashboardLoaded(event, dashboards) {
            Dashboard.log.debug("navbar dashboardLoaded: ", dashboards);
            $scope._dashboards = dashboards;
            if (event === null) {
                $rootScope.$broadcast('dashboardsUpdated', dashboards);
                Core.$apply($scope);
            }
        }
        function loadDashboards(event) {
            dashboardRepository.getDashboards(function (dashboards) {
                dashboardLoaded(null, dashboards);
                Core.$apply($scope);
            });
        }
    }]);
})(Dashboard || (Dashboard = {}));

var Dashboard;
(function (Dashboard) {
    Dashboard.ShareController = Dashboard._module.controller("Dashboard.ShareController", ["$scope", "$location", "$routeParams", "dashboardRepository", function ($scope, $location, $routeParams, dashboardRepository) {
        var id = $routeParams["dashboardId"];
        dashboardRepository.getDashboard(id, onDashboardLoad);
        var options = {
            mode: {
                name: "javascript"
            }
        };
        function onDashboardLoad(dashboard) {
            $scope.dashboard = Dashboard.cleanDashboardData(dashboard);
            $scope.json = {
                "description": "hawtio dashboards",
                "public": true,
                "files": {
                    "dashboards.json": {
                        "content": JSON.stringify($scope.dashboard, null, "  ")
                    }
                }
            };
            $scope.source = JSON.stringify($scope.dashboard, null, "  ");
            Core.$applyNowOrLater($scope);
        }
    }]);
})(Dashboard || (Dashboard = {}));

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImluY2x1ZGVzLmpzIiwiL2hvbWUvZ2FzaGNydW1iL1dvcmsvU291cmNlL2hhd3Rpby1kYXNoYm9hcmQvZGFzaGJvYXJkL3RzL2Rhc2hib2FyZEludGVyZmFjZXMudHMiLCIvaG9tZS9nYXNoY3J1bWIvV29yay9Tb3VyY2UvaGF3dGlvLWRhc2hib2FyZC9kYXNoYm9hcmQvdHMvZGFzaGJvYXJkSGVscGVycy50cyIsIi9ob21lL2dhc2hjcnVtYi9Xb3JrL1NvdXJjZS9oYXd0aW8tZGFzaGJvYXJkL2Rhc2hib2FyZC90cy9kYXNoYm9hcmRQbHVnaW4udHMiLCIvaG9tZS9nYXNoY3J1bWIvV29yay9Tb3VyY2UvaGF3dGlvLWRhc2hib2FyZC9kYXNoYm9hcmQvdHMvZGFzaGJvYXJkUmVwb3NpdG9yeS50cyIsIi9ob21lL2dhc2hjcnVtYi9Xb3JrL1NvdXJjZS9oYXd0aW8tZGFzaGJvYXJkL2Rhc2hib2FyZC90cy9lZGl0RGFzaGJvYXJkcy50cyIsIi9ob21lL2dhc2hjcnVtYi9Xb3JrL1NvdXJjZS9oYXd0aW8tZGFzaGJvYXJkL2Rhc2hib2FyZC90cy9yZWN0YW5nbGVMb2NhdGlvbi50cyIsIi9ob21lL2dhc2hjcnVtYi9Xb3JrL1NvdXJjZS9oYXd0aW8tZGFzaGJvYXJkL2Rhc2hib2FyZC90cy9ncmlkc3RlckRpcmVjdGl2ZS50cyIsIi9ob21lL2dhc2hjcnVtYi9Xb3JrL1NvdXJjZS9oYXd0aW8tZGFzaGJvYXJkL2Rhc2hib2FyZC90cy9pbXBvcnQudHMiLCIvaG9tZS9nYXNoY3J1bWIvV29yay9Tb3VyY2UvaGF3dGlvLWRhc2hib2FyZC9kYXNoYm9hcmQvdHMvbmF2YmFyLnRzIiwiL2hvbWUvZ2FzaGNydW1iL1dvcmsvU291cmNlL2hhd3Rpby1kYXNoYm9hcmQvZGFzaGJvYXJkL3RzL3NoYXJlLnRzIl0sIm5hbWVzIjpbIkRhc2hib2FyZCIsIkRhc2hib2FyZC5jbGVhbkRhc2hib2FyZERhdGEiLCJEYXNoYm9hcmQuZGVjb2RlVVJJQ29tcG9uZW50UHJvcGVydGllcyIsIkRhc2hib2FyZC5vbk9wZXJhdGlvbkNvbXBsZXRlIiwiRGFzaGJvYXJkLnNldFN1YlRhYnMiLCJEYXNoYm9hcmQuTG9jYWxEYXNoYm9hcmRSZXBvc2l0b3J5IiwiRGFzaGJvYXJkLkxvY2FsRGFzaGJvYXJkUmVwb3NpdG9yeS5jb25zdHJ1Y3RvciIsIkRhc2hib2FyZC5Mb2NhbERhc2hib2FyZFJlcG9zaXRvcnkubG9hZERhc2hib2FyZHMiLCJEYXNoYm9hcmQuTG9jYWxEYXNoYm9hcmRSZXBvc2l0b3J5LnN0b3JlRGFzaGJvYXJkcyIsIkRhc2hib2FyZC5Mb2NhbERhc2hib2FyZFJlcG9zaXRvcnkucHV0RGFzaGJvYXJkcyIsIkRhc2hib2FyZC5Mb2NhbERhc2hib2FyZFJlcG9zaXRvcnkuZGVsZXRlRGFzaGJvYXJkcyIsIkRhc2hib2FyZC5Mb2NhbERhc2hib2FyZFJlcG9zaXRvcnkuZ2V0RGFzaGJvYXJkcyIsIkRhc2hib2FyZC5Mb2NhbERhc2hib2FyZFJlcG9zaXRvcnkuZ2V0RGFzaGJvYXJkIiwiRGFzaGJvYXJkLkxvY2FsRGFzaGJvYXJkUmVwb3NpdG9yeS5jcmVhdGVEYXNoYm9hcmQiLCJEYXNoYm9hcmQuTG9jYWxEYXNoYm9hcmRSZXBvc2l0b3J5LmNsb25lRGFzaGJvYXJkIiwiRGFzaGJvYXJkLkxvY2FsRGFzaGJvYXJkUmVwb3NpdG9yeS5nZXRUeXBlIiwiRGFzaGJvYXJkLnVwZGF0ZURhdGEiLCJEYXNoYm9hcmQuZGFzaGJvYXJkTG9hZGVkIiwiRGFzaGJvYXJkLmRhc2hib2FyZHMiLCJEYXNoYm9hcmQuZGVzZWxlY3RBbGwiLCJEYXNoYm9hcmQuUmVjdGFuZ2xlTG9jYXRpb24iLCJEYXNoYm9hcmQuUmVjdGFuZ2xlTG9jYXRpb24uY29uc3RydWN0b3IiLCJEYXNoYm9hcmQuUmVjdGFuZ2xlTG9jYXRpb24uYWJzVXJsIiwiRGFzaGJvYXJkLlJlY3RhbmdsZUxvY2F0aW9uLmhhc2giLCJEYXNoYm9hcmQuUmVjdGFuZ2xlTG9jYXRpb24uaG9zdCIsIkRhc2hib2FyZC5SZWN0YW5nbGVMb2NhdGlvbi5wYXRoIiwiRGFzaGJvYXJkLlJlY3RhbmdsZUxvY2F0aW9uLnBvcnQiLCJEYXNoYm9hcmQuUmVjdGFuZ2xlTG9jYXRpb24ucHJvdG9jb2wiLCJEYXNoYm9hcmQuUmVjdGFuZ2xlTG9jYXRpb24ucmVwbGFjZSIsIkRhc2hib2FyZC5SZWN0YW5nbGVMb2NhdGlvbi5zZWFyY2giLCJEYXNoYm9hcmQuUmVjdGFuZ2xlTG9jYXRpb24udXJsIiwiRGFzaGJvYXJkLkdyaWRzdGVyRGlyZWN0aXZlIiwiRGFzaGJvYXJkLkdyaWRzdGVyRGlyZWN0aXZlLmNvbnN0cnVjdG9yIiwiRGFzaGJvYXJkLkdyaWRzdGVyRGlyZWN0aXZlLmNvbnN0cnVjdG9yLnJlbW92ZVdpZGdldCIsIkRhc2hib2FyZC5Hcmlkc3RlckRpcmVjdGl2ZS5jb25zdHJ1Y3Rvci5jaGFuZ2VXaWRnZXRTaXplIiwiRGFzaGJvYXJkLkdyaWRzdGVyRGlyZWN0aXZlLmNvbnN0cnVjdG9yLm9uV2lkZ2V0UmVuYW1lZCIsIkRhc2hib2FyZC5Hcmlkc3RlckRpcmVjdGl2ZS5jb25zdHJ1Y3Rvci51cGRhdGVXaWRnZXRzIiwiRGFzaGJvYXJkLkdyaWRzdGVyRGlyZWN0aXZlLmNvbnN0cnVjdG9yLm9uRGFzaGJvYXJkTG9hZCIsIkRhc2hib2FyZC5Hcmlkc3RlckRpcmVjdGl2ZS5jb25zdHJ1Y3Rvci5vbkRhc2hib2FyZExvYWQubWF5YmVGaW5pc2hVcCIsIkRhc2hib2FyZC5Hcmlkc3RlckRpcmVjdGl2ZS5jb25zdHJ1Y3Rvci5vbkRhc2hib2FyZExvYWQuZG9SZW1vdmVXaWRnZXQiLCJEYXNoYm9hcmQuR3JpZHN0ZXJEaXJlY3RpdmUuY29uc3RydWN0b3Iub25EYXNoYm9hcmRMb2FkLmRvUmVuYW1lV2lkZ2V0IiwiRGFzaGJvYXJkLkdyaWRzdGVyRGlyZWN0aXZlLmNvbnN0cnVjdG9yLnNlcmlhbGl6ZURhc2hib2FyZCIsIkRhc2hib2FyZC5Hcmlkc3RlckRpcmVjdGl2ZS5jb25zdHJ1Y3Rvci5tYWtlUmVzaXphYmxlIiwiRGFzaGJvYXJkLkdyaWRzdGVyRGlyZWN0aXZlLmNvbnN0cnVjdG9yLnJlc2l6ZUJsb2NrIiwiRGFzaGJvYXJkLkdyaWRzdGVyRGlyZWN0aXZlLmNvbnN0cnVjdG9yLnVwZGF0ZURhc2hib2FyZFJlcG9zaXRvcnkiLCJEYXNoYm9hcmQuR3JpZHN0ZXJEaXJlY3RpdmUuY29uc3RydWN0b3IuZ2V0R3JpZHN0ZXIiLCJEYXNoYm9hcmQubG9hZERhc2hib2FyZHMiLCJEYXNoYm9hcmQub25EYXNoYm9hcmRMb2FkIl0sIm1hcHBpbmdzIjoiQUFBQTtBQUNBO0FDcURDOztBQ2pERCxJQUFPLFNBQVMsQ0E0Q2Y7QUE1Q0QsV0FBTyxTQUFTLEVBQUMsQ0FBQztJQUVMQSxhQUFHQSxHQUFrQkEsTUFBTUEsQ0FBQ0EsR0FBR0EsQ0FBQ0EsV0FBV0EsQ0FBQ0EsQ0FBQ0E7SUFVeERBLFNBQWdCQSxrQkFBa0JBLENBQUNBLElBQUlBO1FBQ3JDQyxJQUFJQSxTQUFTQSxHQUFHQSxFQUFFQSxDQUFDQTtRQUNuQkEsT0FBT0EsQ0FBQ0EsT0FBT0EsQ0FBQ0EsSUFBSUEsRUFBRUEsVUFBQ0EsS0FBS0EsRUFBRUEsR0FBR0E7WUFDL0JBLEVBQUVBLENBQUNBLENBQUNBLENBQUNBLE9BQU9BLENBQUNBLFFBQVFBLENBQUNBLEdBQUdBLENBQUNBLElBQUlBLENBQUNBLENBQUNBLEdBQUdBLENBQUNBLFVBQVVBLENBQUNBLEdBQUdBLENBQUNBLElBQUlBLENBQUNBLEdBQUdBLENBQUNBLFVBQVVBLENBQUNBLEdBQUdBLENBQUNBLENBQUNBLENBQUNBLENBQUNBLENBQUNBO2dCQUM3RUEsU0FBU0EsQ0FBQ0EsR0FBR0EsQ0FBQ0EsR0FBR0EsS0FBS0EsQ0FBQ0E7WUFDekJBLENBQUNBO1FBQ0hBLENBQUNBLENBQUNBLENBQUNBO1FBQ0hBLE1BQU1BLENBQUNBLFNBQVNBLENBQUNBO0lBQ25CQSxDQUFDQTtJQVJlRCw0QkFBa0JBLEdBQWxCQSxrQkFRZkEsQ0FBQUE7SUFVREEsU0FBZ0JBLDRCQUE0QkEsQ0FBQ0EsSUFBSUE7UUFDL0NF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QUFRQSxHQUFHQSxNQUFNQSxDQUFDQSxXQUFXQSxDQUFDQSxhQUFhQSxDQUFDQTtZQUNoREEsSUFBSUEsVUFBVUEsR0FBR0EsSUFBSUEsR0FBR0EsRUFBRUEsQ0FBQ0E7WUFDM0JBLElBQUlBLE1BQU1BLEdBQUdBLFVBQVVBLENBQUNBLEtBQUtBLENBQUNBLElBQUlBLENBQUNBLENBQUNBO1lBQ3BDQSxJQUFJQSxJQUFJQSxHQUFHQSxNQUFNQSxDQUFDQSxNQUFNQSxDQUFDQSxDQUFDQTtZQUMxQkEsSUFBSUEsTUFBTUEsR0FBR0EsTUFBTUEsQ0FBQ0EsUUFBUUEsQ0FBQ0EsQ0FBQ0E7WUFDOUJBLElBQUlBLElBQUlBLEdBQUdBLE1BQU1BLENBQUNBO1lBQ2xCQSxFQUFFQSxDQUFDQSxDQUFDQSxJQUFJQSxDQUFDQSxDQUFDQSxDQUFDQTtnQkFDVEEsSUFBSUEsR0FBR0EsSUFBSUEsQ0FBQ0EsV0FBV0EsRUFBRUEsQ0FBQ0E7Z0JBQzFCQSxJQUFJQSxHQUFHQSxJQUFJQSxDQUFDQSxXQUFXQSxDQUFDQSxJQUFJQSxFQUFFQSxHQUFHQSxDQUFDQSxDQUFDQTtZQUNyQ0EsQ0FBQ0E7WUFBQ0EsSUFBSUEsQ0FBQ0EsRUFBRUEsQ0FBQ0EsQ0FBQ0EsTUFBTUEsQ0FBQ0EsQ0FBQ0EsQ0FBQ0E7Z0JBQ2xCQSxNQUFNQSxHQUFHQSxNQUFNQSxDQUFDQSxXQUFXQSxFQUFFQSxDQUFDQTtnQkFDOUJBLElBQUlBLEdBQUdBLFFBQVFBLENBQUNBO1lBQ2xCQSxDQUFDQTtZQUNEQSxJQUFJQSxTQUFTQSxHQUFTQSxTQUFTQSxDQUFDQTtZQUNoQ0EsTUFBTUEsQ0FBQUEsQ0FBQ0EsSUFBSUEsQ0FBQ0EsQ0FBQ0EsQ0FBQ0E7Z0JBQ1pBLEtBQUtBLE1BQU1BO29CQUNUQSxhQUFHQSxDQUFDQSxLQUFLQSxDQUFDQSxRQUFRQSxFQUFFQSxJQUFJQSxDQUFDQSxDQUFDQTtvQkFDMUJBLFNBQVNBLEdBQUdBLElBQUlBLEdBQUdBLENBQUNBLElBQUlBLENBQUNBLENBQUNBO29CQUMxQkEsS0FBS0EsQ0FBQ0E7Z0JBQ1JBLEtB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a0JBQWtCQSxDQUFDQSxTQUFTQSxDQUFDQSxDQUFDQTtZQUUzREEsTUFBTUEsQ0FBQ0EsSUFBSUEsR0FBR0E7Z0JBQ1pBLGFBQWFBLEVBQUVBLG1CQUFtQkE7Z0JBQ2xDQSxRQUFRQSxFQUFFQSxJQUFJQTtnQkFDZEEsT0FBT0EsRUFBRUE7b0JBQ1BBLGlCQUFpQkEsRUFBRUE7d0JBQ2pCQSxTQUFTQSxFQUFFQSxJQUFJQSxDQUFDQSxTQUFTQSxDQUFDQSxNQUFNQSxDQUFDQSxTQUFTQSxFQUFFQSxJQUFJQSxFQUFFQSxJQUFJQSxDQUFDQTtxQkFDeERBO2lCQUNGQTthQUNGQSxDQUFDQTtZQUVGQSxNQUFNQSxDQUFDQSxNQUFNQSxHQUFHQSxJQUFJQSxDQUFDQSxTQUFTQSxDQUFDQSxNQUFNQSxDQUFDQSxTQUFTQSxFQUFFQSxJQUFJQSxFQUFFQSxJQUFJQSxDQUFDQSxDQUFDQTtZQUM3REEsSUFBSUEsQ0FBQ0EsZ0JBQWdCQSxDQUFDQSxNQUFNQSxDQUFDQSxDQUFDQTtRQUNoQ0EsQ0FBQ0E7SUFDSC9DLENBQUNBLENBQUNBLENBQUNBLENBQUNBO0FBQ05BLENBQUNBLEVBN0JNLFNBQVMsS0FBVCxTQUFTLFFBNkJmIiwiZmlsZSI6ImNvbXBpbGVkLmpzIiwic291cmNlc0NvbnRlbnQiOltudWxsLCJtb2R1bGUgRGFzaGJvYXJkIHtcblxuICBleHBvcnQgaW50ZXJmYWNlIERhc2hib2FyZFNlcnZpY2Uge1xuICAgIGhhc0Rhc2hib2FyZDpib29sZWFuO1xuICAgIGluRGFzaGJvYXJkOmJvb2xlYW47XG4gICAgZ2V0QWRkTGluayh0aXRsZT86c3RyaW5nLCB3aWR0aD86bnVtYmVyLCBoZWlnaHQ/Om51bWJlcik6c3RyaW5nO1xuICB9XG5cbiAgZXhwb3J0IGludGVyZmFjZSBTZWFyY2hNYXAge1xuICAgIFtuYW1lOiBzdHJpbmddOiBzdHJpbmc7XG4gIH1cblxuICBleHBvcnQgaW50ZXJmYWNlIERhc2hib2FyZFdpZGdldCB7XG4gICAgaWQ6IHN0cmluZztcbiAgICB0aXRsZTogc3RyaW5nO1xuICAgIHJvdz86IG51bWJlcjtcbiAgICBjb2w/OiBudW1iZXI7XG4gICAgc2l6ZV94PzogbnVtYmVyO1xuICAgIHNpemVfeT86IG51bWJlcjtcbiAgICBwYXRoPzogc3RyaW5nO1xuICAgIHVybD86IHN0cmluZztcbiAgICBpbmNsdWRlPzogc3RyaW5nO1xuICAgIHNlYXJjaD86IFNlYXJjaE1hcFxuICAgIHJvdXRlUGFyYW1zPzogc3RyaW5nO1xuICB9XG5cbiAgZXhwb3J0IGludGVyZmFjZSBEYXNoYm9hcmQge1xuICAgIGlkOiBzdHJpbmc7XG4gICAgdGl0bGU6IHN0cmluZztcbiAgICBncm91cDogc3RyaW5nO1xuICAgIHdpZGdldHM6IEFycmF5PERhc2hib2FyZFdpZGdldD47XG4gIH1cblxuICBleHBvcnQgaW50ZXJmYWNlIERlZmF1bHREYXNoYm9hcmRzIHtcbiAgICBhZGQ6IChkYXNoYmFyZDpEYXNoYm9hcmQpID0+IHZvaWQ7XG4gICAgcmVtb3ZlOiAoaWQ6c3RyaW5nKSA9PiBEYXNoYm9hcmQ7XG4gICAgZ2V0QWxsOiAoKSA9PiBBcnJheTxEYXNoYm9hcmQ+O1xuICB9XG5cbiAgLyoqXG4gICAqIEJhc2UgaW50ZXJmYWNlIHRoYXQgZGFzaGJvYXJkIHJlcG9zaXRvcmllcyBtdXN0IGltcGxlbWVudFxuICAgKlxuICAgKiBAY2xhc3MgRGFzaGJvYXJkUmVwb3NpdG9yeVxuICAgKi9cbiAgZXhwb3J0IGludGVyZmFjZSBEYXNoYm9hcmRSZXBvc2l0b3J5IHtcbiAgICBwdXREYXNoYm9hcmRzOiAoYXJyYXk6YW55W10sIGNvbW1pdE1lc3NhZ2U6c3RyaW5nLCBmbikgPT4gYW55O1xuICAgIGRlbGV0ZURhc2hib2FyZHM6IChhcnJheTpBcnJheTxEYXNoYm9hcmQ+LCBmbikgPT4gYW55O1xuICAgIGdldERhc2hib2FyZHM6IChmbjooZGFzaGJvYXJkczogQXJyYXk8RGFzaGJvYXJkPikgPT4gdm9pZCkgPT4gdm9pZDtcbiAgICBnZXREYXNoYm9hcmQ6IChpZDpzdHJpbmcsIGZuOiAoZGFzaGJvYXJkOiBEYXNoYm9hcmQpID0+IHZvaWQpID0+IGFueTtcbiAgICBjcmVhdGVEYXNoYm9hcmQ6IChvcHRpb25zOmFueSkgPT4gYW55O1xuICAgIGNsb25lRGFzaGJvYXJkOihkYXNoYm9hcmQ6YW55KSA9PiBhbnk7XG4gICAgZ2V0VHlwZTooKSA9PiBzdHJpbmc7XG4gIH1cblxufVxuIiwiLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4uLy4uL2luY2x1ZGVzLnRzXCIvPlxuLy8vIDxyZWZlcmVuY2UgcGF0aD1cImRhc2hib2FyZEludGVyZmFjZXMudHNcIi8+XG4vKipcbiAqIEBtb2R1bGUgRGFzaGJvYXJkXG4gKi9cbm1vZHVsZSBEYXNoYm9hcmQge1xuXG4gIGV4cG9ydCB2YXIgbG9nOkxvZ2dpbmcuTG9nZ2VyID0gTG9nZ2VyLmdldCgnRGFzaGJvYXJkJyk7XG5cbiAgLyoqXG4gICAqIFJldHVybnMgdGhlIGNsZWFuZWQgdXAgdmVyc2lvbiBvZiB0aGUgZGFzaGJvYXJkIGRhdGEgd2l0aG91dCBhbnkgVUkgc2VsZWN0aW9uIHN0YXRlXG4gICAqIEBtZXRob2QgY2xlYW5EYXNoYm9hcmREYXRhXG4gICAqIEBzdGF0aWNcbiAgICogQGZvciBEYXNoYm9hcmRcbiAgICogQHBhcmFtIHthbnl9IGl0ZW1cbiAgICogQHJldHVybiB7YW55fVxuICAgKi9cbiAgZXhwb3J0IGZ1bmN0aW9uIGNsZWFuRGFzaGJvYXJkRGF0YShpdGVtKSB7XG4gICAgdmFyIGNsZWFuSXRlbSA9IHt9O1xuICAgIGFuZ3VsYXIuZm9yRWFjaChpdGVtLCAodmFsdWUsIGtleSkgPT4ge1xuICAgICAgaWYgKCFhbmd1bGFyLmlzU3RyaW5nKGtleSkgfHwgKCFrZXkuc3RhcnRzV2l0aChcIiRcIikgJiYgIWtleS5zdGFydHNXaXRoKFwiX1wiKSkpIHtcbiAgICAgICAgY2xlYW5JdGVtW2tleV0gPSB2YWx1ZTtcbiAgICAgIH1cbiAgICB9KTtcbiAgICByZXR1cm4gY2xlYW5JdGVtO1xuICB9XG5cbiAgLyoqXG4gICAqIFJ1bnMgZGVjb2RlVVJJQ29tcG9uZW50KCkgb24gZWFjaCB2YWx1ZSBpbiB0aGUgb2JqZWN0XG4gICAqIEBtZXRob2QgZGVjb2RlVVJJQ29tcG9uZW50UHJvcGVydGllc1xuICAgKiBAc3RhdGljXG4gICAqIEBmb3IgRGFzaGJvYXJkXG4gICAqIEBwYXJhbSB7YW55fSBoYXNoXG4gICAqIEByZXR1cm4ge2FueX1cbiAgICovXG4gIGV4cG9ydCBmdW5jdGlvbiBkZWNvZGVVUklDb21wb25lbnRQcm9wZXJ0aWVzKGhhc2gpIHtcbiAgICBpZiAoIWhhc2gpIHtcbiAgICAgIHJldHVybiBoYXNoO1xuICAgIH1cbiAgICB2YXIgZGVjb2RlSGFzaCA9IHt9O1xuICAgIGFuZ3VsYXIuZm9yRWFjaChoYXNoLCAodmFsdWUsIGtleSkgPT4ge1xuICAgICAgZGVjb2RlSGFzaFtrZXldID0gdmFsdWUgPyBkZWNvZGVVUklDb21wb25lbnQodmFsdWUpIDogdmFsdWU7XG4gICAgfSk7XG4gICAgcmV0dXJuIGRlY29kZUhhc2g7XG4gIH1cblxuICBleHBvcnQgZnVuY3Rpb24gb25PcGVyYXRpb25Db21wbGV0ZShyZXN1bHQpIHtcbiAgICBjb25zb2xlLmxvZyhcIkNvbXBsZXRlZCBhZGRpbmcgdGhlIGRhc2hib2FyZCB3aXRoIHJlc3BvbnNlIFwiICsgSlNPTi5zdHJpbmdpZnkocmVzdWx0KSk7XG4gIH1cbn1cbiIsIi8qKlxuICogQG1vZHVsZSBEYXNoYm9hcmRcbiAqIEBtYWluIERhc2hib2FyZFxuICovXG4vLy8gPHJlZmVyZW5jZSBwYXRoPVwiZGFzaGJvYXJkSGVscGVycy50c1wiLz5cbm1vZHVsZSBEYXNoYm9hcmQge1xuICBcbiAgZXhwb3J0IHZhciB0ZW1wbGF0ZVBhdGggPSAncGx1Z2lucy9kYXNoYm9hcmQvaHRtbC8nO1xuICBleHBvcnQgdmFyIHBsdWdpbk5hbWUgPSAnZGFzaGJvYXJkJztcbiAgXG4gIGV4cG9ydCB2YXIgX21vZHVsZSA9IGFuZ3VsYXIubW9kdWxlKHBsdWdpbk5hbWUsIFtdKTtcblxuICBfbW9kdWxlLmNvbmZpZyhbXCIkcm91dGVQcm92aWRlclwiLCBcIiRwcm92aWRlXCIsICgkcm91dGVQcm92aWRlciwgJHByb3ZpZGUpID0+IHtcblxuICAgICRwcm92aWRlLmRlY29yYXRvcignSGF3dGlvRGFzaGJvYXJkJywgWyckZGVsZWdhdGUnLCAoJGRlbGVnYXRlKSA9PiB7XG4gICAgICAkZGVsZWdhdGVbJ2hhc0Rhc2hib2FyZCddID0gdHJ1ZTtcbiAgICAgICRkZWxlZ2F0ZVsnZ2V0QWRkTGluayddID0gKHRpdGxlPzpzdHJpbmcsIHNpemVfeD86bnVtYmVyLCBzaXplX3k/Om51bWJlcikgPT4ge1xuICAgICAgICB2YXIgdGFyZ2V0ID0gbmV3IFVSSSgnL2Rhc2hib2FyZC9hZGQnKTtcbiAgICAgICAgdmFyIGN1cnJlbnRVcmkgPSBuZXcgVVJJKCk7XG4gICAgICAgIC8qXG4gICAgICAgIGN1cnJlbnRVcmkucmVtb3ZlUXVlcnkoJ21haW4tdGFiJyk7XG4gICAgICAgIGN1cnJlbnRVcmkucmVtb3ZlUXVlcnkoJ3N1Yi10YWInKTtcbiAgICAgICAgKi9cbiAgICAgICAgdmFyIHdpZGdldFVyaSA9IG5ldyBVUkkoY3VycmVudFVyaS5wYXRoKCkpO1xuICAgICAgICB3aWRnZXRVcmkucXVlcnkoY3VycmVudFVyaS5xdWVyeSh0cnVlKSk7XG4gICAgICAgIHRhcmdldC5xdWVyeSgocXVlcnkpID0+IHtcbiAgICAgICAgICBxdWVyeS5ocmVmID0gd2lkZ2V0VXJpLnRvU3RyaW5nKCkuZXNjYXBlVVJMKClcbiAgICAgICAgICBpZiAodGl0bGUpIHtcbiAgICAgICAgICAgIHF1ZXJ5LnRpdGxlID0gdGl0bGUuZXNjYXBlVVJMKCk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChzaXplX3ggJiYgc2l6ZV95KSB7XG4gICAgICAgICAgICBxdWVyeS5zaXplID0gYW5ndWxhci50b0pzb24oe3NpemVfeDogc2l6ZV94LCBzaXplX3k6IHNpemVfeX0pLmVzY2FwZVVSTCgpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiB0YXJnZXQudG9TdHJpbmcoKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiAkZGVsZWdhdGU7XG4gICAgfV0pO1xuXG4gICAgJHJvdXRlUHJvdmlkZXIuXG4gICAgICAgICAgICB3aGVuKCcvZGFzaGJvYXJkL2FkZCcsIHt0ZW1wbGF0ZVVybDogRGFzaGJvYXJkLnRlbXBsYXRlUGF0aCArICdhZGRUb0Rhc2hib2FyZC5odG1sJ30pLlxuICAgICAgICAgICAgd2hlbignL2Rhc2hib2FyZC9lZGl0Jywge3RlbXBsYXRlVXJsOiBEYXNoYm9hcmQudGVtcGxhdGVQYXRoICsgJ2VkaXREYXNoYm9hcmRzLmh0bWwnfSkuXG4gICAgICAgICAgICB3aGVuKCcvZGFzaGJvYXJkL2lkeC86ZGFzaGJvYXJkSW5kZXgnLCB7dGVtcGxhdGVVcmw6IERhc2hib2FyZC50ZW1wbGF0ZVBhdGggKyAnZGFzaGJvYXJkLmh0bWwnLCByZWxvYWRPblNlYXJjaDogZmFsc2UgfSkuXG4gICAgICAgICAgICB3aGVuKCcvZGFzaGJvYXJkL2lkLzpkYXNoYm9hcmRJZCcsIHt0ZW1wbGF0ZVVybDogRGFzaGJvYXJkLnRlbXBsYXRlUGF0aCArICdkYXNoYm9hcmQuaHRtbCcsIHJlbG9hZE9uU2VhcmNoOiBmYWxzZSB9KS5cbiAgICAgICAgICAgIHdoZW4oJy9kYXNoYm9hcmQvaWQvOmRhc2hib2FyZElkL3NoYXJlJywge3RlbXBsYXRlVXJsOiBEYXNoYm9hcmQudGVtcGxhdGVQYXRoICsgJ3NoYXJlLmh0bWwnfSkuXG4gICAgICAgICAgICB3aGVuKCcvZGFzaGJvYXJkL2ltcG9ydCcsIHt0ZW1wbGF0ZVVybDogRGFzaGJvYXJkLnRlbXBsYXRlUGF0aCArICdpbXBvcnQuaHRtbCd9KTtcbiAgfV0pO1xuXG4gIF9tb2R1bGUudmFsdWUoJ3VpLmNvbmZpZycsIHtcbiAgICAvLyBUaGUgdWktanEgZGlyZWN0aXZlIG5hbWVzcGFjZVxuICAgIGpxOiB7XG4gICAgICBncmlkc3Rlcjoge1xuICAgICAgICB3aWRnZXRfbWFyZ2luczogWzEwLCAxMF0sXG4gICAgICAgIHdpZGdldF9iYXNlX2RpbWVuc2lvbnM6IFsxNDAsIDE0MF1cbiAgICAgIH1cbiAgICB9XG4gIH0pO1xuXG4gIHZhciB0YWIgPSB1bmRlZmluZWQ7XG5cbiAgZXhwb3J0IGZ1bmN0aW9uIHNldFN1YlRhYnMoYnVpbGRlciwgZGFzaGJvYXJkczpBcnJheTxEYXNoYm9hcmQ+LCAkcm9vdFNjb3BlKSB7XG4gICAgbG9nLmRlYnVnKFwiVXBkYXRpbmcgc3ViLXRhYnNcIik7XG4gICAgaWYgKCF0YWIudGFicykge1xuICAgICAgdGFiLnRhYnMgPSBbXTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGFiLnRhYnMubGVuZ3RoID0gMDtcbiAgICB9XG4gICAgXy5mb3JFYWNoKGRhc2hib2FyZHMsIChkYXNoYm9hcmQpID0+IHtcbiAgICAgIHZhciBjaGlsZCA9IGJ1aWxkZXJcbiAgICAgICAgLmlkKCdkYXNoYm9hcmQtJyArIGRhc2hib2FyZC5pZClcbiAgICAgICAgLnRpdGxlKCgpID0+IGRhc2hib2FyZC50aXRsZSB8fCBkYXNoYm9hcmQuaWQpXG4gICAgICAgIC5ocmVmKCgpID0+IHtcbiAgICAgICAgICB2YXIgdXJpID0gbmV3IFVSSShVcmxIZWxwZXJzLmpvaW4oJy9kYXNoYm9hcmQvaWQnLCBkYXNoYm9hcmQuaWQpKVxuICAgICAgICAgICAgdXJpLnNlYXJjaCh7XG4gICAgICAgICAgICAgICdtYWluLXRhYic6IHBsdWdpbk5hbWUsXG4gICAgICAgICAgICAgICdzdWItdGFiJzogJ2Rhc2hib2FyZC0nICsgZGFzaGJvYXJkLmlkXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICByZXR1cm4gdXJpLnRvU3RyaW5nKCk7XG4gICAgICAgIH0pXG4gICAgICAuYnVpbGQoKTtcbiAgICAgIHRhYi50YWJzLnB1c2goY2hpbGQpO1xuICAgIH0pO1xuICAgIHZhciBtYW5hZ2UgPSBidWlsZGVyXG4gICAgICAuaWQoJ2Rhc2hib2FyZC1tYW5hZ2UnKVxuICAgICAgLnRpdGxlKCgpID0+ICc8aSBjbGFzcz1cImZhIGZhLXBlbmNpbFwiPjwvaT4mbmJzcDtNYW5hZ2UnKVxuICAgICAgLmhyZWYoKCkgPT4gJy9kYXNoYm9hcmQvZWRpdD9tYWluLXRhYj1kYXNoYm9hcmQmc3ViLXRhYj1kYXNoYm9hcmQtbWFuYWdlJylcbiAgICAgIC5idWlsZCgpO1xuICAgIHRhYi50YWJzLnB1c2gobWFuYWdlKTtcbiAgICB0YWIudGFicy5mb3JFYWNoKCh0YWIpID0+IHtcbiAgICAgIHRhYi5pc1NlbGVjdGVkID0gKCkgPT4ge1xuICAgICAgICB2YXIgaWQgPSB0YWIuaWQucmVwbGFjZSgnZGFzaGJvYXJkLScsICcnKTtcbiAgICAgICAgdmFyIHVyaSA9IG5ldyBVUkkoKTtcbiAgICAgICAgcmV0dXJuIHVyaS5xdWVyeSh0cnVlKVsnc3ViLXRhYiddID09PSB0YWIuaWQgfHwgXy5lbmRzV2l0aCh1cmkucGF0aCgpLCBpZCk7XG4gICAgICB9XG4gICAgfSk7XG4gICAgQ29yZS4kYXBwbHkoJHJvb3RTY29wZSk7XG4gIH1cblxuICBfbW9kdWxlLnJ1bihbXCJIYXd0aW9OYXZcIiwgXCJkYXNoYm9hcmRSZXBvc2l0b3J5XCIsIFwiJHJvb3RTY29wZVwiLCBcIkhhd3Rpb0Rhc2hib2FyZFwiLCBcIiR0aW1lb3V0XCIsIChuYXY6SGF3dGlvTWFpbk5hdi5SZWdpc3RyeSwgZGFzaGJvYXJkczpEYXNoYm9hcmRSZXBvc2l0b3J5LCAkcm9vdFNjb3BlLCBkYXNoOkRhc2hib2FyZFNlcnZpY2UsICR0aW1lb3V0KSA9PiB7XG4gICAgLy8gc3BlY2lhbCBjYXNlIGhlcmUsIHdlIGRvbid0IHdhbnQgdG8gb3ZlcndyaXRlIG91ciBzdG9yZWQgdGFiIVxuICAgIGlmICghZGFzaC5pbkRhc2hib2FyZCkge1xuICAgICAgdmFyIGJ1aWxkZXIgPSBuYXYuYnVpbGRlcigpO1xuICAgICAgdGFiID0gYnVpbGRlci5pZChwbHVnaW5OYW1lKVxuICAgICAgICAuaHJlZigoKSA9PiAnL2Rhc2hib2FyZC9pZHgvMCcpXG4gICAgICAgIC50aXRsZSgoKSA9PiAnRGFzaGJvYXJkJylcbiAgICAgICAgLmJ1aWxkKCk7XG4gICAgICBuYXYuYWRkKHRhYik7XG4gICAgICAkdGltZW91dCgoKSA9PiB7XG4gICAgICAgIGRhc2hib2FyZHMuZ2V0RGFzaGJvYXJkcygoZGFzaGJvYXJkcykgPT4ge1xuICAgICAgICAgIHNldFN1YlRhYnMoYnVpbGRlciwgZGFzaGJvYXJkcywgJHJvb3RTY29wZSk7XG4gICAgICAgIH0pO1xuICAgICAgfSwgNTAwKTtcbiAgICB9XG4gIH1dKTtcblxuICBoYXd0aW9QbHVnaW5Mb2FkZXIuYWRkTW9kdWxlKHBsdWdpbk5hbWUpO1xufVxuIiwiLy8vIDxyZWZlcmVuY2UgcGF0aD1cImRhc2hib2FyZFBsdWdpbi50c1wiLz5cbi8vLyA8cmVmZXJlbmNlIHBhdGg9XCJkYXNoYm9hcmRJbnRlcmZhY2VzLnRzXCIvPlxuLyoqXG4gKiBAbW9kdWxlIERhc2hib2FyZFxuICovXG5tb2R1bGUgRGFzaGJvYXJkIHtcblxuICBfbW9kdWxlLmZhY3RvcnkoJ2Rhc2hib2FyZFJlcG9zaXRvcnknLCBbJ0RlZmF1bHREYXNoYm9hcmRzJywgKGRlZmF1bHRzOkRlZmF1bHREYXNoYm9hcmRzKSA9PiB7XG4gICAgcmV0dXJuIG5ldyBMb2NhbERhc2hib2FyZFJlcG9zaXRvcnkoZGVmYXVsdHMpO1xuICB9XSk7XG5cbiAgX21vZHVsZS5mYWN0b3J5KCdEZWZhdWx0RGFzaGJvYXJkcycsIFsoKSA9PiB7XG4gICAgdmFyIGRlZmF1bHRzID0gPEFycmF5PERhc2hib2FyZD4+W107XG4gICAgdmFyIGFuc3dlciA9IHtcbiAgICAgIGFkZDogKGRhc2hib2FyZDpEYXNoYm9hcmQpID0+IHtcbiAgICAgICAgZGVmYXVsdHMucHVzaChkYXNoYm9hcmQpO1xuICAgICAgfSxcbiAgICAgIHJlbW92ZTogKGlkOnN0cmluZykgPT4ge1xuICAgICAgICByZXR1cm4gXy5yZW1vdmUoZGVmYXVsdHMsIChkYXNoYm9hcmQpID0+IGRhc2hib2FyZC5pZCA9PT0gaWQpO1xuICAgICAgfSxcbiAgICAgIGdldEFsbDogKCkgPT4gZGVmYXVsdHNcbiAgICB9XG4gICAgcmV0dXJuIGFuc3dlcjtcbiAgfV0pO1xuXG4gIC8qKlxuICAgKiBAY2xhc3MgTG9jYWxEYXNoYm9hcmRSZXBvc2l0b3J5XG4gICAqIEB1c2VzIERhc2hib2FyZFJlcG9zaXRvcnlcbiAgICovXG4gIGV4cG9ydCBjbGFzcyBMb2NhbERhc2hib2FyZFJlcG9zaXRvcnkgaW1wbGVtZW50cyBEYXNoYm9hcmRSZXBvc2l0b3J5IHtcblxuICAgIHByaXZhdGUgbG9jYWxTdG9yYWdlOldpbmRvd0xvY2FsU3RvcmFnZSA9IG51bGw7XG5cbiAgICBjb25zdHJ1Y3Rvcihwcml2YXRlIGRlZmF1bHRzOkRlZmF1bHREYXNoYm9hcmRzKSB7XG4gICAgICB0aGlzLmxvY2FsU3RvcmFnZSA9IENvcmUuZ2V0TG9jYWxTdG9yYWdlKCk7XG4gICAgICAvKlxuICAgICAgaWYgKCd1c2VyRGFzaGJvYXJkcycgaW4gdGhpcy5sb2NhbFN0b3JhZ2UpIHtcbiAgICAgICAgbG9nLmRlYnVnKFwiRm91bmQgcHJldmlvdXNseSBzYXZlZCBkYXNoYm9hcmRzXCIpO1xuICAgICAgICBpZiAodGhpcy5sb2FkRGFzaGJvYXJkcygpLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgIHRoaXMuc3RvcmVEYXNoYm9hcmRzKGRlZmF1bHRzLmdldEFsbCgpKTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5zdG9yZURhc2hib2FyZHMoZGVmYXVsdHMuZ2V0QWxsKCkpO1xuICAgICAgfVxuICAgICAgKi9cbiAgICB9XG5cbiAgICBwcml2YXRlIGxvYWREYXNoYm9hcmRzKCkge1xuICAgICAgdmFyIGFuc3dlciA9IGFuZ3VsYXIuZnJvbUpzb24obG9jYWxTdG9yYWdlWyd1c2VyRGFzaGJvYXJkcyddKTtcbiAgICAgIGlmICghYW5zd2VyIHx8IGFuc3dlci5sZW5ndGggPT09IDApIHtcbiAgICAgICAgYW5zd2VyID0gdGhpcy5kZWZhdWx0cy5nZXRBbGwoKTtcbiAgICAgIH1cbiAgICAgIGxvZy5kZWJ1ZyhcInJldHVybmluZyBkYXNoYm9hcmRzOiBcIiwgYW5zd2VyKTtcbiAgICAgIHJldHVybiBhbnN3ZXI7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBzdG9yZURhc2hib2FyZHMoZGFzaGJvYXJkczphbnlbXSkge1xuICAgICAgbG9nLmRlYnVnKFwic3RvcmluZyBkYXNoYm9hcmRzOiBcIiwgZGFzaGJvYXJkcyk7XG4gICAgICBsb2NhbFN0b3JhZ2VbJ3VzZXJEYXNoYm9hcmRzJ10gPSBhbmd1bGFyLnRvSnNvbihkYXNoYm9hcmRzKTtcbiAgICAgIHJldHVybiB0aGlzLmxvYWREYXNoYm9hcmRzKCk7XG4gICAgfVxuXG4gICAgcHVibGljIHB1dERhc2hib2FyZHMoYXJyYXk6YW55W10sIGNvbW1pdE1lc3NhZ2U6c3RyaW5nLCBmbikge1xuICAgICAgdmFyIGRhc2hib2FyZHMgPSB0aGlzLmxvYWREYXNoYm9hcmRzKCk7XG4gICAgICBhcnJheS5mb3JFYWNoKChkYXNoKSA9PiB7XG4gICAgICAgIHZhciBleGlzdGluZyA9IGRhc2hib2FyZHMuZmluZEluZGV4KChkKSA9PiB7IHJldHVybiBkLmlkID09PSBkYXNoLmlkOyB9KTtcbiAgICAgICAgaWYgKGV4aXN0aW5nID49IDApIHtcbiAgICAgICAgICBkYXNoYm9hcmRzW2V4aXN0aW5nXSA9IGRhc2g7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgZGFzaGJvYXJkcy5wdXNoKGRhc2gpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICAgIGZuKHRoaXMuc3RvcmVEYXNoYm9hcmRzKGRhc2hib2FyZHMpKTtcbiAgICB9XG5cbiAgICBwdWJsaWMgZGVsZXRlRGFzaGJvYXJkcyhhcnJheTphbnlbXSwgZm4pIHtcbiAgICAgIHZhciBkYXNoYm9hcmRzID0gdGhpcy5sb2FkRGFzaGJvYXJkcygpO1xuICAgICAgYW5ndWxhci5mb3JFYWNoKGFycmF5LCAoaXRlbSkgPT4ge1xuICAgICAgICBkYXNoYm9hcmRzLnJlbW92ZSgoaSkgPT4geyByZXR1cm4gaS5pZCA9PT0gaXRlbS5pZDsgfSk7XG4gICAgICB9KTtcbiAgICAgIGZuKHRoaXMuc3RvcmVEYXNoYm9hcmRzKGRhc2hib2FyZHMpKTtcbiAgICB9XG5cbiAgICBwdWJsaWMgZ2V0RGFzaGJvYXJkcyhmbikge1xuICAgICAgZm4odGhpcy5sb2FkRGFzaGJvYXJkcygpKTtcbiAgICB9XG5cbiAgICBwdWJsaWMgZ2V0RGFzaGJvYXJkKGlkOnN0cmluZywgZm4pIHtcbiAgICAgIHZhciBkYXNoYm9hcmRzID0gdGhpcy5sb2FkRGFzaGJvYXJkcygpO1xuICAgICAgdmFyIGRhc2hib2FyZCA9IGRhc2hib2FyZHMuZmluZCgoZGFzaGJvYXJkKSA9PiB7IHJldHVybiBkYXNoYm9hcmQuaWQgPT09IGlkIH0pO1xuICAgICAgZm4oZGFzaGJvYXJkKTtcbiAgICB9XG5cbiAgICBwdWJsaWMgY3JlYXRlRGFzaGJvYXJkKG9wdGlvbnM6YW55KSB7XG4gICAgICB2YXIgYW5zd2VyID17XG4gICAgICAgIHRpdGxlOiBcIk5ldyBEYXNoYm9hcmRcIixcbiAgICAgICAgZ3JvdXA6IFwiUGVyc29uYWxcIixcbiAgICAgICAgd2lkZ2V0czogW11cbiAgICAgIH07XG4gICAgICBhbnN3ZXIgPSBhbmd1bGFyLmV4dGVuZChhbnN3ZXIsIG9wdGlvbnMpO1xuICAgICAgYW5zd2VyWydpZCddID0gQ29yZS5nZXRVVUlEKCk7XG4gICAgICByZXR1cm4gYW5zd2VyO1xuICAgIH1cblxuICAgIHB1YmxpYyBjbG9uZURhc2hib2FyZChkYXNoYm9hcmQ6YW55KSB7XG4gICAgICB2YXIgbmV3RGFzaGJvYXJkID0gT2JqZWN0LmNsb25lKGRhc2hib2FyZCk7XG4gICAgICBuZXdEYXNoYm9hcmRbJ2lkJ10gPSBDb3JlLmdldFVVSUQoKTtcbiAgICAgIG5ld0Rhc2hib2FyZFsndGl0bGUnXSA9IFwiQ29weSBvZiBcIiArIGRhc2hib2FyZC50aXRsZTtcbiAgICAgIHJldHVybiBuZXdEYXNoYm9hcmQ7XG4gICAgfVxuXG4gICAgcHVibGljIGdldFR5cGUoKSB7XG4gICAgICByZXR1cm4gJ2NvbnRhaW5lcic7XG4gICAgfVxuICB9XG5cbn1cbiIsIi8vLyA8cmVmZXJlbmNlIHBhdGg9XCJkYXNoYm9hcmRQbHVnaW4udHNcIi8+XG4vKipcbiAqIEBtb2R1bGUgRGFzaGJvYXJkXG4gKi9cbm1vZHVsZSBEYXNoYm9hcmQge1xuXG4gIF9tb2R1bGUuY29udHJvbGxlcihcIkRhc2hib2FyZC5FZGl0RGFzaGJvYXJkc0NvbnRyb2xsZXJcIiwgW1wiJHNjb3BlXCIsIFwiJHJvdXRlUGFyYW1zXCIsIFwiJHJvdXRlXCIsIFwiJGxvY2F0aW9uXCIsIFwiJHJvb3RTY29wZVwiLCBcImRhc2hib2FyZFJlcG9zaXRvcnlcIiwgXCJIYXd0aW9OYXZcIiwgXCIkdGltZW91dFwiLCBcIiR0ZW1wbGF0ZUNhY2hlXCIsIFwiJG1vZGFsXCIsICgkc2NvcGUsICRyb3V0ZVBhcmFtcywgJHJvdXRlLCAkbG9jYXRpb24sICRyb290U2NvcGUsIGRhc2hib2FyZFJlcG9zaXRvcnk6RGFzaGJvYXJkUmVwb3NpdG9yeSwgbmF2LCAkdGltZW91dCwgJHRlbXBsYXRlQ2FjaGUsICRtb2RhbCkgPT4ge1xuXG4gICAgJHNjb3BlLl9kYXNoYm9hcmRzID0gW107XG5cbiAgICAkcm9vdFNjb3BlLiRvbignZGFzaGJvYXJkc1VwZGF0ZWQnLCBkYXNoYm9hcmRMb2FkZWQpO1xuXG4gICAgJHNjb3BlLmhhc1VybCA9ICgpID0+IHtcbiAgICAgIHJldHVybiAoJHNjb3BlLnVybCkgPyB0cnVlIDogZmFsc2U7XG4gICAgfTtcblxuICAgICRzY29wZS5oYXNTZWxlY3Rpb24gPSAoKSA9PiB7XG4gICAgICByZXR1cm4gJHNjb3BlLmdyaWRPcHRpb25zLnNlbGVjdGVkSXRlbXMubGVuZ3RoICE9PSAwO1xuICAgIH07XG5cbiAgICAkc2NvcGUuZ3JpZE9wdGlvbnMgPSB7XG4gICAgICBzZWxlY3RlZEl0ZW1zOiBbXSxcbiAgICAgIHNob3dGaWx0ZXI6IGZhbHNlLFxuICAgICAgc2hvd0NvbHVtbk1lbnU6IGZhbHNlLFxuICAgICAgZmlsdGVyT3B0aW9uczoge1xuICAgICAgICBmaWx0ZXJUZXh0OiAnJ1xuICAgICAgfSxcbiAgICAgIGRhdGE6ICdfZGFzaGJvYXJkcycsXG4gICAgICBzZWxlY3RXaXRoQ2hlY2tib3hPbmx5OiB0cnVlLFxuICAgICAgc2hvd1NlbGVjdGlvbkNoZWNrYm94OiB0cnVlLFxuICAgICAgY29sdW1uRGVmczogW1xuICAgICAgICB7XG4gICAgICAgICAgZmllbGQ6ICd0aXRsZScsXG4gICAgICAgICAgZGlzcGxheU5hbWU6ICdEYXNoYm9hcmQnLFxuICAgICAgICAgIGNlbGxUZW1wbGF0ZTogJHRlbXBsYXRlQ2FjaGUuZ2V0KFVybEhlbHBlcnMuam9pbih0ZW1wbGF0ZVBhdGgsICdlZGl0RGFzaGJvYXJkVGl0bGVDZWxsLmh0bWwnKSlcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgIGZpZWxkOiAnZ3JvdXAnLFxuICAgICAgICAgIGRpc3BsYXlOYW1lOiAnR3JvdXAnXG4gICAgICAgIH1cbiAgICAgIF0sXG4gICAgfTtcblxuICAgIHZhciBkb1VwZGF0ZSA9IF8uZGVib3VuY2UodXBkYXRlRGF0YSwgMTApO1xuXG4gICAgLy8gaGVscGVycyBzbyB3ZSBjYW4gZW5hYmxlL2Rpc2FibGUgcGFydHMgb2YgdGhlIFVJIGRlcGVuZGluZyBvbiBob3dcbiAgICAvLyBkYXNoYm9hcmQgZGF0YSBpcyBzdG9yZWRcbiAgICAvKlxuICAgICRzY29wZS51c2luZ0dpdCA9ICgpID0+IHtcbiAgICAgIHJldHVybiBkYXNoYm9hcmRSZXBvc2l0b3J5LmdldFR5cGUoKSA9PT0gJ2dpdCc7XG4gICAgfTtcblxuICAgICRzY29wZS51c2luZ0ZhYnJpYyA9ICgpID0+IHtcbiAgICAgIHJldHVybiBkYXNoYm9hcmRSZXBvc2l0b3J5LmdldFR5cGUoKSA9PT0gJ2ZhYnJpYyc7XG4gICAgfTtcblxuICAgICRzY29wZS51c2luZ0xvY2FsID0gKCkgPT4ge1xuICAgICAgcmV0dXJuIGRhc2hib2FyZFJlcG9zaXRvcnkuZ2V0VHlwZSgpID09PSAnY29udGFpbmVyJztcbiAgICB9O1xuXG4gICAgaWYgKCRzY29wZS51c2luZ0ZhYnJpYygpKSB7XG4gICAgICAkc2NvcGUuZ3JpZE9wdGlvbnMuY29sdW1uRGVmcy5hZGQoW3tcbiAgICAgICAgZmllbGQ6ICd2ZXJzaW9uSWQnLFxuICAgICAgICBkaXNwbGF5TmFtZTogJ1ZlcnNpb24nXG4gICAgICB9LCB7XG4gICAgICAgIGZpZWxkOiAncHJvZmlsZUlkJyxcbiAgICAgICAgZGlzcGxheU5hbWU6ICdQcm9maWxlJ1xuICAgICAgfSwge1xuICAgICAgICBmaWVsZDogJ2ZpbGVOYW1lJyxcbiAgICAgICAgZGlzcGxheU5hbWU6ICdGaWxlIE5hbWUnXG4gICAgICB9XSk7XG4gICAgfVxuICAgICovXG5cbiAgICAkdGltZW91dChkb1VwZGF0ZSwgMTApO1xuXG4gICAgJHNjb3BlLiRvbihcIiRyb3V0ZUNoYW5nZVN1Y2Nlc3NcIiwgZnVuY3Rpb24gKGV2ZW50LCBjdXJyZW50LCBwcmV2aW91cykge1xuICAgICAgLy8gbGV0cyBkbyB0aGlzIGFzeW5jaHJvbm91c2x5IHRvIGF2b2lkIEVycm9yOiAkZGlnZXN0IGFscmVhZHkgaW4gcHJvZ3Jlc3NcbiAgICAgICR0aW1lb3V0KGRvVXBkYXRlLCAxMCk7XG4gICAgfSk7XG5cbiAgICAkc2NvcGUuYWRkVmlld1RvRGFzaGJvYXJkID0gKCkgPT4ge1xuICAgICAgdmFyIG5leHRIcmVmID0gbnVsbDtcbiAgICAgIHZhciBzZWxlY3RlZCA9ICRzY29wZS5ncmlkT3B0aW9ucy5zZWxlY3RlZEl0ZW1zO1xuICAgICAgdmFyIGN1cnJlbnRVcmwgPSBuZXcgVVJJKCk7XG4gICAgICB2YXIgY29uZmlnID0gY3VycmVudFVybC5xdWVyeSh0cnVlKTtcbiAgICAgIHZhciBocmVmID0gY29uZmlnWydocmVmJ107XG4gICAgICB2YXIgaWZyYW1lID0gY29uZmlnWydpZnJhbWUnXTtcbiAgICAgIHZhciB0eXBlID0gJ2hyZWYnO1xuICAgICAgaWYgKGhyZWYpIHtcbiAgICAgICAgaHJlZiA9IGhyZWYudW5lc2NhcGVVUkwoKTtcbiAgICAgICAgaHJlZiA9IENvcmUudHJpbUxlYWRpbmcoaHJlZiwgJyMnKTtcbiAgICAgIH0gZWxzZSBpZiAoaWZyYW1lKSB7XG4gICAgICAgIGlmcmFtZSA9IGlmcmFtZS51bmVzY2FwZVVSTCgpO1xuICAgICAgICB0eXBlID0gJ2lmcmFtZSc7XG4gICAgICB9XG4gICAgICB2YXIgd2lkZ2V0VVJJID0gPGFueT4gdW5kZWZpbmVkO1xuICAgICAgc3dpdGNoKHR5cGUpIHtcbiAgICAgICAgY2FzZSAnaHJlZic6XG4gICAgICAgICAgbG9nLmRlYnVnKFwiaHJlZjogXCIsIGhyZWYpO1xuICAgICAgICAgIHdpZGdldFVSSSA9IG5ldyBVUkkoaHJlZik7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ2lmcmFtZSc6XG4gICAgICAgICAgbG9nLmRlYnVnKFwiaWZyYW1lOiBcIiwgaWZyYW1lKTtcbiAgICAgICAgICB3aWRnZXRVUkkgPSBuZXcgVVJJKGlmcmFtZSk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgbG9nLmRlYnVnKFwidHlwZSB1bmtub3duXCIpO1xuICAgICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIHZhciBzaXplU3RyID0gPGFueT4gY29uZmlnWydzaXplJ107XG4gICAgICBpZiAoc2l6ZVN0cikge1xuICAgICAgICBzaXplU3RyID0gc2l6ZVN0ci51bmVzY2FwZVVSTCgpO1xuICAgICAgfVxuICAgICAgdmFyIHNpemUgPSBhbmd1bGFyLmZyb21Kc29uKHNpemVTdHIpIHx8IHsgc2l6ZV94OiAxLCBzaXplX3k6IDEgfTtcbiAgICAgIHZhciB0aXRsZSA9IChjb25maWdbJ3RpdGxlJ10gfHwgJycpLnVuZXNjYXBlVVJMKCk7XG4gICAgICB2YXIgdGVtcGxhdGVXaWRnZXQgPSB7XG4gICAgICAgIGlkOiBDb3JlLmdldFVVSUQoKSxcbiAgICAgICAgcm93OiAxLFxuICAgICAgICBjb2w6IDEsXG4gICAgICAgIHNpemVfeDogc2l6ZS5zaXplX3gsXG4gICAgICAgIHNpemVfeTogc2l6ZS5zaXplX3ksXG4gICAgICAgIHRpdGxlOiB0aXRsZVxuICAgICAgfVxuICAgICAgYW5ndWxhci5mb3JFYWNoKHNlbGVjdGVkLCAoc2VsZWN0ZWRJdGVtKSA9PiB7XG5cbiAgICAgICAgdmFyIHdpZGdldCA9IF8uY2xvbmVEZWVwKHRlbXBsYXRlV2lkZ2V0KTtcblxuICAgICAgICBpZiAoIXNlbGVjdGVkSXRlbS53aWRnZXRzKSB7XG4gICAgICAgICAgc2VsZWN0ZWRJdGVtLndpZGdldHMgPSBbXTtcbiAgICAgICAgfVxuXG4gICAgICAgIHN3aXRjaCAodHlwZSkge1xuICAgICAgICAgIGNhc2UgJ2lmcmFtZSc6IFxuICAgICAgICAgICAgd2lkZ2V0ID0gPGFueT5fLmV4dGVuZCh7XG4gICAgICAgICAgICAgIGlmcmFtZTogaWZyYW1lXG4gICAgICAgICAgICB9LCB3aWRnZXQpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgY2FzZSAnaHJlZic6XG4gICAgICAgICAgICB2YXIgdGV4dCA9IHdpZGdldFVSSS5wYXRoKCk7XG4gICAgICAgICAgICB2YXIgc2VhcmNoID0gd2lkZ2V0VVJJLnF1ZXJ5KHRydWUpO1xuICAgICAgICAgICAgaWYgKCRyb3V0ZSAmJiAkcm91dGUucm91dGVzKSB7XG4gICAgICAgICAgICAgIHZhciB2YWx1ZSA9ICRyb3V0ZS5yb3V0ZXNbdGV4dF07XG4gICAgICAgICAgICAgIGlmICh2YWx1ZSkge1xuICAgICAgICAgICAgICAgIHZhciB0ZW1wbGF0ZVVybCA9IHZhbHVlW1widGVtcGxhdGVVcmxcIl07XG4gICAgICAgICAgICAgICAgaWYgKHRlbXBsYXRlVXJsKSB7XG4gICAgICAgICAgICAgICAgICB3aWRnZXQgPSA8YW55PiBfLmV4dGVuZCh7XG4gICAgICAgICAgICAgICAgICAgIHBhdGg6IHRleHQsXG4gICAgICAgICAgICAgICAgICAgIGluY2x1ZGU6IHRlbXBsYXRlVXJsLFxuICAgICAgICAgICAgICAgICAgICBzZWFyY2g6IHNlYXJjaCxcbiAgICAgICAgICAgICAgICAgICAgaGFzaDogXCJcIlxuICAgICAgICAgICAgICAgICAgfSwgd2lkZ2V0KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgLy8gVE9ETyB3ZSBuZWVkIHRvIGJlIGFibGUgdG8gbWF0Y2ggVVJJIHRlbXBsYXRlcy4uLlxuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgICAgLy8gZmlndXJlIG91dCB0aGUgd2lkdGggb2YgdGhlIGRhc2hcbiAgICAgICAgdmFyIGdyaWRXaWR0aCA9IDA7XG5cbiAgICAgICAgc2VsZWN0ZWRJdGVtLndpZGdldHMuZm9yRWFjaCgodykgPT4ge1xuICAgICAgICAgIHZhciByaWdodFNpZGUgPSB3LmNvbCArIHcuc2l6ZV94O1xuICAgICAgICAgIGlmIChyaWdodFNpZGUgPiBncmlkV2lkdGgpIHtcbiAgICAgICAgICAgIGdyaWRXaWR0aCA9IHJpZ2h0U2lkZTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHZhciBmb3VuZCA9IGZhbHNlO1xuXG4gICAgICAgIHZhciBsZWZ0ID0gKHcpID0+IHtcbiAgICAgICAgICByZXR1cm4gdy5jb2w7XG4gICAgICAgIH07XG5cbiAgICAgICAgdmFyIHJpZ2h0ID0gKHcpICA9PiB7XG4gICAgICAgICAgcmV0dXJuIHcuY29sICsgdy5zaXplX3ggLSAxO1xuICAgICAgICB9O1xuXG4gICAgICAgIHZhciB0b3AgPSAodykgPT4ge1xuICAgICAgICAgIHJldHVybiB3LnJvdztcbiAgICAgICAgfTtcblxuICAgICAgICB2YXIgYm90dG9tID0gKHcpID0+IHtcbiAgICAgICAgICByZXR1cm4gdy5yb3cgKyB3LnNpemVfeSAtIDE7XG4gICAgICAgIH07XG5cbiAgICAgICAgdmFyIGNvbGxpc2lvbiA9ICh3MSwgdzIpID0+IHtcbiAgICAgICAgICByZXR1cm4gISggbGVmdCh3MikgPiByaWdodCh3MSkgfHxcbiAgICAgICAgICAgICAgcmlnaHQodzIpIDwgbGVmdCh3MSkgfHxcbiAgICAgICAgICAgICAgdG9wKHcyKSA+IGJvdHRvbSh3MSkgfHxcbiAgICAgICAgICAgICAgYm90dG9tKHcyKSA8IHRvcCh3MSkpO1xuICAgICAgICB9O1xuXG4gICAgICAgIGlmIChzZWxlY3RlZEl0ZW0ud2lkZ2V0cy5pc0VtcHR5KCkpIHtcbiAgICAgICAgICBmb3VuZCA9IHRydWU7XG4gICAgICAgIH1cblxuICAgICAgICB3aGlsZSAoIWZvdW5kKSB7XG4gICAgICAgICAgd2lkZ2V0LmNvbCA9IDE7XG4gICAgICAgICAgaWYgKHdpZGdldC5jb2wgKyB3aWRnZXQuc2l6ZV94ID4gZ3JpZFdpZHRoKSB7XG4gICAgICAgICAgICAvLyBsZXQncyBub3QgbG9vayBmb3IgYSBwbGFjZSBuZXh0IHRvIGV4aXN0aW5nIHdpZGdldFxuICAgICAgICAgICAgc2VsZWN0ZWRJdGVtLndpZGdldHMuZm9yRWFjaChmdW5jdGlvbih3LCBpZHgpIHtcbiAgICAgICAgICAgICAgaWYgKHdpZGdldC5yb3cgPD0gdy5yb3cpIHtcbiAgICAgICAgICAgICAgICB3aWRnZXQucm93Kys7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgZm91bmQgPSB0cnVlO1xuICAgICAgICAgIH1cbiAgICAgICAgICBmb3IgKDsgKHdpZGdldC5jb2wgKyB3aWRnZXQuc2l6ZV94KSA8PSBncmlkV2lkdGg7IHdpZGdldC5jb2wrKykge1xuICAgICAgICAgICAgaWYgKCFzZWxlY3RlZEl0ZW0ud2lkZ2V0cy5hbnkoKHcpID0+IHtcbiAgICAgICAgICAgICAgdmFyIGMgPSBjb2xsaXNpb24odywgd2lkZ2V0KTtcbiAgICAgICAgICAgICAgcmV0dXJuIGNcbiAgICAgICAgICAgIH0pKSB7XG4gICAgICAgICAgICAgIGZvdW5kID0gdHJ1ZTtcbiAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmICghZm91bmQpIHtcbiAgICAgICAgICAgIHdpZGdldC5yb3cgPSB3aWRnZXQucm93ICsgMVxuICAgICAgICAgIH1cbiAgICAgICAgICAvLyBqdXN0IGluIGNhc2UsIGtlZXAgdGhlIHNjcmlwdCBmcm9tIHJ1bm5pbmcgYXdheS4uLlxuICAgICAgICAgIGlmICh3aWRnZXQucm93ID4gNTApIHtcbiAgICAgICAgICAgIGZvdW5kID0gdHJ1ZTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoJHNjb3BlLnJvdXRlUGFyYW1zKSB7XG4gICAgICAgICAgd2lkZ2V0Wydyb3V0ZVBhcmFtcyddID0gJHNjb3BlLnJvdXRlUGFyYW1zO1xuICAgICAgICB9XG4gICAgICAgIHNlbGVjdGVkSXRlbS53aWRnZXRzLnB1c2god2lkZ2V0KTtcbiAgICAgICAgaWYgKCFuZXh0SHJlZiAmJiBzZWxlY3RlZEl0ZW0uaWQpIHtcbiAgICAgICAgICBuZXh0SHJlZiA9IG5ldyBVUkkoKS5wYXRoKFwiL2Rhc2hib2FyZC9pZC9cIiArIHNlbGVjdGVkSXRlbS5pZCkucXVlcnkoe1xuICAgICAgICAgICAgJ21haW4tdGFiJzogJ2Rhc2hib2FyZCcsXG4gICAgICAgICAgICAnc3ViLXRhYic6ICdkYXNoYm9hcmQtJyArIHNlbGVjdGVkSXRlbS5pZFxuICAgICAgICAgIH0pLnJlbW92ZVF1ZXJ5KCdocmVmJylcbiAgICAgICAgICAgIC5yZW1vdmVRdWVyeSgndGl0bGUnKVxuICAgICAgICAgICAgLnJlbW92ZVF1ZXJ5KCdpZnJhbWUnKVxuICAgICAgICAgICAgLnJlbW92ZVF1ZXJ5KCdzaXplJyk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuXG4gICAgICAvLyBub3cgbGV0cyB1cGRhdGUgdGhlIGFjdHVhbCBkYXNoYm9hcmQgY29uZmlnXG4gICAgICB2YXIgY29tbWl0TWVzc2FnZSA9IFwiQWRkIHdpZGdldFwiO1xuICAgICAgZGFzaGJvYXJkUmVwb3NpdG9yeS5wdXREYXNoYm9hcmRzKHNlbGVjdGVkLCBjb21taXRNZXNzYWdlLCAoZGFzaGJvYXJkcykgPT4ge1xuICAgICAgICAvKlxuICAgICAgICBsb2cuZGVidWcoXCJQdXQgZGFzaGJvYXJkczogXCIsIGRhc2hib2FyZHMpO1xuICAgICAgICBsb2cuZGVidWcoXCJOZXh0IGhyZWY6IFwiLCBuZXh0SHJlZi50b1N0cmluZygpKTtcbiAgICAgICAgKi9cbiAgICAgICAgaWYgKG5leHRIcmVmKSB7XG4gICAgICAgICAgJGxvY2F0aW9uLnBhdGgobmV4dEhyZWYucGF0aCgpKS5zZWFyY2gobmV4dEhyZWYucXVlcnkodHJ1ZSkpO1xuICAgICAgICAgIENvcmUuJGFwcGx5KCRzY29wZSk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuXG4gICAgfTtcblxuICAgICRzY29wZS5jcmVhdGUgPSAoKSA9PiB7XG5cbiAgICAgIHZhciBjb3VudGVyID0gZGFzaGJvYXJkcygpLmxlbmd0aCArIDE7XG4gICAgICB2YXIgdGl0bGUgPSBcIlVudGl0bGVkXCIgKyBjb3VudGVyO1xuXG4gICAgICB2YXIgbW9kYWwgPSAkbW9kYWwub3Blbih7XG4gICAgICAgIHRlbXBsYXRlVXJsOiBVcmxIZWxwZXJzLmpvaW4odGVtcGxhdGVQYXRoLCAnY3JlYXRlRGFzaGJvYXJkTW9kYWwuaHRtbCcpLFxuICAgICAgICBjb250cm9sbGVyOiBbJyRzY29wZScsICckbW9kYWxJbnN0YW5jZScsICgkc2NvcGUsICRtb2RhbEluc3RhbmNlKSA9PiB7XG4gICAgICAgICAgJHNjb3BlLmVudGl0eSA9IHtcbiAgICAgICAgICAgIHRpdGxlOiB0aXRsZVxuICAgICAgICAgIH1cbiAgICAgICAgICAkc2NvcGUuY29uZmlnID0ge1xuICAgICAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgICAgICAndGl0bGUnOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9O1xuICAgICAgICAgICRzY29wZS5vayA9ICgpID0+IHtcbiAgICAgICAgICAgIG1vZGFsLmNsb3NlKCk7XG4gICAgICAgICAgICB2YXIgdGl0bGUgPSAkc2NvcGUuZW50aXR5LnRpdGxlXG4gICAgICAgICAgICB2YXIgbmV3RGFzaCA9IGRhc2hib2FyZFJlcG9zaXRvcnkuY3JlYXRlRGFzaGJvYXJkKHsgdGl0bGU6IHRpdGxlIH0pO1xuICAgICAgICAgICAgZGFzaGJvYXJkUmVwb3NpdG9yeS5wdXREYXNoYm9hcmRzKFtuZXdEYXNoXSwgXCJDcmVhdGVkIG5ldyBkYXNoYm9hcmQ6IFwiICsgdGl0bGUsIChkYXNoYm9hcmRzKSA9PiB7XG4gICAgICAgICAgICAgIC8vIGxldCdzIGp1c3QgYmUgc2FmZSBhbmQgZW5zdXJlIHRoZXJlJ3Mgbm8gc2VsZWN0aW9uc1xuICAgICAgICAgICAgICBkZXNlbGVjdEFsbCgpO1xuICAgICAgICAgICAgICBzZXRTdWJUYWJzKG5hdi5idWlsZGVyKCksIGRhc2hib2FyZHMsICRyb290U2NvcGUpO1xuICAgICAgICAgICAgICBkYXNoYm9hcmRMb2FkZWQobnVsbCwgZGFzaGJvYXJkcyk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9XG4gICAgICAgICAgJHNjb3BlLmNhbmNlbCA9ICgpID0+IHtcbiAgICAgICAgICAgIG1vZGFsLmRpc21pc3MoKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1dXG4gICAgICB9KTtcbiAgICAgIC8qXG4gICAgICB2YXIgY291bnRlciA9IGRhc2hib2FyZHMoKS5sZW5ndGggKyAxO1xuICAgICAgdmFyIHRpdGxlID0gXCJVbnRpdGxlZFwiICsgY291bnRlcjtcbiAgICAgIHZhciBuZXdEYXNoID0gZGFzaGJvYXJkUmVwb3NpdG9yeS5jcmVhdGVEYXNoYm9hcmQoe3RpdGxlOiB0aXRsZX0pO1xuXG4gICAgICBkYXNoYm9hcmRSZXBvc2l0b3J5LnB1dERhc2hib2FyZHMoW25ld0Rhc2hdLCBcIkNyZWF0ZWQgbmV3IGRhc2hib2FyZDogXCIgKyB0aXRsZSwgKGRhc2hib2FyZHMpID0+IHtcbiAgICAgICAgLy8gbGV0J3MganVzdCBiZSBzYWZlIGFuZCBlbnN1cmUgdGhlcmUncyBubyBzZWxlY3Rpb25zXG4gICAgICAgIGRlc2VsZWN0QWxsKCk7XG4gICAgICAgIHNldFN1YlRhYnMobmF2LmJ1aWxkZXIoKSwgZGFzaGJvYXJkcywgJHJvb3RTY29wZSk7XG4gICAgICAgIGRhc2hib2FyZExvYWRlZChudWxsLCBkYXNoYm9hcmRzKTtcbiAgICAgIH0pO1xuICAgICAgKi9cblxuICAgIH07XG5cbiAgICAkc2NvcGUuZHVwbGljYXRlID0gKCkgPT4ge1xuICAgICAgdmFyIG5ld0Rhc2hib2FyZHMgPSBbXTtcbiAgICAgIHZhciBjb21taXRNZXNzYWdlID0gXCJEdXBsaWNhdGVkIGRhc2hib2FyZChzKSBcIjtcbiAgICAgIGFuZ3VsYXIuZm9yRWFjaCgkc2NvcGUuZ3JpZE9wdGlvbnMuc2VsZWN0ZWRJdGVtcywgKGl0ZW0sIGlkeCkgPT4ge1xuICAgICAgICAvLyBsZXRzIHVuc2VsZWN0IHRoaXMgaXRlbVxuICAgICAgICB2YXIgY29tbWl0TWVzc2FnZSA9IFwiRHVwbGljYXRlZCBkYXNoYm9hcmQgXCIgKyBpdGVtLnRpdGxlO1xuICAgICAgICB2YXIgbmV3RGFzaCA9IGRhc2hib2FyZFJlcG9zaXRvcnkuY2xvbmVEYXNoYm9hcmQoaXRlbSk7XG4gICAgICAgIG5ld0Rhc2hib2FyZHMucHVzaChuZXdEYXNoKTtcbiAgICAgIH0pO1xuXG4gICAgICAvLyBsZXQncyBqdXN0IGJlIHNhZmUgYW5kIGVuc3VyZSB0aGVyZSdzIG5vIHNlbGVjdGlvbnNcbiAgICAgIGRlc2VsZWN0QWxsKCk7XG5cbiAgICAgIGNvbW1pdE1lc3NhZ2UgPSBjb21taXRNZXNzYWdlICsgbmV3RGFzaGJvYXJkcy5tYXAoKGQpID0+IHsgcmV0dXJuIGQudGl0bGUgfSkuam9pbignLCcpO1xuICAgICAgZGFzaGJvYXJkUmVwb3NpdG9yeS5wdXREYXNoYm9hcmRzKG5ld0Rhc2hib2FyZHMsIGNvbW1pdE1lc3NhZ2UsIChkYXNoYm9hcmRzKSA9PiB7XG4gICAgICAgIHNldFN1YlRhYnMobmF2LmJ1aWxkZXIoKSwgZGFzaGJvYXJkcywgJHJvb3RTY29wZSk7XG4gICAgICAgIGRhc2hib2FyZExvYWRlZChudWxsLCBkYXNoYm9hcmRzKTtcbiAgICAgIH0pO1xuICAgIH07XG5cbiAgICAkc2NvcGUucmVuYW1lRGFzaGJvYXJkID0gKCkgPT4ge1xuICAgICAgaWYgKCRzY29wZS5ncmlkT3B0aW9ucy5zZWxlY3RlZEl0ZW1zLmxlbmd0aCA9PT0gMSkge1xuICAgICAgICB2YXIgc2VsZWN0ZWQgPSA8YW55Pl8uZmlyc3QoJHNjb3BlLmdyaWRPcHRpb25zLnNlbGVjdGVkSXRlbXMpO1xuICAgICAgICB2YXIgbW9kYWwgPSAkbW9kYWwub3Blbih7XG4gICAgICAgICAgdGVtcGxhdGVVcmw6IFVybEhlbHBlcnMuam9pbih0ZW1wbGF0ZVBhdGgsICdyZW5hbWVEYXNoYm9hcmRNb2RhbC5odG1sJyksXG4gICAgICAgICAgY29udHJvbGxlcjogWyckc2NvcGUnLCAnJG1vZGFsSW5zdGFuY2UnLCAoJHNjb3BlLCAkbW9kYWxJbnN0YW5jZSkgPT4ge1xuICAgICAgICAgICAgJHNjb3BlLmNvbmZpZyA9IHtcbiAgICAgICAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgICd0aXRsZSc6IHtcbiAgICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgICAgZGVmYXVsdDogc2VsZWN0ZWQudGl0bGVcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICAkc2NvcGUuc2VsZWN0ZWQgPSBzZWxlY3RlZDtcbiAgICAgICAgICAgICRzY29wZS5vayA9ICgpID0+IHtcbiAgICAgICAgICAgICAgbW9kYWwuY2xvc2UoKTtcbiAgICAgICAgICAgICAgZGFzaGJvYXJkUmVwb3NpdG9yeS5wdXREYXNoYm9hcmRzKFskc2NvcGUuc2VsZWN0ZWRdLCAncmVuYW1lZCBkYXNoYm9hcmQnLCAoZGFzaGJvYXJkcykgPT4ge1xuICAgICAgICAgICAgICAgIC8vIGxldCdzIGp1c3QgYmUgc2FmZSBhbmQgZW5zdXJlIHRoZXJlJ3Mgbm8gc2VsZWN0aW9uc1xuICAgICAgICAgICAgICAgIGRlc2VsZWN0QWxsKCk7XG4gICAgICAgICAgICAgICAgc2V0U3ViVGFicyhuYXYuYnVpbGRlcigpLCBkYXNoYm9hcmRzLCAkcm9vdFNjb3BlKTtcbiAgICAgICAgICAgICAgICBkYXNoYm9hcmRMb2FkZWQobnVsbCwgZGFzaGJvYXJkcyk7XG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgJHNjb3BlLmNhbmNlbCA9ICgpID0+IHtcbiAgICAgICAgICAgICAgbW9kYWwuZGlzbWlzcygpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1dXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH07XG5cbiAgICAkc2NvcGUuZGVsZXRlRGFzaGJvYXJkID0gKCkgPT4ge1xuICAgICAgaWYgKCRzY29wZS5oYXNTZWxlY3Rpb24oKSkge1xuICAgICAgICB2YXIgc2VsZWN0ZWQgPSAkc2NvcGUuZ3JpZE9wdGlvbnMuc2VsZWN0ZWRJdGVtcztcbiAgICAgICAgdmFyIG1vZGFsID0gJG1vZGFsLm9wZW4oe1xuICAgICAgICAgIHRlbXBsYXRlVXJsOiBVcmxIZWxwZXJzLmpvaW4odGVtcGxhdGVQYXRoLCAnZGVsZXRlRGFzaGJvYXJkTW9kYWwuaHRtbCcpLFxuICAgICAgICAgIGNvbnRyb2xsZXI6IFsnJHNjb3BlJywgJyRtb2RhbEluc3RhbmNlJywgKCRzY29wZSwgJG1vZGFsSW5zdGFuY2UpID0+IHtcbiAgICAgICAgICAgICRzY29wZS5zZWxlY3RlZCA9IHNlbGVjdGVkO1xuICAgICAgICAgICAgJHNjb3BlLm9rID0gKCkgPT4ge1xuICAgICAgICAgICAgICBtb2RhbC5jbG9zZSgpO1xuICAgICAgICAgICAgICBkYXNoYm9hcmRSZXBvc2l0b3J5LmRlbGV0ZURhc2hib2FyZHMoJHNjb3BlLnNlbGVjdGVkLCAoZGFzaGJvYXJkcykgPT4ge1xuICAgICAgICAgICAgICAgIC8vIGxldCdzIGp1c3QgYmUgc2FmZSBhbmQgZW5zdXJlIHRoZXJlJ3Mgbm8gc2VsZWN0aW9uc1xuICAgICAgICAgICAgICAgIGRlc2VsZWN0QWxsKCk7XG4gICAgICAgICAgICAgICAgc2V0U3ViVGFicyhuYXYuYnVpbGRlcigpLCBkYXNoYm9hcmRzLCAkcm9vdFNjb3BlKTtcbiAgICAgICAgICAgICAgICBkYXNoYm9hcmRMb2FkZWQobnVsbCwgZGFzaGJvYXJkcyk7XG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgJHNjb3BlLmNhbmNlbCA9ICgpID0+IHtcbiAgICAgICAgICAgICAgbW9kYWwuZGlzbWlzcygpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1dXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH07XG5cbiAgICAkc2NvcGUuZ2lzdCA9ICgpID0+IHtcbiAgICAgIGlmICgkc2NvcGUuZ3JpZE9wdGlvbnMuc2VsZWN0ZWRJdGVtcy5sZW5ndGggPiAwKSB7XG4gICAgICAgIHZhciBpZCA9ICRzY29wZS5zZWxlY3RlZEl0ZW1zWzBdLmlkO1xuICAgICAgICAkbG9jYXRpb24ucGF0aChcIi9kYXNoYm9hcmQvaWQvXCIgKyBpZCArIFwiL3NoYXJlXCIpO1xuICAgICAgfVxuICAgIH07XG5cbiAgICBmdW5jdGlvbiB1cGRhdGVEYXRhKCkge1xuICAgICAgdmFyIHVybCA9ICRyb3V0ZVBhcmFtc1tcImhyZWZcIl07XG4gICAgICBpZiAodXJsKSB7XG4gICAgICAgICRzY29wZS51cmwgPSBkZWNvZGVVUklDb21wb25lbnQodXJsKTtcbiAgICAgIH1cblxuICAgICAgdmFyIHJvdXRlUGFyYW1zID0gJHJvdXRlUGFyYW1zW1wicm91dGVQYXJhbXNcIl07XG4gICAgICBpZiAocm91dGVQYXJhbXMpIHtcbiAgICAgICAgJHNjb3BlLnJvdXRlUGFyYW1zID0gZGVjb2RlVVJJQ29tcG9uZW50KHJvdXRlUGFyYW1zKTtcbiAgICAgIH1cbiAgICAgIHZhciBzaXplOmFueSA9ICRyb3V0ZVBhcmFtc1tcInNpemVcIl07XG4gICAgICBpZiAoc2l6ZSkge1xuICAgICAgICBzaXplID0gZGVjb2RlVVJJQ29tcG9uZW50KHNpemUpO1xuICAgICAgICAkc2NvcGUucHJlZmVycmVkU2l6ZSA9IGFuZ3VsYXIuZnJvbUpzb24oc2l6ZSk7XG4gICAgICB9XG4gICAgICB2YXIgdGl0bGU6YW55ID0gJHJvdXRlUGFyYW1zW1widGl0bGVcIl07XG4gICAgICBpZiAodGl0bGUpIHtcbiAgICAgICAgdGl0bGUgPSBkZWNvZGVVUklDb21wb25lbnQodGl0bGUpO1xuICAgICAgICAkc2NvcGUud2lkZ2V0VGl0bGUgPSB0aXRsZTtcbiAgICAgIH1cblxuICAgICAgZGFzaGJvYXJkUmVwb3NpdG9yeS5nZXREYXNoYm9hcmRzKChkYXNoYm9hcmRzKSA9PiB7XG4gICAgICAgIGRhc2hib2FyZExvYWRlZChudWxsLCBkYXNoYm9hcmRzKTtcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGRhc2hib2FyZExvYWRlZChldmVudCwgZGFzaGJvYXJkcykge1xuICAgICAgZGFzaGJvYXJkcy5mb3JFYWNoKChkYXNoYm9hcmQpID0+IHtcbiAgICAgICAgZGFzaGJvYXJkLmhhc2ggPSAnP21haW4tdGFiPWRhc2hib2FyZCZzdWItdGFiPWRhc2hib2FyZC0nICsgZGFzaGJvYXJkLmlkO1xuICAgICAgfSk7XG4gICAgICAkc2NvcGUuX2Rhc2hib2FyZHMgPSBkYXNoYm9hcmRzO1xuXG4gICAgICBpZiAoZXZlbnQgPT09IG51bGwpIHtcbiAgICAgICAgJHNjb3BlLiRlbWl0KCdkYXNoYm9hcmRzVXBkYXRlZCcsIGRhc2hib2FyZHMpO1xuICAgICAgfVxuICAgICAgQ29yZS4kYXBwbHkoJHJvb3RTY29wZSk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZGFzaGJvYXJkcygpIHtcbiAgICAgIHJldHVybiAkc2NvcGUuX2Rhc2hib2FyZHM7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZGVzZWxlY3RBbGwoKSB7XG4gICAgICAkc2NvcGUuZ3JpZE9wdGlvbnMuc2VsZWN0ZWRJdGVtcy5sZW5ndGggPSAwO1xuICAgIH1cblxuICB9XSk7XG59XG4iLCIvLy8gPHJlZmVyZW5jZSBwYXRoPVwiZGFzaGJvYXJkSGVscGVycy50c1wiLz5cbi8qKlxuICogQG1vZHVsZSBEYXNoYm9hcmRcbiAqL1xubW9kdWxlIERhc2hib2FyZCB7XG5cbiAgLyoqXG4gICAqIEltcGxlbWVudHMgdGhlIG5nLklMb2NhdGlvblNlcnZpY2UgaW50ZXJmYWNlIGFuZCBpcyB1c2VkIGJ5IHRoZSBkYXNoYm9hcmQgdG8gc3VwcGx5XG4gICAqIGNvbnRyb2xsZXJzIHdpdGggYSBzYXZlZCBVUkwgbG9jYXRpb25cbiAgICpcbiAgICogQGNsYXNzIFJlY3RhbmdsZUxvY2F0aW9uXG4gICAqL1xuICBleHBvcnQgY2xhc3MgUmVjdGFuZ2xlTG9jYXRpb24geyAvLyBUT0RPIGltcGxlbWVudHMgbmcuSUxvY2F0aW9uU2VydmljZSB7XG4gICAgcHJpdmF0ZSBfcGF0aDogc3RyaW5nO1xuICAgIHByaXZhdGUgX2hhc2g6IHN0cmluZztcbiAgICBwcml2YXRlIF9zZWFyY2g6IGFueTtcbiAgICBwcml2YXRlIHVyaTpVUkk7XG5cbiAgICBjb25zdHJ1Y3RvcihwdWJsaWMgZGVsZWdhdGU6bmcuSUxvY2F0aW9uU2VydmljZSwgcGF0aDpzdHJpbmcsIHNlYXJjaCwgaGFzaDpzdHJpbmcpIHtcbiAgICAgIHRoaXMuX3BhdGggPSBwYXRoO1xuICAgICAgdGhpcy5fc2VhcmNoID0gc2VhcmNoO1xuICAgICAgdGhpcy5faGFzaCA9IGhhc2g7XG4gICAgICB0aGlzLnVyaSA9IG5ldyBVUkkocGF0aCk7XG4gICAgICB0aGlzLnVyaS5zZWFyY2goKHF1ZXJ5KSA9PiB7XG4gICAgICAgIHJldHVybiB0aGlzLl9zZWFyY2g7XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICBhYnNVcmwoKSB7XG4gICAgICByZXR1cm4gdGhpcy5wcm90b2NvbCgpICsgdGhpcy5ob3N0KCkgKyBcIjpcIiArIHRoaXMucG9ydCgpICsgdGhpcy5wYXRoKCkgKyB0aGlzLnNlYXJjaCgpO1xuICAgIH1cblxuICAgIGhhc2gobmV3SGFzaDpzdHJpbmcgPSBudWxsKTphbnkge1xuICAgICAgaWYgKG5ld0hhc2gpIHtcbiAgICAgICAgdGhpcy51cmkuc2VhcmNoKG5ld0hhc2gpO1xuICAgICAgICByZXR1cm4gdGhpcztcbiAgICAgIH1cbiAgICAgIHJldHVybiB0aGlzLl9oYXNoO1xuICAgIH1cblxuICAgIGhvc3QoKTpzdHJpbmcge1xuICAgICAgcmV0dXJuIHRoaXMuZGVsZWdhdGUuaG9zdCgpO1xuICAgIH1cblxuICAgIHBhdGgobmV3UGF0aDpzdHJpbmcgPSBudWxsKTphbnkge1xuICAgICAgaWYgKG5ld1BhdGgpIHtcbiAgICAgICAgdGhpcy51cmkucGF0aChuZXdQYXRoKTtcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgICB9XG4gICAgICByZXR1cm4gdGhpcy5fcGF0aDtcbiAgICB9XG5cbiAgICBwb3J0KCk6bnVtYmVyIHtcbiAgICAgIHJldHVybiB0aGlzLmRlbGVnYXRlLnBvcnQoKTtcbiAgICB9XG5cbiAgICBwcm90b2NvbCgpIHtcbiAgICAgIHJldHVybiB0aGlzLmRlbGVnYXRlLnBvcnQoKTtcbiAgICB9XG5cbiAgICByZXBsYWNlKCkge1xuICAgICAgLy8gVE9ET1xuICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgc2VhcmNoKHBhcmFtZXRlcnNNYXA6YW55ID0gbnVsbCk6YW55IHtcbiAgICAgIGlmIChwYXJhbWV0ZXJzTWFwKSB7XG4gICAgICAgIHRoaXMudXJpLnNlYXJjaChwYXJhbWV0ZXJzTWFwKTtcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgICB9XG4gICAgICByZXR1cm4gdGhpcy5fc2VhcmNoO1xuICAgIH1cblxuICAgIHVybChuZXdWYWx1ZTogc3RyaW5nID0gbnVsbCk6YW55IHtcbiAgICAgIGlmIChuZXdWYWx1ZSkge1xuICAgICAgICB0aGlzLnVyaSA9IG5ldyBVUkkobmV3VmFsdWUpO1xuICAgICAgICByZXR1cm4gdGhpcztcbiAgICAgIH1cbiAgICAgIHJldHVybiB0aGlzLmFic1VybCgpO1xuICAgIH1cblxuICB9XG59XG4iLCIvKipcbiAqIEBtb2R1bGUgRGFzaGJvYXJkXG4gKi9cbi8vLyA8cmVmZXJlbmNlIHBhdGg9XCJkYXNoYm9hcmRQbHVnaW4udHNcIi8+XG4vLy8gPHJlZmVyZW5jZSBwYXRoPVwiZGFzaGJvYXJkUmVwb3NpdG9yeS50c1wiLz5cbi8vLyA8cmVmZXJlbmNlIHBhdGg9XCJyZWN0YW5nbGVMb2NhdGlvbi50c1wiLz5cbm1vZHVsZSBEYXNoYm9hcmQge1xuXG4gIHZhciBtb2R1bGVzOkFycmF5PHN0cmluZz4gPSB1bmRlZmluZWQ7XG5cbiAgX21vZHVsZS5kaXJlY3RpdmUoJ2hhd3Rpb0Rhc2hib2FyZCcsIGZ1bmN0aW9uKCkge1xuICAgIG1vZHVsZXMgPSBoYXd0aW9QbHVnaW5Mb2FkZXJbJ21vZHVsZXMnXS5maWx0ZXIoKG5hbWUpID0+IHtcbiAgICAgIHJldHVybiBfLmlzU3RyaW5nKG5hbWUpICYmIG5hbWUgIT09ICduZyc7XG4gICAgfSk7XG4gICAgcmV0dXJuIG5ldyBEYXNoYm9hcmQuR3JpZHN0ZXJEaXJlY3RpdmUoKTtcbiAgfSk7XG5cbiAgZXhwb3J0IGNsYXNzIEdyaWRzdGVyRGlyZWN0aXZlIHtcbiAgICBwdWJsaWMgcmVzdHJpY3QgPSAnQSc7XG4gICAgcHVibGljIHJlcGxhY2UgPSB0cnVlO1xuXG4gICAgcHVibGljIGNvbnRyb2xsZXIgPSBbXCIkc2NvcGVcIiwgXCIkZWxlbWVudFwiLCBcIiRhdHRyc1wiLCBcIiRsb2NhdGlvblwiLCBcIiRyb3V0ZVBhcmFtc1wiLCBcIiR0ZW1wbGF0ZUNhY2hlXCIsIFwiZGFzaGJvYXJkUmVwb3NpdG9yeVwiLCBcIiRjb21waWxlXCIsIFwiJHRlbXBsYXRlUmVxdWVzdFwiLCBcIiRpbnRlcnBvbGF0ZVwiLCBcIiRtb2RhbFwiLCBcIiRzY2VcIiwgKCRzY29wZSwgJGVsZW1lbnQsICRhdHRycywgJGxvY2F0aW9uLCAkcm91dGVQYXJhbXMsICR0ZW1wbGF0ZUNhY2hlLCBkYXNoYm9hcmRSZXBvc2l0b3J5OkRhc2hib2FyZFJlcG9zaXRvcnksICRjb21waWxlLCAkdGVtcGxhdGVSZXF1ZXN0LCAkaW50ZXJwb2xhdGUsICRtb2RhbCwgJHNjZSkgPT4ge1xuXG4gICAgICB2YXIgZ3JpZFNpemUgPSAxNTA7XG4gICAgICB2YXIgZ3JpZE1hcmdpbiA9IDY7XG4gICAgICB2YXIgZ3JpZEhlaWdodDtcblxuICAgICAgJHNjb3BlLmdyaWRYID0gZ3JpZFNpemU7XG4gICAgICAkc2NvcGUuZ3JpZFkgPSBncmlkU2l6ZTtcblxuICAgICAgJHNjb3BlLndpZGdldE1hcCA9IHt9O1xuXG4gICAgICAkc2NvcGUuJG9uKCckZGVzdHJveScsICgpID0+IHtcbiAgICAgICAgYW5ndWxhci5mb3JFYWNoKCRzY29wZS53aWRnZXRNYXAsICh2YWx1ZSwga2V5KSA9PiB7XG4gICAgICAgICAgaWYgKCdzY29wZScgaW4gdmFsdWUpIHtcbiAgICAgICAgICAgIHZhciBzY29wZSA9IHZhbHVlWydzY29wZSddO1xuICAgICAgICAgICAgc2NvcGUuJGRlc3Ryb3koKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgfSk7XG5cbiAgICAgIHNldFRpbWVvdXQodXBkYXRlV2lkZ2V0cywgMTApO1xuXG4gICAgICBmdW5jdGlvbiByZW1vdmVXaWRnZXQod2lkZ2V0KSB7XG4gICAgICAgIHZhciBncmlkc3RlciA9IGdldEdyaWRzdGVyKCk7XG4gICAgICAgIHZhciB3aWRnZXRFbGVtID0gbnVsbDtcblxuICAgICAgICAvLyBsZXRzIGRlc3Ryb3kgdGhlIHdpZGdldHMncyBzY29wZVxuICAgICAgICB2YXIgd2lkZ2V0RGF0YSA9ICRzY29wZS53aWRnZXRNYXBbd2lkZ2V0LmlkXTtcbiAgICAgICAgaWYgKHdpZGdldERhdGEpIHtcbiAgICAgICAgICBkZWxldGUgJHNjb3BlLndpZGdldE1hcFt3aWRnZXQuaWRdO1xuICAgICAgICAgIHdpZGdldEVsZW0gPSB3aWRnZXREYXRhLndpZGdldDtcbiAgICAgICAgfVxuICAgICAgICBpZiAoIXdpZGdldEVsZW0pIHtcbiAgICAgICAgICAvLyBsZXRzIGdldCB0aGUgbGkgcGFyZW50IGVsZW1lbnQgb2YgdGhlIHRlbXBsYXRlXG4gICAgICAgICAgd2lkZ2V0RWxlbSA9ICQoXCJkaXZcIikuZmluZChcIltkYXRhLXdpZGdldElkPSdcIiArIHdpZGdldC5pZCArIFwiJ11cIikucGFyZW50KCk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGdyaWRzdGVyICYmIHdpZGdldEVsZW0pIHtcbiAgICAgICAgICBncmlkc3Rlci5yZW1vdmVfd2lkZ2V0KHdpZGdldEVsZW0pO1xuICAgICAgICB9XG4gICAgICAgIC8vIGxldHMgdHJhc2ggdGhlIEpTT04gbWV0YWRhdGFcbiAgICAgICAgaWYgKCRzY29wZS5kYXNoYm9hcmQpIHtcbiAgICAgICAgICB2YXIgd2lkZ2V0cyA9ICRzY29wZS5kYXNoYm9hcmQud2lkZ2V0cztcbiAgICAgICAgICBpZiAod2lkZ2V0cykge1xuICAgICAgICAgICAgd2lkZ2V0cy5yZW1vdmUod2lkZ2V0KTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICB1cGRhdGVEYXNoYm9hcmRSZXBvc2l0b3J5KFwiUmVtb3ZlZCB3aWRnZXQgXCIgKyB3aWRnZXQudGl0bGUpO1xuICAgICAgfTtcblxuICAgICAgZnVuY3Rpb24gY2hhbmdlV2lkZ2V0U2l6ZSh3aWRnZXQsIHNpemVmdW5jLCBzYXZlZnVuYykge1xuICAgICAgICBpZiAoIXdpZGdldCkge1xuICAgICAgICAgIGxvZy5kZWJ1ZyhcIndpZGdldCB1bmRlZmluZWRcIik7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIHZhciBncmlkc3RlciA9IGdldEdyaWRzdGVyKCk7XG4gICAgICAgIGxvZy5kZWJ1ZyhcIldpZGdldCBJRDogXCIsIHdpZGdldC5pZCwgXCIgd2lkZ2V0TWFwOiBcIiwgJHNjb3BlLndpZGdldE1hcCk7XG4gICAgICAgIHZhciBlbnRyeSA9ICRzY29wZS53aWRnZXRNYXBbd2lkZ2V0LmlkXTtcbiAgICAgICAgdmFyIHcgPSBlbnRyeS53aWRnZXQ7XG4gICAgICAgIHNpemVmdW5jKGVudHJ5KTtcbiAgICAgICAgZ3JpZHN0ZXIucmVzaXplX3dpZGdldCh3LCBlbnRyeS5zaXplX3gsIGVudHJ5LnNpemVfeSk7XG4gICAgICAgIGdyaWRzdGVyLnNldF9kb21fZ3JpZF9oZWlnaHQoKTtcbiAgICAgICAgc2V0VGltZW91dChmdW5jdGlvbigpIHtcbiAgICAgICAgICBzYXZlZnVuYyh3aWRnZXQpO1xuICAgICAgICB9LCA1MCk7XG4gICAgICB9XG5cbiAgICAgIGZ1bmN0aW9uIG9uV2lkZ2V0UmVuYW1lZCh3aWRnZXQpIHtcbiAgICAgICAgdXBkYXRlRGFzaGJvYXJkUmVwb3NpdG9yeShcIlJlbmFtZWQgd2lkZ2V0IHRvIFwiICsgd2lkZ2V0LnRpdGxlKTtcbiAgICAgIH07XG5cbiAgICAgIGZ1bmN0aW9uIHVwZGF0ZVdpZGdldHMoKSB7XG4gICAgICAgICRzY29wZS5pZCA9ICRyb3V0ZVBhcmFtc1tcImRhc2hib2FyZElkXCJdO1xuICAgICAgICAkc2NvcGUuaWR4ID0gJHJvdXRlUGFyYW1zW1wiZGFzaGJvYXJkSW5kZXhcIl07XG4gICAgICAgIGlmICgkc2NvcGUuaWQpIHtcbiAgICAgICAgICAkc2NvcGUuJGVtaXQoJ2xvYWREYXNoYm9hcmRzJyk7XG4gICAgICAgICAgZGFzaGJvYXJkUmVwb3NpdG9yeS5nZXREYXNoYm9hcmQoJHNjb3BlLmlkLCBvbkRhc2hib2FyZExvYWQpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGRhc2hib2FyZFJlcG9zaXRvcnkuZ2V0RGFzaGJvYXJkcygoZGFzaGJvYXJkcykgPT4ge1xuICAgICAgICAgICAgJHNjb3BlLiRlbWl0KCdkYXNoYm9hcmRzVXBkYXRlZCcsIGRhc2hib2FyZHMpO1xuXG4gICAgICAgICAgICB2YXIgaWR4ID0gJHNjb3BlLmlkeCA/IHBhcnNlSW50KCRzY29wZS5pZHgpIDogMDtcbiAgICAgICAgICAgIHZhciBpZCA9IG51bGw7XG4gICAgICAgICAgICBpZiAoZGFzaGJvYXJkcy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgIHZhciBkYXNoYm9hcmQgPSBkYXNoYm9hcmRzLmxlbmd0aCA+IGlkeCA/IGRhc2hib2FyZHNbaWR4XSA6IGRhc2hib2FyZFswXTtcbiAgICAgICAgICAgICAgaWQgPSBkYXNoYm9hcmQuaWQ7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoaWQpIHtcbiAgICAgICAgICAgICAgJGxvY2F0aW9uLnBhdGgoXCIvZGFzaGJvYXJkL2lkL1wiICsgaWQpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgJGxvY2F0aW9uLnBhdGgoXCIvZGFzaGJvYXJkL2VkaXRcIik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBDb3JlLiRhcHBseSgkc2NvcGUpO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGZ1bmN0aW9uIG9uRGFzaGJvYXJkTG9hZChkYXNoYm9hcmQpIHtcbiAgICAgICAgJHNjb3BlLmRhc2hib2FyZCA9IGRhc2hib2FyZDtcbiAgICAgICAgdmFyIHdpZGdldHMgPSAoKGRhc2hib2FyZCkgPyBkYXNoYm9hcmQud2lkZ2V0cyA6IG51bGwpIHx8IFtdO1xuXG4gICAgICAgIHZhciBtaW5IZWlnaHQgPSAxMDtcbiAgICAgICAgdmFyIG1pbldpZHRoID0gNjtcblxuICAgICAgICBhbmd1bGFyLmZvckVhY2god2lkZ2V0cywgKHdpZGdldCkgPT4ge1xuICAgICAgICAgIGlmICghd2lkZ2V0KSB7XG4gICAgICAgICAgICBsb2cuZGVidWcoXCJVbmRlZmluZWQgd2lkZ2V0LCBza2lwcGluZ1wiKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKGFuZ3VsYXIuaXNEZWZpbmVkKHdpZGdldC5yb3cpICYmIG1pbkhlaWdodCA8IHdpZGdldC5yb3cpIHtcbiAgICAgICAgICAgIG1pbkhlaWdodCA9IHdpZGdldC5yb3cgKyAxO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoYW5ndWxhci5pc0RlZmluZWQod2lkZ2V0LnNpemVfeFxuICAgICAgICAgICAgICAmJiBhbmd1bGFyLmlzRGVmaW5lZCh3aWRnZXQuY29sKSkpIHtcbiAgICAgICAgICAgIHZhciByaWdodEVkZ2UgPSB3aWRnZXQuY29sICsgd2lkZ2V0LnNpemVfeDtcbiAgICAgICAgICAgIGlmIChyaWdodEVkZ2UgPiBtaW5XaWR0aCkge1xuICAgICAgICAgICAgICBtaW5XaWR0aCA9IHJpZ2h0RWRnZSArIDE7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcblxuICAgICAgICB2YXIgZ3JpZHN0ZXIgPSAkZWxlbWVudC5ncmlkc3Rlcih7XG4gICAgICAgICAgd2lkZ2V0X21hcmdpbnM6IFtncmlkTWFyZ2luLCBncmlkTWFyZ2luXSxcbiAgICAgICAgICB3aWRnZXRfYmFzZV9kaW1lbnNpb25zOiBbJHNjb3BlLmdyaWRYLCAkc2NvcGUuZ3JpZFldLFxuICAgICAgICAgIGV4dHJhX3Jvd3M6IG1pbkhlaWdodCxcbiAgICAgICAgICBleHRyYV9jb2xzOiBtaW5XaWR0aCxcbiAgICAgICAgICBtYXhfc2l6ZV94OiBtaW5XaWR0aCxcbiAgICAgICAgICBtYXhfc2l6ZV95OiBtaW5IZWlnaHQsXG4gICAgICAgICAgZHJhZ2dhYmxlOiB7XG4gICAgICAgICAgICBzdG9wOiAoZXZlbnQsIHVpKSA9PiB7XG4gICAgICAgICAgICAgIGlmIChzZXJpYWxpemVEYXNoYm9hcmQoKSkge1xuICAgICAgICAgICAgICAgIHVwZGF0ZURhc2hib2FyZFJlcG9zaXRvcnkoXCJDaGFuZ2luZyBkYXNoYm9hcmQgbGF5b3V0XCIpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9KS5kYXRhKCdncmlkc3RlcicpO1xuXG4gICAgICAgIHZhciB0ZW1wbGF0ZSA9ICR0ZW1wbGF0ZUNhY2hlLmdldChcIndpZGdldFRlbXBsYXRlXCIpO1xuICAgICAgICB2YXIgcmVtYWluaW5nID0gd2lkZ2V0cy5sZW5ndGg7XG5cbiAgICAgICAgZnVuY3Rpb24gbWF5YmVGaW5pc2hVcCgpIHtcbiAgICAgICAgICByZW1haW5pbmcgPSByZW1haW5pbmcgLSAxO1xuICAgICAgICAgIGlmIChyZW1haW5pbmcgPT09IDApIHtcbiAgICAgICAgICAgIG1ha2VSZXNpemFibGUoKTtcbiAgICAgICAgICAgIGdldEdyaWRzdGVyKCkuZW5hYmxlKCk7XG4gICAgICAgICAgICBDb3JlLiRhcHBseSgkc2NvcGUpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGZ1bmN0aW9uIGRvUmVtb3ZlV2lkZ2V0KCRtb2RhbCwgd2lkZ2V0KSB7XG4gICAgICAgICAgbG9nLmRlYnVnKFwiUmVtb3ZlIHdpZGdldDogXCIsIHdpZGdldCk7XG4gICAgICAgICAgdmFyIG1vZGFsID0gJG1vZGFsLm9wZW4oe1xuICAgICAgICAgICAgdGVtcGxhdGVVcmw6IFVybEhlbHBlcnMuam9pbih0ZW1wbGF0ZVBhdGgsICdkZWxldGVXaWRnZXRNb2RhbC5odG1sJyksXG4gICAgICAgICAgICBjb250cm9sbGVyOiBbJyRzY29wZScsICckbW9kYWxJbnN0YW5jZScsICgkc2NvcGUsICRtb2RhbEluc3RhbmNlKSA9PiB7XG4gICAgICAgICAgICAgICRzY29wZS53aWRnZXQgPSB3aWRnZXQ7XG4gICAgICAgICAgICAgICRzY29wZS5vayA9ICgpID0+IHtcbiAgICAgICAgICAgICAgICBtb2RhbC5jbG9zZSgpO1xuICAgICAgICAgICAgICAgIHJlbW92ZVdpZGdldCgkc2NvcGUud2lkZ2V0KTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAkc2NvcGUuY2FuY2VsID0gKCkgPT4ge1xuICAgICAgICAgICAgICAgIG1vZGFsLmRpc21pc3MoKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfV1cbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGZ1bmN0aW9uIGRvUmVuYW1lV2lkZ2V0KCRtb2RhbCwgd2lkZ2V0KSB7XG4gICAgICAgICAgbG9nLmRlYnVnKFwiUmVuYW1lIHdpZGdldDogXCIsIHdpZGdldCk7XG4gICAgICAgICAgdmFyIG1vZGFsID0gJG1vZGFsLm9wZW4oe1xuICAgICAgICAgICAgdGVtcGxhdGVVcmw6IFVybEhlbHBlcnMuam9pbih0ZW1wbGF0ZVBhdGgsICdyZW5hbWVXaWRnZXRNb2RhbC5odG1sJyksXG4gICAgICAgICAgICBjb250cm9sbGVyOiBbJyRzY29wZScsICckbW9kYWxJbnN0YW5jZScsICgkc2NvcGUsICRtb2RhbEluc3RhbmNlKSA9PiB7XG4gICAgICAgICAgICAgICRzY29wZS53aWRnZXQgPSB3aWRnZXQ7XG4gICAgICAgICAgICAgICRzY29wZS5jb25maWcgPSB7XG4gICAgICAgICAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgICAgJ3RpdGxlJzoge1xuICAgICAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICAgICAgZGVmYXVsdDogd2lkZ2V0LnRpdGxlXG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAkc2NvcGUub2sgPSAoKSA9PiB7XG4gICAgICAgICAgICAgICAgbW9kYWwuY2xvc2UoKTtcbiAgICAgICAgICAgICAgICBvbldpZGdldFJlbmFtZWQoJHNjb3BlLndpZGdldCk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgJHNjb3BlLmNhbmNlbCA9ICgpID0+IHtcbiAgICAgICAgICAgICAgICBtb2RhbC5kaXNtaXNzKCk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1dXG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuICAgICAgICBhbmd1bGFyLmZvckVhY2god2lkZ2V0cywgKHdpZGdldCkgPT4ge1xuICAgICAgICAgIHZhciB0eXBlID0gJ2ludGVybmFsJztcbiAgICAgICAgICBpZiAoJ2lmcmFtZScgaW4gd2lkZ2V0KSB7XG4gICAgICAgICAgICB0eXBlID0gJ2V4dGVybmFsJztcbiAgICAgICAgICB9XG4gICAgICAgICAgc3dpdGNoICh0eXBlKSB7XG4gICAgICAgICAgICBjYXNlICdleHRlcm5hbCc6XG4gICAgICAgICAgICAgIHZhciBzY29wZSA9ICRzY29wZS4kbmV3KCk7XG4gICAgICAgICAgICAgIHNjb3BlLndpZGdldCA9IHdpZGdldDtcbiAgICAgICAgICAgICAgc2NvcGUucmVtb3ZlV2lkZ2V0ID0gKHdpZGdldCkgPT4gZG9SZW1vdmVXaWRnZXQoJG1vZGFsLCB3aWRnZXQpO1xuICAgICAgICAgICAgICBzY29wZS5yZW5hbWVXaWRnZXQgPSAod2lkZ2V0KSA9PiBkb1JlbmFtZVdpZGdldCgkbW9kYWwsIHdpZGdldCk7XG4gICAgICAgICAgICAgIHZhciB3aWRnZXRCb2R5OmFueSA9IGFuZ3VsYXIuZWxlbWVudCgkdGVtcGxhdGVDYWNoZS5nZXQoJ2lmcmFtZVdpZGdldFRlbXBsYXRlLmh0bWwnKSk7XG4gICAgICAgICAgICAgIHZhciBvdXRlckRpdiA9IGFuZ3VsYXIuZWxlbWVudCgkdGVtcGxhdGVDYWNoZS5nZXQoJ3dpZGdldEJsb2NrVGVtcGxhdGUuaHRtbCcpKTtcbiAgICAgICAgICAgICAgd2lkZ2V0Qm9keS5maW5kKCdpZnJhbWUnKS5hdHRyKCdzcmMnLCB3aWRnZXQuaWZyYW1lKTtcbiAgICAgICAgICAgICAgb3V0ZXJEaXYuYXBwZW5kKCRjb21waWxlKHdpZGdldEJvZHkpKHNjb3BlKSk7XG4gICAgICAgICAgICAgIHZhciB3ID0gZ3JpZHN0ZXIuYWRkX3dpZGdldChvdXRlckRpdiwgd2lkZ2V0LnNpemVfeCwgd2lkZ2V0LnNpemVfeSwgd2lkZ2V0LmNvbCwgd2lkZ2V0LnJvdyk7XG4gICAgICAgICAgICAgICRzY29wZS53aWRnZXRNYXBbd2lkZ2V0LmlkXSA9IHtcbiAgICAgICAgICAgICAgICB3aWRnZXQ6IHdcbiAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgbWF5YmVGaW5pc2hVcCgpO1xuICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgJ2ludGVybmFsJzogXG4gICAgICAgICAgICAgIHZhciBwYXRoID0gd2lkZ2V0LnBhdGg7XG4gICAgICAgICAgICAgIHZhciBzZWFyY2ggPSBudWxsO1xuICAgICAgICAgICAgICBpZiAod2lkZ2V0LnNlYXJjaCkge1xuICAgICAgICAgICAgICAgIHNlYXJjaCA9IERhc2hib2FyZC5kZWNvZGVVUklDb21wb25lbnRQcm9wZXJ0aWVzKHdpZGdldC5zZWFyY2gpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGlmICh3aWRnZXQucm91dGVQYXJhbXMpIHtcbiAgICAgICAgICAgICAgICBfLmV4dGVuZChzZWFyY2gsIGFuZ3VsYXIuZnJvbUpzb24od2lkZ2V0LnJvdXRlUGFyYW1zKSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgdmFyIGhhc2ggPSB3aWRnZXQuaGFzaDsgLy8gVE9ETyBkZWNvZGUgb2JqZWN0P1xuICAgICAgICAgICAgICB2YXIgbG9jYXRpb24gPSBuZXcgUmVjdGFuZ2xlTG9jYXRpb24oJGxvY2F0aW9uLCBwYXRoLCBzZWFyY2gsIGhhc2gpO1xuICAgICAgICAgICAgICBpZiAoIXdpZGdldC5zaXplX3ggfHwgd2lkZ2V0LnNpemVfeCA8IDEpIHtcbiAgICAgICAgICAgICAgICB3aWRnZXQuc2l6ZV94ID0gMTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBpZiAoIXdpZGdldC5zaXplX3kgfHwgd2lkZ2V0LnNpemVfeSA8IDEpIHtcbiAgICAgICAgICAgICAgICB3aWRnZXQuc2l6ZV95ID0gMTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB2YXIgdG1wTW9kdWxlTmFtZSA9ICdkYXNoYm9hcmQtJyArIHdpZGdldC5pZDtcbiAgICAgICAgICAgICAgdmFyIHRtcE1vZHVsZSA9IGFuZ3VsYXIubW9kdWxlKHRtcE1vZHVsZU5hbWUsIG1vZHVsZXMpO1xuICAgICAgICAgICAgICB0bXBNb2R1bGUuY29uZmlnKFsnJHByb3ZpZGUnLCAoJHByb3ZpZGUpID0+IHtcbiAgICAgICAgICAgICAgICAkcHJvdmlkZS5kZWNvcmF0b3IoJ0hhd3Rpb0Rhc2hib2FyZCcsIFsnJGRlbGVnYXRlJywgJyRyb290U2NvcGUnLCAoJGRlbGVnYXRlLCAkcm9vdFNjb3BlKSA9PiB7XG4gICAgICAgICAgICAgICAgICAkZGVsZWdhdGUuaW5EYXNoYm9hcmQgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgcmV0dXJuICRkZWxlZ2F0ZTtcbiAgICAgICAgICAgICAgICB9XSk7XG4gICAgICAgICAgICAgICAgJHByb3ZpZGUuZGVjb3JhdG9yKCckbG9jYXRpb24nLCBbJyRkZWxlZ2F0ZScsICgkZGVsZWdhdGUpID0+IHtcbiAgICAgICAgICAgICAgICAgIC8vbG9nLmRlYnVnKFwiVXNpbmcgJGxvY2F0aW9uOiBcIiwgbG9jYXRpb24pO1xuICAgICAgICAgICAgICAgICAgcmV0dXJuIGxvY2F0aW9uO1xuICAgICAgICAgICAgICAgIH1dKTtcbiAgICAgICAgICAgICAgICAkcHJvdmlkZS5kZWNvcmF0b3IoJyRyb3V0ZScsIFsnJGRlbGVnYXRlJywgKCRkZWxlZ2F0ZSkgPT4ge1xuICAgICAgICAgICAgICAgICAgLy8gcmVhbGx5IGhhbmR5IGZvciBkZWJ1Z2dpbmcsIG1vc3RseSB0byB0ZWxsIGlmIGEgd2lkZ2V0J3Mgcm91dGVcbiAgICAgICAgICAgICAgICAgIC8vIGlzbid0IGFjdHVhbGx5IGF2YWlsYWJsZSBpbiB0aGUgY2hpbGQgYXBwXG4gICAgICAgICAgICAgICAgICAvL2xvZy5kZWJ1ZyhcIlVzaW5nICRyb3V0ZTogXCIsICRkZWxlZ2F0ZSk7XG4gICAgICAgICAgICAgICAgICByZXR1cm4gJGRlbGVnYXRlO1xuICAgICAgICAgICAgICAgIH1dKTtcbiAgICAgICAgICAgICAgICAkcHJvdmlkZS5kZWNvcmF0b3IoJyRyb3V0ZVBhcmFtcycsIFsnJGRlbGVnYXRlJywgKCRkZWxlZ2F0ZSkgPT4ge1xuICAgICAgICAgICAgICAgICAgLy9sb2cuZGVidWcoXCJVc2luZyAkcm91dGVQYXJhbXM6IFwiLCBzZWFyY2gpO1xuICAgICAgICAgICAgICAgICAgcmV0dXJuIHNlYXJjaDtcbiAgICAgICAgICAgICAgICB9XSk7XG4gICAgICAgICAgICAgIH1dKTtcbiAgICAgICAgICAgICAgdG1wTW9kdWxlLmNvbnRyb2xsZXIoJ0hhd3Rpb0Rhc2hib2FyZC5UaXRsZScsIFtcIiRzY29wZVwiLCBcIiRtb2RhbFwiLCAoJHNjb3BlLCAkbW9kYWwpID0+IHtcbiAgICAgICAgICAgICAgICAkc2NvcGUud2lkZ2V0ID0gd2lkZ2V0O1xuICAgICAgICAgICAgICAgICRzY29wZS5yZW1vdmVXaWRnZXQgPSAod2lkZ2V0KSA9PiBkb1JlbW92ZVdpZGdldCgkbW9kYWwsIHdpZGdldCk7XG4gICAgICAgICAgICAgICAgJHNjb3BlLnJlbmFtZVdpZGdldCA9ICh3aWRnZXQpID0+IGRvUmVuYW1lV2lkZ2V0KCRtb2RhbCwgd2lkZ2V0KTtcbiAgICAgICAgICAgICAgfV0pO1xuXG4gICAgICAgICAgICAgIHZhciBkaXY6YW55ID0gJCh0ZW1wbGF0ZSk7XG4gICAgICAgICAgICAgIGRpdi5hdHRyKHsgJ2RhdGEtd2lkZ2V0SWQnOiB3aWRnZXQuaWQgfSk7XG4gICAgICAgICAgICAgIHZhciBib2R5ID0gZGl2LmZpbmQoJy53aWRnZXQtYm9keScpO1xuICAgICAgICAgICAgICB2YXIgd2lkZ2V0Qm9keSA9ICR0ZW1wbGF0ZVJlcXVlc3Qod2lkZ2V0LmluY2x1ZGUpO1xuICAgICAgICAgICAgICB3aWRnZXRCb2R5LnRoZW4oKHdpZGdldEJvZHkpID0+IHtcbiAgICAgICAgICAgICAgICB2YXIgb3V0ZXJEaXYgPSBhbmd1bGFyLmVsZW1lbnQoJHRlbXBsYXRlQ2FjaGUuZ2V0KCd3aWRnZXRCbG9ja1RlbXBsYXRlLmh0bWwnKSk7XG4gICAgICAgICAgICAgICAgYm9keS5odG1sKHdpZGdldEJvZHkpO1xuICAgICAgICAgICAgICAgIG91dGVyRGl2Lmh0bWwoZGl2KTtcbiAgICAgICAgICAgICAgICBhbmd1bGFyLmJvb3RzdHJhcChkaXYsIFt0bXBNb2R1bGVOYW1lXSk7XG4gICAgICAgICAgICAgICAgdmFyIHcgPSBncmlkc3Rlci5hZGRfd2lkZ2V0KG91dGVyRGl2LCB3aWRnZXQuc2l6ZV94LCB3aWRnZXQuc2l6ZV95LCB3aWRnZXQuY29sLCB3aWRnZXQucm93KTtcbiAgICAgICAgICAgICAgICAkc2NvcGUud2lkZ2V0TWFwW3dpZGdldC5pZF0gPSB7XG4gICAgICAgICAgICAgICAgICB3aWRnZXQ6IHdcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgIG1heWJlRmluaXNoVXAoKTtcbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICB9XG5cbiAgICAgIGZ1bmN0aW9uIHNlcmlhbGl6ZURhc2hib2FyZCgpIHtcbiAgICAgICAgdmFyIGdyaWRzdGVyID0gZ2V0R3JpZHN0ZXIoKTtcbiAgICAgICAgaWYgKGdyaWRzdGVyKSB7XG4gICAgICAgICAgdmFyIGRhdGEgPSBncmlkc3Rlci5zZXJpYWxpemUoKTtcbiAgICAgICAgICAvL2NvbnNvbGUubG9nKFwiZ290IGRhdGE6IFwiICsgSlNPTi5zdHJpbmdpZnkoZGF0YSkpO1xuXG4gICAgICAgICAgdmFyIHdpZGdldHMgPSAkc2NvcGUuZGFzaGJvYXJkLndpZGdldHMgfHwgW107XG4gICAgICAgICAgLy8gY29uc29sZS5sb2coXCJXaWRnZXRzOiBcIiwgd2lkZ2V0cyk7XG5cbiAgICAgICAgICAvLyBsZXRzIGFzc3VtZSB0aGUgZGF0YSBpcyBpbiB0aGUgb3JkZXIgb2YgdGhlIHdpZGdldHMuLi5cbiAgICAgICAgICBhbmd1bGFyLmZvckVhY2god2lkZ2V0cywgKHdpZGdldCwgaWR4KSA9PiB7XG4gICAgICAgICAgICB2YXIgdmFsdWUgPSBkYXRhW2lkeF07XG4gICAgICAgICAgICBpZiAodmFsdWUgJiYgd2lkZ2V0KSB7XG4gICAgICAgICAgICAgIC8vIGxldHMgY29weSB0aGUgdmFsdWVzIGFjcm9zc1xuICAgICAgICAgICAgICBhbmd1bGFyLmZvckVhY2godmFsdWUsIChhdHRyLCBrZXkpID0+IHdpZGdldFtrZXldID0gYXR0cik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSk7XG4gICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuXG4gICAgICBmdW5jdGlvbiBtYWtlUmVzaXphYmxlKCkge1xuICAgICAgICB2YXIgYmxvY2tzOmFueSA9ICQoJy5ncmlkLWJsb2NrJyk7XG4gICAgICAgIGJsb2Nrcy5yZXNpemFibGUoJ2Rlc3Ryb3knKTtcblxuICAgICAgICBibG9ja3MucmVzaXphYmxlKHtcbiAgICAgICAgICBncmlkOiBbZ3JpZFNpemUgKyAoZ3JpZE1hcmdpbiAqIDIpLCBncmlkU2l6ZSArIChncmlkTWFyZ2luICogMildLFxuICAgICAgICAgIGFuaW1hdGU6IGZhbHNlLFxuICAgICAgICAgIG1pbldpZHRoOiBncmlkU2l6ZSxcbiAgICAgICAgICBtaW5IZWlnaHQ6IGdyaWRTaXplLFxuICAgICAgICAgIGF1dG9IaWRlOiBmYWxzZSxcbiAgICAgICAgICBzdGFydDogZnVuY3Rpb24oZXZlbnQsIHVpKSB7XG4gICAgICAgICAgICBncmlkSGVpZ2h0ID0gZ2V0R3JpZHN0ZXIoKS4kZWwuaGVpZ2h0KCk7XG4gICAgICAgICAgfSxcbiAgICAgICAgICByZXNpemU6IGZ1bmN0aW9uKGV2ZW50LCB1aSkge1xuICAgICAgICAgICAgLy9zZXQgbmV3IGdyaWQgaGVpZ2h0IGFsb25nIHRoZSBkcmFnZ2luZyBwZXJpb2RcbiAgICAgICAgICAgIHZhciBnID0gZ2V0R3JpZHN0ZXIoKTtcbiAgICAgICAgICAgIHZhciBkZWx0YSA9IGdyaWRTaXplICsgZ3JpZE1hcmdpbiAqIDI7XG4gICAgICAgICAgICBpZiAoZXZlbnQub2Zmc2V0WSA+IGcuJGVsLmhlaWdodCgpKVxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICB2YXIgZXh0cmEgPSBNYXRoLmZsb29yKChldmVudC5vZmZzZXRZIC0gZ3JpZEhlaWdodCkgLyBkZWx0YSArIDEpO1xuICAgICAgICAgICAgICB2YXIgbmV3SGVpZ2h0ID0gZ3JpZEhlaWdodCArIGV4dHJhICogZGVsdGE7XG4gICAgICAgICAgICAgIGcuJGVsLmNzcygnaGVpZ2h0JywgbmV3SGVpZ2h0KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9LFxuICAgICAgICAgIHN0b3A6IGZ1bmN0aW9uKGV2ZW50LCB1aSkge1xuICAgICAgICAgICAgdmFyIHJlc2l6ZWQgPSAkKHRoaXMpO1xuICAgICAgICAgICAgc2V0VGltZW91dChmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgcmVzaXplQmxvY2socmVzaXplZCk7XG4gICAgICAgICAgICB9LCAzMDApO1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cbiAgICAgICAgJCgnLnVpLXJlc2l6YWJsZS1oYW5kbGUnKS5ob3ZlcihmdW5jdGlvbigpIHtcbiAgICAgICAgICBnZXRHcmlkc3RlcigpLmRpc2FibGUoKTtcbiAgICAgICAgfSwgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgZ2V0R3JpZHN0ZXIoKS5lbmFibGUoKTtcbiAgICAgICAgfSk7XG5cbiAgICAgIH1cblxuXG4gICAgICBmdW5jdGlvbiByZXNpemVCbG9jayhlbG1PYmopIHtcbiAgICAgICAgdmFyIGFyZWEgPSBlbG1PYmouZmluZCgnLndpZGdldC1hcmVhJyk7XG4gICAgICAgIHZhciB3ID0gZWxtT2JqLndpZHRoKCkgLSBncmlkU2l6ZTtcbiAgICAgICAgdmFyIGggPSBlbG1PYmouaGVpZ2h0KCkgLSBncmlkU2l6ZTtcblxuICAgICAgICBmb3IgKHZhciBncmlkX3cgPSAxOyB3ID4gMDsgdyAtPSAoZ3JpZFNpemUgKyAoZ3JpZE1hcmdpbiAqIDIpKSkge1xuICAgICAgICAgIGdyaWRfdysrO1xuICAgICAgICB9XG5cbiAgICAgICAgZm9yICh2YXIgZ3JpZF9oID0gMTsgaCA+IDA7IGggLT0gKGdyaWRTaXplICsgKGdyaWRNYXJnaW4gKiAyKSkpIHtcbiAgICAgICAgICBncmlkX2grKztcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciB3aWRnZXQgPSB7XG4gICAgICAgICAgaWQ6IGFyZWEuYXR0cignZGF0YS13aWRnZXRJZCcpXG4gICAgICAgIH07XG5cbiAgICAgICAgY2hhbmdlV2lkZ2V0U2l6ZSh3aWRnZXQsIGZ1bmN0aW9uKHdpZGdldCkge1xuICAgICAgICAgIHdpZGdldC5zaXplX3ggPSBncmlkX3c7XG4gICAgICAgICAgd2lkZ2V0LnNpemVfeSA9IGdyaWRfaDtcbiAgICAgICAgfSwgZnVuY3Rpb24od2lkZ2V0KSB7XG4gICAgICAgICAgaWYgKHNlcmlhbGl6ZURhc2hib2FyZCgpKSB7XG4gICAgICAgICAgICB1cGRhdGVEYXNoYm9hcmRSZXBvc2l0b3J5KFwiQ2hhbmdlZCBzaXplIG9mIHdpZGdldDogXCIgKyB3aWRnZXQuaWQpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cbiAgICAgIH1cblxuICAgICAgZnVuY3Rpb24gdXBkYXRlRGFzaGJvYXJkUmVwb3NpdG9yeShtZXNzYWdlOiBzdHJpbmcpIHtcbiAgICAgICAgaWYgKCRzY29wZS5kYXNoYm9hcmQpIHtcbiAgICAgICAgICB2YXIgY29tbWl0TWVzc2FnZSA9IG1lc3NhZ2U7XG4gICAgICAgICAgaWYgKCRzY29wZS5kYXNoYm9hcmQgJiYgJHNjb3BlLmRhc2hib2FyZC50aXRsZSkge1xuICAgICAgICAgICAgY29tbWl0TWVzc2FnZSArPSBcIiBvbiBkYXNoYm9hcmQgXCIgKyAkc2NvcGUuZGFzaGJvYXJkLnRpdGxlO1xuICAgICAgICAgIH1cbiAgICAgICAgICBkYXNoYm9hcmRSZXBvc2l0b3J5LnB1dERhc2hib2FyZHMoWyRzY29wZS5kYXNoYm9hcmRdLCBjb21taXRNZXNzYWdlLCBEYXNoYm9hcmQub25PcGVyYXRpb25Db21wbGV0ZSk7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgZnVuY3Rpb24gZ2V0R3JpZHN0ZXIoKSB7XG4gICAgICAgIHJldHVybiAkZWxlbWVudC5ncmlkc3RlcigpLmRhdGEoJ2dyaWRzdGVyJyk7XG4gICAgICB9XG5cbiAgICB9XTtcblxuICB9XG5cbn1cbiIsIi8vLyA8cmVmZXJlbmNlIHBhdGg9XCJkYXNoYm9hcmRQbHVnaW4udHNcIi8+XG4vKipcbiAqIEBtb2R1bGUgRGFzaGJvYXJkXG4gKi9cbm1vZHVsZSBEYXNoYm9hcmQge1xuICBfbW9kdWxlLmNvbnRyb2xsZXIoXCJEYXNoYm9hcmQuSW1wb3J0Q29udHJvbGxlclwiLCBbXCIkc2NvcGVcIiwgXCIkbG9jYXRpb25cIiwgXCIkcm91dGVQYXJhbXNcIiwgXCJkYXNoYm9hcmRSZXBvc2l0b3J5XCIsICgkc2NvcGUsICRsb2NhdGlvbiwgJHJvdXRlUGFyYW1zLCBkYXNoYm9hcmRSZXBvc2l0b3J5OkRhc2hib2FyZFJlcG9zaXRvcnkpID0+IHtcbiAgICAkc2NvcGUucGxhY2Vob2xkZXIgPSBcIlBhc3RlIHRoZSBKU09OIGhlcmUgZm9yIHRoZSBkYXNoYm9hcmQgY29uZmlndXJhdGlvbiB0byBpbXBvcnQuLi5cIjtcbiAgICAkc2NvcGUuc291cmNlID0gJHNjb3BlLnBsYWNlaG9sZGVyO1xuXG4gICAgdmFyIG9wdGlvbnMgPSB7XG4gICAgICBtb2RlOiB7XG4gICAgICAgIG5hbWU6IFwiamF2YXNjcmlwdFwiXG4gICAgICB9XG4gICAgfTtcbiAgICAvLyRzY29wZS5jb2RlTWlycm9yT3B0aW9ucyA9IENvZGVFZGl0b3IuY3JlYXRlRWRpdG9yU2V0dGluZ3Mob3B0aW9ucyk7XG5cblxuICAgICRzY29wZS5pc1ZhbGlkID0gKCkgPT4gJHNjb3BlLnNvdXJjZSAmJiAkc2NvcGUuc291cmNlICE9PSAkc2NvcGUucGxhY2Vob2xkZXI7XG5cbiAgICAkc2NvcGUuaW1wb3J0SlNPTiA9ICgpID0+IHtcbiAgICAgIHZhciBqc29uID0gW107XG4gICAgICAvLyBsZXRzIHBhcnNlIHRoZSBKU09OLi4uXG4gICAgICB0cnkge1xuICAgICAgICBqc29uID0gSlNPTi5wYXJzZSgkc2NvcGUuc291cmNlKTtcbiAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgLy9IYXd0aW9Db3JlLm5vdGlmaWNhdGlvbihcImVycm9yXCIsIFwiQ291bGQgbm90IHBhcnNlIHRoZSBKU09OXFxuXCIgKyBlKTtcbiAgICAgICAganNvbiA9IFtdO1xuICAgICAgfVxuICAgICAgdmFyIGFycmF5ID0gW107XG4gICAgICBpZiAoYW5ndWxhci5pc0FycmF5KGpzb24pKSB7XG4gICAgICAgIGFycmF5ID0ganNvbjtcbiAgICAgIH0gZWxzZSBpZiAoYW5ndWxhci5pc09iamVjdChqc29uKSkge1xuICAgICAgICBhcnJheS5wdXNoKGpzb24pO1xuICAgICAgfVxuXG4gICAgICBpZiAoYXJyYXkubGVuZ3RoKSB7XG4gICAgICAgIC8vIGxldHMgZW5zdXJlIHdlIGhhdmUgc29tZSB2YWxpZCBpZHMgYW5kIHN0dWZmLi4uXG4gICAgICAgIGFuZ3VsYXIuZm9yRWFjaChhcnJheSwgKGRhc2gsIGluZGV4KSA9PiB7XG4gICAgICAgICAgYW5ndWxhci5jb3B5KGRhc2gsIGRhc2hib2FyZFJlcG9zaXRvcnkuY3JlYXRlRGFzaGJvYXJkKGRhc2gpKTtcbiAgICAgICAgfSk7XG4gICAgICAgIGRhc2hib2FyZFJlcG9zaXRvcnkucHV0RGFzaGJvYXJkcyhhcnJheSwgXCJJbXBvcnRlZCBkYXNoYm9hcmQgSlNPTlwiLCBEYXNoYm9hcmQub25PcGVyYXRpb25Db21wbGV0ZSk7XG4gICAgICAgICRsb2NhdGlvbi5wYXRoKFwiL2Rhc2hib2FyZC9lZGl0XCIpO1xuICAgICAgfVxuICAgIH1cbiAgfV0pO1xufVxuIiwiLy8vIDxyZWZlcmVuY2UgcGF0aD1cImRhc2hib2FyZFBsdWdpbi50c1wiLz5cbi8qKlxuICogQG1vZHVsZSBEYXNoYm9hcmRcbiAqL1xubW9kdWxlIERhc2hib2FyZCB7XG4gIF9tb2R1bGUuY29udHJvbGxlcihcIkRhc2hib2FyZC5OYXZCYXJDb250cm9sbGVyXCIsIFtcIiRzY29wZVwiLCBcIiRyb3V0ZVBhcmFtc1wiLCBcIiRyb290U2NvcGVcIiwgXCJkYXNoYm9hcmRSZXBvc2l0b3J5XCIsICgkc2NvcGUsICRyb3V0ZVBhcmFtcywgJHJvb3RTY29wZSwgZGFzaGJvYXJkUmVwb3NpdG9yeTpEYXNoYm9hcmRSZXBvc2l0b3J5KSA9PiB7XG5cbiAgICAkc2NvcGUuX2Rhc2hib2FyZHMgPSBbXTtcblxuICAgICRzY29wZS5hY3RpdmVEYXNoYm9hcmQgPSAkcm91dGVQYXJhbXNbJ2Rhc2hib2FyZElkJ107XG5cbiAgICAkc2NvcGUuJG9uKCdsb2FkRGFzaGJvYXJkcycsIGxvYWREYXNoYm9hcmRzKTtcblxuICAgICRzY29wZS4kb24oJ2Rhc2hib2FyZHNVcGRhdGVkJywgZGFzaGJvYXJkTG9hZGVkKTtcblxuICAgICRzY29wZS5kYXNoYm9hcmRzID0gKCkgPT4ge1xuICAgICAgcmV0dXJuICRzY29wZS5fZGFzaGJvYXJkc1xuICAgIH07XG5cbiAgICAkc2NvcGUub25UYWJSZW5hbWVkID0gZnVuY3Rpb24oZGFzaCkge1xuICAgICAgZGFzaGJvYXJkUmVwb3NpdG9yeS5wdXREYXNoYm9hcmRzKFtkYXNoXSwgXCJSZW5hbWVkIGRhc2hib2FyZFwiLCAoZGFzaGJvYXJkcykgPT4ge1xuICAgICAgICBkYXNoYm9hcmRMb2FkZWQobnVsbCwgZGFzaGJvYXJkcyk7XG4gICAgICB9KTtcbiAgICB9O1xuXG4gICAgZnVuY3Rpb24gZGFzaGJvYXJkTG9hZGVkKGV2ZW50LCBkYXNoYm9hcmRzKSB7XG4gICAgICBsb2cuZGVidWcoXCJuYXZiYXIgZGFzaGJvYXJkTG9hZGVkOiBcIiwgZGFzaGJvYXJkcyk7XG4gICAgICAkc2NvcGUuX2Rhc2hib2FyZHMgPSBkYXNoYm9hcmRzO1xuICAgICAgaWYgKGV2ZW50ID09PSBudWxsKSB7XG4gICAgICAgICRyb290U2NvcGUuJGJyb2FkY2FzdCgnZGFzaGJvYXJkc1VwZGF0ZWQnLCBkYXNoYm9hcmRzKTtcbiAgICAgICAgQ29yZS4kYXBwbHkoJHNjb3BlKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBsb2FkRGFzaGJvYXJkcyhldmVudCkge1xuICAgICAgZGFzaGJvYXJkUmVwb3NpdG9yeS5nZXREYXNoYm9hcmRzKChkYXNoYm9hcmRzKSA9PiB7XG4gICAgICAgIC8vIHByZXZlbnQgdGhlIGJyb2FkY2FzdCBmcm9tIGhhcHBlbmluZy4uLlxuICAgICAgICBkYXNoYm9hcmRMb2FkZWQobnVsbCwgZGFzaGJvYXJkcyk7XG4gICAgICAgIENvcmUuJGFwcGx5KCRzY29wZSk7XG4gICAgICB9KTtcbiAgICB9XG4gIH1dKTtcbn1cbiIsIi8vLyA8cmVmZXJlbmNlIHBhdGg9XCJkYXNoYm9hcmRQbHVnaW4udHNcIi8+XG4vKipcbiAqIEBtb2R1bGUgRGFzaGJvYXJkXG4gKi9cbm1vZHVsZSBEYXNoYm9hcmQge1xuICBleHBvcnQgdmFyIFNoYXJlQ29udHJvbGxlciA9IF9tb2R1bGUuY29udHJvbGxlcihcIkRhc2hib2FyZC5TaGFyZUNvbnRyb2xsZXJcIiwgW1wiJHNjb3BlXCIsIFwiJGxvY2F0aW9uXCIsIFwiJHJvdXRlUGFyYW1zXCIsIFwiZGFzaGJvYXJkUmVwb3NpdG9yeVwiLCAoJHNjb3BlLCAkbG9jYXRpb24sICRyb3V0ZVBhcmFtcywgZGFzaGJvYXJkUmVwb3NpdG9yeTpEYXNoYm9hcmRSZXBvc2l0b3J5KSA9PiB7XG4gICAgdmFyIGlkID0gJHJvdXRlUGFyYW1zW1wiZGFzaGJvYXJkSWRcIl07XG4gICAgZGFzaGJvYXJkUmVwb3NpdG9yeS5nZXREYXNoYm9hcmQoaWQsIG9uRGFzaGJvYXJkTG9hZCk7XG5cbiAgICB2YXIgb3B0aW9ucyA9IHtcbiAgICAgIG1vZGU6IHtcbiAgICAgICAgICBuYW1lOiBcImphdmFzY3JpcHRcIlxuICAgICAgfVxuICAgIH07XG4gICAgLy8kc2NvcGUuY29kZU1pcnJvck9wdGlvbnMgPSBDb2RlRWRpdG9yLmNyZWF0ZUVkaXRvclNldHRpbmdzKG9wdGlvbnMpO1xuXG4gICAgZnVuY3Rpb24gb25EYXNoYm9hcmRMb2FkKGRhc2hib2FyZCkge1xuICAgICAgJHNjb3BlLmRhc2hib2FyZCA9IERhc2hib2FyZC5jbGVhbkRhc2hib2FyZERhdGEoZGFzaGJvYXJkKTtcblxuICAgICAgJHNjb3BlLmpzb24gPSB7XG4gICAgICAgIFwiZGVzY3JpcHRpb25cIjogXCJoYXd0aW8gZGFzaGJvYXJkc1wiLFxuICAgICAgICBcInB1YmxpY1wiOiB0cnVlLFxuICAgICAgICBcImZpbGVzXCI6IHtcbiAgICAgICAgICBcImRhc2hib2FyZHMuanNvblwiOiB7XG4gICAgICAgICAgICBcImNvbnRlbnRcIjogSlNPTi5zdHJpbmdpZnkoJHNjb3BlLmRhc2hib2FyZCwgbnVsbCwgXCIgIFwiKVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfTtcblxuICAgICAgJHNjb3BlLnNvdXJjZSA9IEpTT04uc3RyaW5naWZ5KCRzY29wZS5kYXNoYm9hcmQsIG51bGwsIFwiICBcIik7XG4gICAgICBDb3JlLiRhcHBseU5vd09yTGF0ZXIoJHNjb3BlKTtcbiAgICB9XG4gIH1dKTtcbn1cbiJdLCJzb3VyY2VSb290IjoiL3NvdXJjZS8ifQ==
angular.module("hawtio-dashboard-templates", []).run(["$templateCache", function($templateCache) {$templateCache.put("plugins/dashboard/html/addToDashboard.html","<div class=\"controller-section\" ng-controller=\"Dashboard.EditDashboardsController\">\n  <div class=\"row-fluid\">\n    <div class=\"span10 offset1 well\">\n      Select a dashboard (or multiple dashboards) in the table below and click \"Add View To Dashboard\" to add the view to a dashboard.  You can also create a new dashboard using the \"Create\" button, select it and then click the \"Add View To Dashboard\" to add the view to a new dashboard.\n    </div>\n  </div>\n  <div class=\"row-fluid\">\n\n    <div class=\"span12\">\n      <ul class=\"nav nav-tabs\">\n        <li>\n          <button class=\"btn btn-primary\" \n                  ng-disabled=\"!hasSelection()\" ng-click=\"addViewToDashboard()\"\n                  title=\"Adds the current view to the selected dashboard(s)\" data-placement=\"bottom\">\n            <i class=\"fa fa-dashboard\"></i> Add View To Dashboard\n          </a>\n        </li>\n        <li>\n          <button class=\"btn btn-success\" ng-click=\"create()\"\n             title=\"Create a new empty dashboard\"\n             data-placement=\"bottom\">\n            <i class=\"fa fa-plus\"></i> Create</button>\n        </li>\n      </ul>\n\n    </div>\n    <!--\n    <div class=\"span6\">\n      <div class=\"control-group\">\n        <input type=\"text\" class=\"span12 search-query\" ng-model=\"gridOptions.filterOptions.filterText\" placeholder=\"Filter...\">\n      </div>\n    </div>\n    -->\n  </div>\n\n  <div class=\"row-fluid\">\n    <table class=\"table table-striped\" hawtio-simple-table=\"gridOptions\"></table>\n  </div>\n</div>\n");
$templateCache.put("plugins/dashboard/html/createDashboardModal.html","<div class=\"modal-header\">\n  <h3 class=\"modal-title\">Create New Dashboard</h3>\n</div>\n<div class=\"modal-body\">\n  <div hawtio-form-2=\"config\" entity=\"entity\"></div>\n</div>\n<div class=\"modal-footer\">\n  <button class=\"btn btn-primary\" ng-click=\"ok()\">OK</button>\n  <button class=\"btn btn-warning\" ng-click=\"cancel()\">Cancel</button>\n</div>\n");
$templateCache.put("plugins/dashboard/html/dashboard.html","<script type=\"text/ng-template\" id=\"widgetTemplate\">\n  <div class=\"widget-area\">\n    <div class=\"widget-title\" ng-controller=\"HawtioDashboard.Title\">\n      <div class=\"row-fluid\">\n        <div class=\"pull-left\">\n          {{widget.title}}\n        </div>\n        <div class=\"pull-right\">\n          <i class=\"fa fa-pencil\" title=\"Rename this widget\" ng-click=\"renameWidget(widget)\"></i>\n          <i class=\"fa fa-times\" title=\"Removes this view from the dashboard\" ng-click=\"removeWidget(widget)\"></i>\n        </div>\n      </div>\n    </div>\n    <div class=\"widget-body\">\n    </div>\n  </div>\n</script>\n<script type=\"text/ng-template\" id=\"iframeWidgetTemplate.html\">\n  <div class=\"widget-area\" data-widgetId=\"{{widget.id}}\">\n    <div class=\"widget-title\">\n      <div class=\"row-fluid\">\n        <div class=\"pull-left\">\n          {{widget.title}}\n        </div>\n        <div class=\"pull-right\">\n          <i class=\"fa fa-pencil\" title=\"Rename this widget\" ng-click=\"renameWidget(widget)\"></i>\n          <i class=\"fa fa-times\" title=\"Removes this view from the dashboard\" ng-click=\"removeWidget(widget)\"></i>\n        </div>\n      </div>\n    </div>\n    <div class=\"widget-body\">\n      <div class=\"iframe-holder\">\n        <iframe seamless=\"true\"></iframe>\n      </div>\n    </div>\n  </div>\n</script>\n<script type=\"text/ng-template\" id=\"widgetBlockTemplate.html\">\n  <li class=\"grid-block\" style=\"display: list-item; position: absolute\" ng-non-bindable data-$injector=\"\"></li>\n</script>\n\n<!--\n<div class=\"gridster\" ng-controller=\"Dashboard.DashboardController\">\n  <ul id=\"widgets\">\n  </ul>\n</div>\n-->\n\n<div class=\"row-fluid\">\n  <div class=\"span12 gridster\">\n    <ul id=\"widgets\" hawtio-dashboard></ul>\n  </div>\n</div>\n\n\n");
$templateCache.put("plugins/dashboard/html/deleteDashboardModal.html","<div class=\"modal-header\">\n  <h3 class=\"modal-title\">Delete Dashboards?</h3>\n</div>\n<div class=\"modal-body\">\n  <p>Are you sure you want to delete the selected dashboards:</p>\n  <ul>\n    <li ng-repeat=\"dashboard in selected track by $index\">{{dashboard.title}}</li>\n  </ul>\n  <p class=\"strong\">This operation cannot be undone</p>\n</div>\n<div class=\"modal-footer\">\n  <button class=\"btn btn-primary\" ng-click=\"ok()\">OK</button>\n  <button class=\"btn btn-warning\" ng-click=\"cancel()\">Cancel</button>\n</div>\n");
$templateCache.put("plugins/dashboard/html/deleteWidgetModal.html","<div class=\"modal-header\">\n  <h3 class=\"modal-title\">Delete Widget</h3>\n</div>\n<div class=\"modal-body\">\n  <p>Are you sure you want to delete the widget <span ng-show=\"widget.title\">\"{{widget.title}}\"</span>?</p>\n  <p class=\"strong\">This operation cannot be undone</p>\n</div>\n<div class=\"modal-footer\">\n  <button class=\"btn btn-primary\" ng-click=\"ok()\">OK</button>\n  <button class=\"btn btn-warning\" ng-click=\"cancel()\">Cancel</button>\n</div>\n");
$templateCache.put("plugins/dashboard/html/editDashboardTitleCell.html","<div class=\"ngCellText\"><a href=\"/dashboard/id/{{row.entity.id}}{{row.entity.hash}}\">{{row.entity.title}}</a></div>\n");
$templateCache.put("plugins/dashboard/html/editDashboards.html","<div ng-controller=\"Dashboard.EditDashboardsController\">\n  <div class=\"row\">\n    <div class=\"col-md-12\">\n      <p></p>\n      <ul class=\"nav nav-tabs\">\n        <li>\n          <button class=\"btn btn-success\" ng-click=\"create()\"\n             title=\"Create a new empty dashboard\"\n             data-placement=\"bottom\">\n            <i class=\"fa fa-plus\"></i> Create</button>\n        </li>\n        <li>\n          <button class=\"btn\" ng-click=\"renameDashboard()\"\n            ng-disabled=\"gridOptions.selectedItems.length !== 1\"\n             title=\"Rename the selected dashboard\"\n             data-placement=\"bottom\">\n            <i class=\"fa fa-arrows-h\"></i> Rename</button>\n        </li>\n        <li>\n          <button class=\"btn\" ng-disabled=\"!hasSelection()\"\n             ng-click=\"duplicate()\"\n                  title=\"Create a copy of the selected dashboard(s)\" data-placement=\"bottom\">\n            <i class=\"fa fa-copy\"></i> Duplicate\n          </button>\n        </li>\n        <li>\n          <button class=\"btn btn-danger\" ng-disabled=\"!hasSelection()\"\n             ng-click=\"deleteDashboard()\">\n             <i class=\"fa fa-remove\"></i> Delete\n          </button>\n        </li>\n        <!--\n        <li class=\"pull-right\">\n          <button class=\"btn btn-primary\" href=\"#/dashboard/import\"\n             title=\"Imports a JSON dashboard configuration from github or some other URL\"\n             data-placement=\"bottom\">\n            <i class=\"fa fa-cloud-download\"></i> Import\n          </button>\n        </li>\n        -->\n      </ul>\n    </div>\n  </div>\n\n  <div class=\"row\">\n    <div class=\"col-md-12\">\n      <p></p>\n      <table class=\"table table-striped\" hawtio-simple-table=\"gridOptions\"></table>\n    </div>\n  </div>\n\n</div>\n");
$templateCache.put("plugins/dashboard/html/import.html","<div class=\"form-horizontal\" ng-controller=\"Dashboard.ImportController\">\n  <div class=\"control-group\">\n    <button id=\"importButton\" ng-disabled=\"!isValid()\" ng-click=\"importJSON()\"\n            class=\"btn btn-info\"\n            title=\"Imports the JSON configuration of the dashboard\">\n      <i class=\"icon-cloud-download\"></i> import dashboard JSON\n    </button>\n    <div id=\"alert-area\" class=\"span9 pull-right\"></div>\n  </div>\n  <div class=\"control-group\">\n    <textarea id=\"source\" ui-codemirror=\"codeMirrorOptions\" ng-model=\"source\"></textarea>\n  </div>\n</div>");
$templateCache.put("plugins/dashboard/html/renameDashboardModal.html","<div class=\"modal-header\">\n  <h3 class=\"modal-title\">Rename Dashboard \"{{selected.title}}\"</h3>\n</div>\n<div class=\"modal-body\">\n  <div hawtio-form-2=\"config\" entity=\"selected\"></div>\n</div>\n<div class=\"modal-footer\">\n  <button class=\"btn btn-primary\" ng-click=\"ok()\">OK</button>\n  <button class=\"btn btn-warning\" ng-click=\"cancel()\">Cancel</button>\n</div>\n");
$templateCache.put("plugins/dashboard/html/renameWidgetModal.html","<div class=\"modal-header\">\n  <h3 class=\"modal-title\">Rename Dashboard</h3>\n</div>\n<div class=\"modal-body\">\n  <div hawtio-form-2=\"config\" entity=\"widget\"></div>\n</div>\n<div class=\"modal-footer\">\n  <button class=\"btn btn-primary\" ng-click=\"ok()\">OK</button>\n  <button class=\"btn btn-warning\" ng-click=\"cancel()\">Cancel</button>\n</div>\n");}]); hawtioPluginLoader.addModule("hawtio-dashboard-templates");