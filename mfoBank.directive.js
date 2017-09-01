(function (undefined) {

    angular
    .module('app')
    .directive('mfoBank', mfoBankDirective);

    mfoBankDirective.$inject = ['P2RService'];

    function mfoBankDirective(P2RService) {
        var directive = {
            restrict: 'A',
            require: 'ngModel',
            scope: {
                bankData: '='
            },
            link: linkFunc
        };

        return directive;

        function linkFunc(scope,elem,attrs,modelCtrl) {
            scope.$watch(function () {
                return modelCtrl.$modelValue;
            }, ngModelWatcher);

            modelCtrl.$parsers.unshift(mfoInputParser);

            modelCtrl.$formatters.push(mfoInputFormatter);
            
            //////////////////////////////////

            function mfoInputFormatter(modelValue) {
                return mfoInputParser(modelValue, true);
            };

            function mfoInputParser(viewValue,formatter) {
                if (!!viewValue) {
                    var trimString = viewValue.replace(/\s|[^\d]/g, ""),
                        len = trimString.length,
                        returnViewValue = trimString;
                    if (len > 3) {
                        returnViewValue = trimString.substr(0, 3) + ' ' + trimString.substr(3, 6);
                    }

                    if (returnViewValue !== viewValue) {
                        modelCtrl.$setViewValue(returnViewValue);
                        modelCtrl.$render();
                    }

                    if (!formatter) {
                        return trimString;
                    } else {
                        return returnViewValue;
                    }
                    
                }
            };

            function ngModelWatcher(value) {
                if (value && value.length > 5) {
                    P2RService.GetBankByMfo(value).then(successCallback, errorCallback);
                    function successCallback(data) {
                        scope.bankData = data;
                        modelCtrl.$setValidity("mfo", true);
                    };
                    function errorCallback(err) {
                        scope.bankData = null;
                        modelCtrl.$setValidity("mfo", false);
                    };
                } else {
                    scope.bankData = null;
                    modelCtrl.$setValidity("mfo", false);
                };
            };
        };
    };

})();